package az.jeparla.pricing.cbar;

import az.jeparla.pricing.MetalPriceProperties;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Downloads the CBAR daily bulletin (#43). One GET per attempt, no redirects (CBAR answers an unknown
 * date with a 302 to its home page), a connect and a whole-response timeout, a size limit, and a
 * limited number of retries with doubling backoff for network errors, 5xx and 429 only (PLAN 5.13:
 * limited retry, no self-triggering job).
 */
@Component
public class CbarClient {

    /** A bulletin is about 13 KB; anything far larger is not one. */
    static final int MAX_BODY_BYTES = 512 * 1024;

    private static final Logger log = LoggerFactory.getLogger(CbarClient.class);
    private static final DateTimeFormatter URL_DATE = DateTimeFormatter.ofPattern("dd.MM.uuuu");

    private final MetalPriceProperties properties;
    private final HttpClient http;

    public CbarClient(MetalPriceProperties properties) {
        this.properties = properties;
        this.http = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @PreDestroy
    void close() {
        http.close();
    }

    /** The URL of the bulletin of {@code day}. */
    public URI urlOf(LocalDate day) {
        return URI.create(properties.sourceUrl().replace("{date}", URL_DATE.format(day)));
    }

    /**
     * The bank metals of the bulletin in force on {@code day}. On a weekend or holiday CBAR returns the
     * last bulletin, whose date is earlier than {@code day}.
     *
     * @throws CbarFeedException after the last failed attempt, or at once for an invalid bulletin
     */
    public CbarBulletin fetch(LocalDate day) {
        URI url = urlOf(day);
        Duration wait = properties.backoff();
        for (int attempt = 1; ; attempt++) {
            try {
                return CbarBulletinParser.parse(download(url), day);
            } catch (CbarFeedException e) {
                if (!e.isRetryable() || attempt >= properties.attempts()) {
                    throw e;
                }
                log.warn("CBAR bulletin {}: attempt {}/{} failed ({}), retrying in {}", url, attempt,
                        properties.attempts(), e.getMessage(), wait);
                sleep(wait);
                wait = wait.multipliedBy(2);
            }
        }
    }

    private byte[] download(URI url) {
        HttpRequest request = HttpRequest.newBuilder(url)
                .GET()
                .timeout(properties.readTimeout())
                .header("User-Agent", properties.userAgent())
                .header("Accept", "application/xml, text/xml")
                .build();
        HttpResponse<byte[]> response;
        // The request timeout ends at the headers; the future bounds the body as well.
        CompletableFuture<HttpResponse<byte[]>> pending = http.sendAsync(request,
                HttpResponse.BodyHandlers.ofByteArray());
        try {
            response = pending.get(properties.readTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw new CbarFeedException("interrupted while fetching " + url, false, e);
        } catch (TimeoutException e) {
            pending.cancel(true);
            throw new CbarFeedException("no complete answer from " + url + " within " + properties.readTimeout(),
                    true, e);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof HttpTimeoutException) {
                throw new CbarFeedException("no complete answer from " + url + " within " + properties.readTimeout(),
                        true, cause);
            }
            boolean network = cause instanceof IOException;
            throw new CbarFeedException("request to " + url + " failed: " + cause, network, cause);
        }
        int status = response.statusCode();
        if (status != 200) {
            boolean retryable = status >= 500 || status == 429;
            throw new CbarFeedException("CBAR answered " + status + " for " + url, retryable);
        }
        String contentType = response.headers().firstValue("Content-Type").orElse("");
        if (!contentType.contains("xml")) {
            throw new CbarFeedException("CBAR answered " + url + " with Content-Type '" + contentType + "'", false);
        }
        byte[] body = response.body();
        if (body.length > MAX_BODY_BYTES) {
            throw new CbarFeedException("CBAR bulletin is " + body.length + " bytes, over the limit", false);
        }
        return body;
    }

    private static void sleep(Duration wait) {
        if (wait.isZero() || wait.isNegative()) {
            return;
        }
        try {
            Thread.sleep(wait);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CbarFeedException("interrupted while waiting to retry", false, e);
        }
    }
}
