package az.jeparla.notification;

import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * The SMTP relay the email outbox is sent through (#131), bound from {@code jeparla.mail.*}. Any provider with
 * SMTP works (docs/deploy.md, "Email"); keys come only from the environment. Without a host nothing is sent and the
 * outbox keeps the messages ({@link NoEmailSender}).
 *
 * @param host     SMTP host ({@code JEPARLA_SMTP_HOST}), empty: no provider
 * @param port     SMTP port; 587 with STARTTLS
 * @param username SMTP login ({@code JEPARLA_SMTP_USERNAME})
 * @param password SMTP password or API key ({@code JEPARLA_SMTP_PASSWORD}); never logged
 * @param from     sender address ({@code JEPARLA_MAIL_FROM}), e.g. {@code Jeparla <no-reply@jeparla.az>}; required
 *                 with a host
 */
@ConfigurationProperties("jeparla.mail")
public record SmtpProperties(
        @DefaultValue("") String host,
        @DefaultValue("587") int port,
        @DefaultValue("") String username,
        @DefaultValue("") String password,
        @DefaultValue("") String from) {

    private static final Pattern ADDRESS = Pattern.compile("(.+<)?[^@\\s<>]+@[^@\\s<>]+\\.[^@\\s<>]+>?");

    public SmtpProperties {
        host = host == null ? "" : host.strip();
        username = username == null ? "" : username.strip();
        password = password == null ? "" : password;
        from = from == null ? "" : from.strip();
        if (!host.isEmpty()) {
            if (port < 1 || port > 65535) {
                throw new IllegalArgumentException("jeparla.mail.port must be 1..65535");
            }
            if (!ADDRESS.matcher(from).matches()) {
                throw new IllegalArgumentException(
                        "jeparla.mail.from (JEPARLA_MAIL_FROM) must be an address, e.g. Jeparla <no-reply@jeparla.az>");
            }
        }
    }

    /** Whether a relay is configured. */
    public boolean enabled() {
        return !host.isEmpty();
    }

    /** The password never appears in logs or failure analysis output. */
    @Override
    public String toString() {
        return "SmtpProperties[host=" + host + ", port=" + port + ", username=" + (username.isEmpty() ? "" : "***")
                + ", password=***, from=" + from + "]";
    }
}
