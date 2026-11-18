package az.jeparla.indexnow;

import jakarta.annotation.PreDestroy;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Collects the public URLs of committed catalog changes and submits them to IndexNow (#62).
 *
 * <p>Everything runs on one background thread: resolving the changes to URLs, keeping them until they are
 * {@link IndexNowProperties#delay() due}, and the submission itself, so a request never waits for the database
 * lookup or the network, and the queue needs no locking. A URL changed again before it is sent is sent once. A
 * submission that failed for a temporary reason is retried after the delay, up to
 * {@link IndexNowProperties#attempts()} times; a rejected one (bad key, wrong host) is dropped and logged. Memory
 * is bounded: at most {@link #MAX_PENDING} URLs wait, the oldest are dropped first, and the task queue is bounded
 * too (IndexNow only speeds up crawling; the sitemap still lists every page).
 */
@Service
public class IndexNowService {

    /** Most URLs kept waiting. */
    static final int MAX_PENDING = 50_000;

    private static final Logger log = LoggerFactory.getLogger(IndexNowService.class);

    private final IndexNowProperties properties;
    private final CatalogUrls urls;
    private final IndexNowClient client;
    private final Clock clock;
    private final Executor worker;
    private final ExecutorService ownWorker;

    /** URL -> its state, oldest first. Touched only on the worker thread. */
    private final Map<String, Pending> pending = new LinkedHashMap<>();

    private record Pending(Instant due, int attempts) {
    }

    @Autowired
    public IndexNowService(IndexNowProperties properties, CatalogUrls urls, IndexNowClient client, Clock clock) {
        this(properties, urls, client, clock, newWorker());
    }

    private IndexNowService(IndexNowProperties properties, CatalogUrls urls, IndexNowClient client, Clock clock,
            ExecutorService worker) {
        this.properties = properties;
        this.urls = urls;
        this.client = client;
        this.clock = clock;
        this.worker = worker;
        this.ownWorker = worker;
    }

    /** For tests: runs the work on {@code worker} (e.g. directly on the calling thread). */
    IndexNowService(IndexNowProperties properties, CatalogUrls urls, IndexNowClient client, Clock clock,
            Executor worker) {
        this.properties = properties;
        this.urls = urls;
        this.client = client;
        this.clock = clock;
        this.worker = worker;
        this.ownWorker = null;
    }

    private static ExecutorService newWorker() {
        return new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(1_000), runnable -> {
            Thread thread = new Thread(runnable, "indexnow");
            thread.setDaemon(true);
            return thread;
        }, new ThreadPoolExecutor.AbortPolicy());
    }

    @PreDestroy
    void close() {
        if (ownWorker != null) {
            ownWorker.shutdownNow();
        }
    }

    /** Whether IndexNow is on; when off, changes are not even collected. */
    public boolean enabled() {
        return properties.enabled();
    }

    /** Committed changes (called after the commit, on the request thread): queued, never waited for. */
    public void changed(Collection<CatalogChange> changes) {
        if (!enabled() || changes.isEmpty()) {
            return;
        }
        List<CatalogChange> copy = List.copyOf(changes);
        run(() -> enqueue(urls.of(copy)));
    }

    /** Sends the URLs that are due. Scheduled; the work itself runs on the IndexNow thread. */
    @Scheduled(initialDelayString = "${jeparla.indexnow.flush-interval:60s}",
            fixedDelayString = "${jeparla.indexnow.flush-interval:60s}")
    public void flush() {
        if (enabled()) {
            run(this::sendDue);
        }
    }

    private void run(Runnable task) {
        try {
            worker.execute(() -> {
                try {
                    task.run();
                } catch (RuntimeException e) {
                    log.warn("IndexNow task failed", e);
                }
            });
        } catch (RejectedExecutionException e) {
            log.warn("IndexNow queue is full, a change is not submitted (the sitemap still lists it)");
        }
    }

    private void enqueue(List<String> changed) {
        Instant due = clock.instant().plus(properties.delay());
        for (String url : changed) {
            // A new change restarts the wait and the attempts, and moves the URL to the end.
            pending.remove(url);
            pending.put(url, new Pending(due, 0));
        }
        var oldest = pending.keySet().iterator();
        while (pending.size() > MAX_PENDING && oldest.hasNext()) {
            oldest.next();
            oldest.remove();
        }
    }

    private void sendDue() {
        Instant now = clock.instant();
        List<String> batch = new ArrayList<>();
        for (Map.Entry<String, Pending> entry : pending.entrySet()) {
            if (!entry.getValue().due().isAfter(now)) {
                batch.add(entry.getKey());
                if (batch.size() == IndexNowClient.MAX_URLS) {
                    break;
                }
            }
        }
        if (batch.isEmpty()) {
            return;
        }
        IndexNowClient.Outcome outcome = client.submit(urls.siteUrl(), batch);
        if (outcome != IndexNowClient.Outcome.RETRY) {
            batch.forEach(pending::remove);
            if (outcome == IndexNowClient.Outcome.SENT) {
                log.info("IndexNow: submitted {} URLs", batch.size());
            }
            return;
        }
        int dropped = 0;
        for (String url : batch) {
            Pending state = pending.get(url);
            int attempts = state.attempts() + 1;
            if (attempts >= properties.attempts()) {
                pending.remove(url);
                dropped++;
            } else {
                pending.put(url, new Pending(now.plus(properties.delay()), attempts));
            }
        }
        if (dropped > 0) {
            log.warn("IndexNow: gave up {} URLs after {} attempts", dropped, properties.attempts());
        }
    }

    /** URLs waiting to be sent (tests). Call on the worker thread or with a direct worker. */
    int pendingCount() {
        return pending.size();
    }
}
