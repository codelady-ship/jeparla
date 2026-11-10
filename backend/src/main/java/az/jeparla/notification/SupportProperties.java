package az.jeparla.notification;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Where a seller turns with a question about a decision (#138), bound from {@code jeparla.support.*}. Every
 * notification that says "contact support" ends with this contact, also in the email, which is read outside the
 * site. Without an email address and a URL the contact is the in-app help page.
 *
 * @param email    support email address ({@code JEPARLA_SUPPORT_EMAIL}), or empty
 * @param url      support page or chat, absolute http(s) URL ({@code JEPARLA_SUPPORT_URL}), or empty
 * @param helpPath frontend path of the help page, used when neither is set
 */
@ConfigurationProperties("jeparla.support")
public record SupportProperties(
        @DefaultValue("") String email,
        @DefaultValue("") String url,
        @DefaultValue("/help") String helpPath) {

    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    private static final Pattern PATH = Pattern.compile("/[A-Za-z0-9/_-]*");

    public SupportProperties {
        email = email == null ? "" : email.strip();
        url = url == null ? "" : url.strip();
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("jeparla.support.email is not an email address");
        }
        if (!url.isEmpty()) {
            URI uri;
            try {
                uri = URI.create(url);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("jeparla.support.url is not a URL", e);
            }
            if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null) {
                throw new IllegalArgumentException("jeparla.support.url must be an absolute http(s) URL");
            }
        }
        if (helpPath == null || !PATH.matcher(helpPath).matches()) {
            throw new IllegalArgumentException("jeparla.support.help-path must be a path such as /help");
        }
    }

    /** Whether an email address or a URL is configured; otherwise the help page is the contact. */
    public boolean hasContact() {
        return !email.isEmpty() || !url.isEmpty();
    }

    /** The configured contacts, email first, separated by a comma; empty without any. */
    public String contact() {
        List<String> parts = new ArrayList<>(2);
        if (!email.isEmpty()) {
            parts.add(email);
        }
        if (!url.isEmpty()) {
            parts.add(url);
        }
        return String.join(", ", parts);
    }
}
