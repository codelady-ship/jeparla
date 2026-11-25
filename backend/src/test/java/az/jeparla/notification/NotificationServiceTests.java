package az.jeparla.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.auth.User;
import az.jeparla.common.i18n.Language;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.support.ResourceBundleMessageSource;

/**
 * The support line of notifications (#138, #167): without a configured contact the in-app notification names
 * the help page path in the recipient's language, the email its absolute URL, since it is read outside the site.
 */
class NotificationServiceTests {

    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final EmailOutboxRepository outbox = mock(EmailOutboxRepository.class);

    private static ResourceBundleMessageSource messages() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return source;
    }

    private Notification notifyStoreRejected(SupportProperties support, Language language) {
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        NotificationService service = new NotificationService(notifications, outbox, messages(), support,
                Clock.fixed(Instant.parse("2026-11-10T09:00:00Z"), ZoneOffset.UTC));
        User seller = new User("satici@jeparla.test", null, "hash", "Satıcı");
        seller.setPreferredLocale(language);
        return service.notify(seller, NotificationKind.STORE_REJECTED,
                locale -> new Object[] {"Qızıl Ev", "VÖEN"}, null, "/merchant/store");
    }

    private String emailBody() {
        ArgumentCaptor<EmailOutboxMessage> email = ArgumentCaptor.forClass(EmailOutboxMessage.class);
        verify(outbox).save(email.capture());
        return email.getValue().getBody();
    }

    @Test
    void withoutContactTheAppNamesTheHelpPathAndTheEmailItsAbsoluteUrl() {
        SupportProperties none = new SupportProperties("", "", "/help", "https://jeparla.az/");
        Notification notification = notifyStoreRejected(none, Language.EN);

        assertThat(notification.getBody()).endsWith("\n\nSupport: the help page on the site, /en/help");
        assertThat(emailBody())
                .contains("\n\nSupport: the help page on the site, https://jeparla.az/en/help\n\n")
                .doesNotContain(", /help")
                .doesNotContain(", /en/help");
    }

    @Test
    void theHelpPageIsInTheRecipientsLanguage() {
        SupportProperties none = new SupportProperties("", "", "/help", "https://jeparla.az");

        assertThat(notifyStoreRejected(none, Language.RU).getBody())
                .endsWith("Поддержка: страница помощи на сайте, /ru/help");
        assertThat(emailBody()).contains("Поддержка: страница помощи на сайте, https://jeparla.az/ru/help");
    }

    @Test
    void aConfiguredContactIsTheSameInTheAppAndTheEmail() {
        SupportProperties contact = new SupportProperties("destek@jeparla.az", "", "/help", "https://jeparla.az");
        Notification notification = notifyStoreRejected(contact, Language.AZ);

        assertThat(notification.getBody()).endsWith("\n\nDəstək: destek@jeparla.az");
        assertThat(emailBody()).contains("\n\nDəstək: destek@jeparla.az\n\n").doesNotContain("/help");
    }

    @Test
    void aReadyAiResultNamesTheProductInEachLanguageWithoutTheSupportLine() {
        SupportProperties contact = new SupportProperties("destek@jeparla.az", "", "/help", "https://jeparla.az");
        when(notifications.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));
        NotificationService service = new NotificationService(notifications, outbox, messages(), contact,
                Clock.fixed(Instant.parse("2026-11-23T09:00:00Z"), ZoneOffset.UTC));
        for (Language language : Language.values()) {
            User seller = new User("satici@jeparla.test", null, "hash", "Satıcı");
            seller.setPreferredLocale(language);
            Notification notification = service.notify(seller, NotificationKind.AI_RESULT_READY,
                    locale -> new Object[] {"Qızıl üzük"}, null, "/merchant/products/7/ai-studio");

            assertThat(notification.getTitle()).isNotBlank().doesNotStartWith("notification.");
            assertThat(notification.getBody()).contains("Qızıl üzük").contains("AI Studio")
                    .doesNotContain("destek@jeparla.az");
            assertThat(notification.getLink()).isEqualTo("/merchant/products/7/ai-studio");
        }
    }
}
