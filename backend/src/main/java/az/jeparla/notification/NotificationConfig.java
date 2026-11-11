package az.jeparla.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The {@link EmailSender}: {@link SmtpEmailSender} when an SMTP relay is configured ({@code JEPARLA_SMTP_HOST},
 * #131), otherwise {@link NoEmailSender}, which leaves the messages in the outbox.
 */
@Configuration(proxyBeanMethods = false)
public class NotificationConfig {

    private static final Logger log = LoggerFactory.getLogger(NotificationConfig.class);

    @Bean
    @ConditionalOnMissingBean(EmailSender.class)
    EmailSender emailSender(SmtpProperties smtp) {
        if (smtp.enabled()) {
            log.info("Emails are sent through SMTP host {}:{}", smtp.host(), smtp.port());
            return SmtpEmailSender.of(smtp);
        }
        log.warn("No email provider is configured (JEPARLA_SMTP_HOST, #131): emails stay in the outbox, in-app"
                + " notifications work");
        return new NoEmailSender();
    }
}
