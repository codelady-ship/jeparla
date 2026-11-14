package az.jeparla.auth;

import az.jeparla.common.i18n.Language;
import az.jeparla.notification.SupportProperties;
import org.springframework.stereotype.Component;

/**
 * Absolute frontend links with a one-time token (#131), on the public site origin ({@code jeparla.support.site-url},
 * {@code JEPARLA_PUBLIC_SITE_URL}) in the account's language. The token is in the fragment ({@code #token=}):
 * browsers never send a fragment to a server, so it stays out of access logs and {@code Referer} headers; the page
 * reads it in the browser and posts it to the API.
 */
@Component
public class AccountLinks {

    /** Frontend page that confirms an email address: {@code /{lang}/verify-email#token=...}. */
    public static final String VERIFY_EMAIL_PATH = "/verify-email";
    /** Frontend page that sets a new password: {@code /{lang}/reset-password#token=...}. */
    public static final String RESET_PASSWORD_PATH = "/reset-password";

    private final SupportProperties site;

    public AccountLinks(SupportProperties site) {
        this.site = site;
    }

    public String verifyEmail(Language language, String token) {
        return link(language, VERIFY_EMAIL_PATH, token);
    }

    public String resetPassword(Language language, String token) {
        return link(language, RESET_PASSWORD_PATH, token);
    }

    private String link(Language language, String path, String token) {
        // Tokens are base64url: nothing to encode.
        return site.siteUrl() + "/" + language.code() + path + "#token=" + token;
    }
}
