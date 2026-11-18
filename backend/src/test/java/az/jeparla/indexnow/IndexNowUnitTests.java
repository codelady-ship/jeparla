package az.jeparla.indexnow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.notification.SupportProperties;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

/** IndexNow (#62) without Spring or a database: settings, the request, batching, waiting and retries. */
class IndexNowUnitTests {

    private static final String KEY = "0123456789abcdef0123456789abcdef";
    private static final String SITE = "https://jeparla.az";

    private static IndexNowProperties properties(String key, String endpoint) {
        return new IndexNowProperties(key, endpoint, Duration.ofMinutes(10), 3, Duration.ofSeconds(2));
    }

    // ------------------------------------------------------------------ settings

    @Test
    void anEmptyKeyTurnsIndexNowOffAndABadKeyStopsTheStart() {
        assertThat(properties("", "https://api.indexnow.org/indexnow").enabled()).isFalse();
        assertThat(properties(null, "https://api.indexnow.org/indexnow").enabled()).isFalse();
        assertThat(properties(" " + KEY + " ", "https://api.indexnow.org/indexnow").key()).isEqualTo(KEY);
        assertThatThrownBy(() -> properties("short", "https://api.indexnow.org/indexnow"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> properties("key/with/slashes-123", "https://api.indexnow.org/indexnow"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> properties(KEY, "api.indexnow.org"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------------------------ client

    @Test
    void theRequestNamesTheHostTheKeyItsLocationAndTheUrls() {
        IndexNowClient client = new IndexNowClient(properties(KEY, "https://api.indexnow.org/indexnow"));
        assertThat(client.body(SITE, List.of(SITE + "/az/products/a", SITE + "/en/products/a")))
                .isEqualTo("{\"host\":\"jeparla.az\",\"key\":\"" + KEY + "\",\"keyLocation\":\"" + SITE + "/" + KEY
                        + ".txt\",\"urlList\":[\"https://jeparla.az/az/products/a\",\"https://jeparla.az/en/products/a\"]}");
        assertThat(IndexNowClient.quote("a\"b\\c\n")).isEqualTo("\"a\\\"b\\\\c\\u000a\"");
    }

    @Test
    void answersAreFoldedIntoSentRetryOrRejected() throws IOException {
        AtomicReference<Integer> status = new AtomicReference<>(200);
        AtomicReference<String> received = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/indexnow", exchange -> {
            try (InputStream body = exchange.getRequestBody()) {
                received.set(exchange.getRequestMethod() + " " + exchange.getRequestHeaders().getFirst("Content-Type")
                        + " " + new String(body.readAllBytes(), StandardCharsets.UTF_8));
            }
            exchange.sendResponseHeaders(status.get(), -1);
            exchange.close();
        });
        server.start();
        try {
            String endpoint = "http://127.0.0.1:" + server.getAddress().getPort() + "/indexnow";
            IndexNowClient client = new IndexNowClient(properties(KEY, endpoint));
            List<String> urls = List.of(SITE + "/az/stores/s");

            assertThat(client.submit(SITE, urls)).isEqualTo(IndexNowClient.Outcome.SENT);
            assertThat(received.get()).startsWith("POST application/json; charset=utf-8 {\"host\":\"jeparla.az\"");
            status.set(202);
            assertThat(client.submit(SITE, urls)).isEqualTo(IndexNowClient.Outcome.SENT);
            status.set(429);
            assertThat(client.submit(SITE, urls)).isEqualTo(IndexNowClient.Outcome.RETRY);
            status.set(503);
            assertThat(client.submit(SITE, urls)).isEqualTo(IndexNowClient.Outcome.RETRY);
            status.set(403);
            assertThat(client.submit(SITE, urls)).isEqualTo(IndexNowClient.Outcome.REJECTED);
            status.set(422);
            assertThat(client.submit(SITE, urls)).isEqualTo(IndexNowClient.Outcome.REJECTED);
        } finally {
            server.stop(0);
        }
        // Nothing listens there: a network error is retried.
        IndexNowClient unreachable = new IndexNowClient(properties(KEY, "http://127.0.0.1:9/indexnow"));
        assertThat(unreachable.submit(SITE, List.of(SITE + "/az"))).isEqualTo(IndexNowClient.Outcome.RETRY);
    }

    // ------------------------------------------------------------------ service

    /** URLs per change id, without a database. */
    private static class FakeUrls extends CatalogUrls {
        FakeUrls() {
            super(null, new SupportProperties("", "", "/help", SITE));
        }

        @Override
        public List<String> of(Collection<CatalogChange> changes) {
            return changes.stream().map(change -> SITE + "/az/products/p" + change.id()).toList();
        }
    }

    /** Records submissions and answers with the next outcome. */
    private static final class FakeClient extends IndexNowClient {
        final List<List<String>> sent = new ArrayList<>();
        IndexNowClient.Outcome answer = Outcome.SENT;

        FakeClient(IndexNowProperties properties) {
            super(properties);
        }

        @Override
        public Outcome submit(String siteUrl, List<String> urls) {
            sent.add(List.copyOf(urls));
            return answer;
        }
    }

    private static final class MovingClock extends Clock {
        Instant now = Instant.parse("2026-11-18T08:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }
    }

    @Test
    void changedPagesWaitForTheDelayAndGoInOneBatchOnce() {
        IndexNowProperties props = properties(KEY, "https://api.indexnow.org/indexnow");
        FakeClient client = new FakeClient(props);
        MovingClock clock = new MovingClock();
        IndexNowService service = new IndexNowService(props, new FakeUrls(), client, clock, Runnable::run);

        service.changed(List.of(CatalogChange.product(1, false), CatalogChange.product(2, true)));
        service.changed(List.of(CatalogChange.product(1, false)));
        service.flush();
        assertThat(client.sent).as("the site's cache may still show the old page").isEmpty();

        clock.advance(Duration.ofMinutes(10));
        service.flush();
        assertThat(client.sent).containsExactly(List.of(SITE + "/az/products/p2", SITE + "/az/products/p1"));
        assertThat(service.pendingCount()).isZero();

        service.flush();
        assertThat(client.sent).hasSize(1);
    }

    @Test
    void temporaryFailuresAreRetriedAFewTimesAndRejectionsAreDropped() {
        IndexNowProperties props = properties(KEY, "https://api.indexnow.org/indexnow");
        FakeClient client = new FakeClient(props);
        MovingClock clock = new MovingClock();
        IndexNowService service = new IndexNowService(props, new FakeUrls(), client, clock, Runnable::run);

        client.answer = IndexNowClient.Outcome.RETRY;
        service.changed(List.of(CatalogChange.product(7, false)));
        for (int i = 0; i < 5; i++) {
            clock.advance(Duration.ofMinutes(10));
            service.flush();
        }
        assertThat(client.sent).as("3 attempts, then given up").hasSize(3);
        assertThat(service.pendingCount()).isZero();

        client.answer = IndexNowClient.Outcome.REJECTED;
        service.changed(List.of(CatalogChange.product(8, false)));
        clock.advance(Duration.ofMinutes(10));
        service.flush();
        clock.advance(Duration.ofMinutes(10));
        service.flush();
        assertThat(client.sent).hasSize(4);
        assertThat(service.pendingCount()).isZero();
    }

    @Test
    void withoutAKeyNothingIsCollectedOrSent() {
        IndexNowProperties props = properties("", "https://api.indexnow.org/indexnow");
        FakeClient client = new FakeClient(props);
        MovingClock clock = new MovingClock();
        IndexNowService service = new IndexNowService(props, new FakeUrls(), client, clock, Runnable::run);

        service.changed(List.of(CatalogChange.product(1, true)));
        clock.advance(Duration.ofHours(1));
        service.flush();
        assertThat(service.enabled()).isFalse();
        assertThat(service.pendingCount()).isZero();
        assertThat(client.sent).isEmpty();
    }

    @Test
    void aFailingTaskNeverReachesTheCaller() {
        IndexNowProperties props = properties(KEY, "https://api.indexnow.org/indexnow");
        CatalogUrls broken = new FakeUrls() {
            @Override
            public List<String> of(Collection<CatalogChange> changes) {
                throw new IllegalStateException("database down");
            }
        };
        IndexNowService service = new IndexNowService(props, broken, new FakeClient(props), new MovingClock(),
                Runnable::run);
        service.changed(List.of(CatalogChange.product(1, true)));
        assertThat(service.pendingCount()).isZero();
        // A full queue drops the work instead of blocking the request.
        IndexNowService full = new IndexNowService(props, new FakeUrls(), new FakeClient(props), new MovingClock(),
                task -> {
                    throw new java.util.concurrent.RejectedExecutionException("full");
                });
        full.changed(List.of(CatalogChange.product(1, true)));
        assertThat(full.pendingCount()).isZero();
    }
}
