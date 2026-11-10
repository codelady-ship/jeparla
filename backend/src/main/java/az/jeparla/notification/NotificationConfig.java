package az.jeparla.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** The {@link EmailSender}: {@link NoEmailSender} until a provider bean exists (#131). */
@Configuration(proxyBeanMethods = false)
public class NotificationConfig {

    private static final Logger log = LoggerFactory.getLogger(NotificationConfig.class);

    @Bean
    @ConditionalOnMissingBean(EmailSender.class)
    EmailSender emailSender() {
        log.warn("No email provider is configured (#131): emails stay in the outbox, in-app notifications work");
        return new NoEmailSender();
    }
}
