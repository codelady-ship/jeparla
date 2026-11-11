package az.jeparla.share;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Shareable catalog links (#100), bound from {@code jeparla.share.*}.
 *
 * @param siteUrl public origin of the frontend ({@code JEPARLA_PUBLIC_SITE_URL}, e.g. {@code https://jeparla.az}):
 *                the share link is {@code <siteUrl>/s/<code>}. An http(s) origin without path, query or fragment;
 *                anything else stops the application.
 */
@ConfigurationProperties("jeparla.share")
public record ShareProperties(@DefaultValue("http://localhost:3000") String siteUrl) {

    public ShareProperties {
        siteUrl = siteUrl == null ? "" : siteUrl.strip();
        while (siteUrl.endsWith("/")) {
            siteUrl = siteUrl.substring(0, siteUrl.length() - 1);
        }
        URI uri;
        try {
            uri = URI.create(siteUrl);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("jeparla.share.site-url is not a URL", e);
        }
        boolean http = "https".equals(uri.getScheme()) || "http".equals(uri.getScheme());
        boolean originOnly = (uri.getRawPath() == null || uri.getRawPath().isEmpty()) && uri.getRawQuery() == null
                && uri.getRawFragment() == null && uri.getRawUserInfo() == null;
        if (!http || uri.getHost() == null || !originOnly) {
            throw new IllegalArgumentException(
                    "jeparla.share.site-url (JEPARLA_PUBLIC_SITE_URL) must be an http(s) origin such as https://jeparla.az");
        }
    }

    /** The share link of a code: {@code <siteUrl>/s/<code>}. */
    public String linkOf(String code) {
        return siteUrl + "/s/" + code;
    }
}
