package az.jeparla.common.web;

import java.time.Duration;
import org.springframework.http.CacheControl;

/**
 * {@code Cache-Control} of anonymous catalog responses, made for a CDN in front of the API: browsers
 * keep a response briefly ({@code max-age}), the CDN longer ({@code s-maxage}), and a stale copy is
 * served while the CDN revalidates ({@code stale-while-revalidate}). The ETag of
 * {@link CatalogEtagFilter} makes revalidation cheap (304). Responses are the same for every language
 * (data carries az, en and ru), so there is no {@code Vary: Accept-Language}.
 *
 * <p>Errors and signed-in responses keep {@code Cache-Control: no-store} from Spring Security.
 */
public final class CachePolicy {

    /** Products and stores: prices change at most daily (metal job), moderation any time. */
    public static final CacheControl CATALOG = CacheControl.maxAge(Duration.ofMinutes(1))
            .sMaxAge(Duration.ofMinutes(5))
            .staleWhileRevalidate(Duration.ofMinutes(10))
            .cachePublic();

    /** Categories, finenesses and metal quotes: admin-managed or daily data. */
    public static final CacheControl REFERENCE = CacheControl.maxAge(Duration.ofMinutes(5))
            .sMaxAge(Duration.ofHours(1))
            .staleWhileRevalidate(Duration.ofDays(1))
            .cachePublic();

    private CachePolicy() {
    }
}
