package az.jeparla.common.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/**
 * Strong ETag (hash of the body) and {@code If-None-Match} -> 304 for public catalog responses only:
 * the response must carry a {@code public} Cache-Control ({@link CachePolicy}). Private and
 * {@code no-store} responses (auth, errors) are passed through untouched.
 */
public class CatalogEtagFilter extends ShallowEtagHeaderFilter {

    @Override
    protected boolean isEligibleForEtag(HttpServletRequest request, HttpServletResponse response,
            int responseStatusCode, java.io.InputStream inputStream) {
        String cacheControl = response.getHeader(HttpHeaders.CACHE_CONTROL);
        return cacheControl != null && cacheControl.contains("public")
                && super.isEligibleForEtag(request, response, responseStatusCode, inputStream);
    }
}
