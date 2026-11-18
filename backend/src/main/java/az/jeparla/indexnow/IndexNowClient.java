package az.jeparla.indexnow;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * One IndexNow submission (#62): a POST of up to 10 000 URLs of one host with the key and its location, as
 * indexnow.org documents it. No redirects, a timeout, and the answer folded into what the caller does next.
 */
@Component
public class IndexNowClient {

    /** What to do with the URLs of a submission. */
    public enum Outcome {
        /** 200 or 202: the engines have them. */
        SENT,
        /** Network error, timeout, 429 or 5xx: try again later. */
        RETRY,
        /** Any other answer (400 bad request, 403 key not found on the site, 422 URLs of another host). */
        REJECTED
    }

    /** Most URLs IndexNow takes in one POST. */
    public static final int MAX_URLS = 10_000;

    private static final Logger log = LoggerFactory.getLogger(IndexNowClient.class);

    private final IndexNowProperties properties;
    private final HttpClient http;

    public IndexNowClient(IndexNowProperties properties) {
        this.properties = properties;
        this.http = HttpClient.newBuilder()
                .connectTimeout(properties.timeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @PreDestroy
    void close() {
        http.close();
    }

    /**
     * Submits {@code urls}, all on {@code siteUrl}'s host, with the key file at {@code <siteUrl>/<key>.txt}.
     *
     * @param siteUrl public origin of the site without a trailing slash, e.g. {@code https://jeparla.az}
     */
    public Outcome submit(String siteUrl, List<String> urls) {
        if (urls.isEmpty()) {
            return Outcome.SENT;
        }
        if (urls.size() > MAX_URLS) {
            throw new IllegalArgumentException("IndexNow takes at most " + MAX_URLS + " URLs per submission");
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(properties.endpoint()))
                .timeout(properties.timeout())
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(body(siteUrl, urls), StandardCharsets.UTF_8))
                .build();
        try {
            int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 200 || status == 202) {
                return Outcome.SENT;
            }
            if (status == 429 || status >= 500) {
                log.warn("IndexNow answered {} for {} URLs, will retry", status, urls.size());
                return Outcome.RETRY;
            }
            log.warn("IndexNow rejected {} URLs with {} (403: the key file is not served at {}/<key>.txt)",
                    urls.size(), status, siteUrl);
            return Outcome.REJECTED;
        } catch (IOException e) {
            log.warn("IndexNow submission of {} URLs failed: {}", urls.size(), e.toString());
            return Outcome.RETRY;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Outcome.RETRY;
        }
    }

    /** The JSON body. Package-private for tests. */
    String body(String siteUrl, List<String> urls) {
        StringBuilder json = new StringBuilder(64 + urls.size() * 64)
                .append("{\"host\":").append(quote(URI.create(siteUrl).getHost()))
                .append(",\"key\":").append(quote(properties.key()))
                .append(",\"keyLocation\":").append(quote(siteUrl + "/" + properties.key() + ".txt"))
                .append(",\"urlList\":[");
        for (int i = 0; i < urls.size(); i++) {
            json.append(i == 0 ? "" : ",").append(quote(urls.get(i)));
        }
        return json.append("]}").toString();
    }

    /** A JSON string literal. */
    static String quote(String value) {
        StringBuilder out = new StringBuilder(value.length() + 2).append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.append('"').toString();
    }
}
