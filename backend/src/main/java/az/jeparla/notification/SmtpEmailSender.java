package az.jeparla.notification;

import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Sends the outbox through an SMTP relay (#131): plain-text UTF-8 email, STARTTLS required, short timeouts so a
 * slow relay never holds the outbox lock for long. A refused message throws and is retried by
 * {@link EmailOutboxJob}.
 */
public class SmtpEmailSender implements EmailSender {

    private static final String TIMEOUT_MILLIS = "10000";

    private final JavaMailSender mail;
    private final String from;

    SmtpEmailSender(JavaMailSender mail, String from) {
        this.mail = mail;
        this.from = from;
    }

    /** A sender for {@code properties}, which must be {@link SmtpProperties#enabled() enabled}. */
    static SmtpEmailSender of(SmtpProperties properties) {
        JavaMailSenderImpl mail = new JavaMailSenderImpl();
        mail.setHost(properties.host());
        mail.setPort(properties.port());
        if (!properties.username().isEmpty()) {
            mail.setUsername(properties.username());
            mail.setPassword(properties.password());
        }
        mail.setDefaultEncoding(StandardCharsets.UTF_8.name());
        Properties javaMail = mail.getJavaMailProperties();
        javaMail.put("mail.transport.protocol", "smtp");
        javaMail.put("mail.smtp.auth", String.valueOf(!properties.username().isEmpty()));
        // Never send a password or a one-time link over an unencrypted connection.
        javaMail.put("mail.smtp.starttls.enable", "true");
        javaMail.put("mail.smtp.starttls.required", "true");
        javaMail.put("mail.smtp.connectiontimeout", TIMEOUT_MILLIS);
        javaMail.put("mail.smtp.timeout", TIMEOUT_MILLIS);
        javaMail.put("mail.smtp.writetimeout", TIMEOUT_MILLIS);
        return new SmtpEmailSender(mail, properties.from());
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mail.send(message);
    }
}
