package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.i18n.Language;
import az.jeparla.notification.SupportProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.MessageFormat;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import org.junit.jupiter.api.Test;

/** Texts and links of the account emails (#131) in az, en and ru, and their settings. */
class AccountEmailMessagesTests {

    private static final String LINK = "https://jeparla.az/ru/reset-password#token=abc";

    private static Properties load(String file) throws IOException {
        try (InputStream in = AccountEmailMessagesTests.class.getResourceAsStream("/" + file)) {
            Properties properties = new Properties();
            properties.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            return properties;
        }
    }

    @Test
    void everyTextExistsInThreeLanguagesAndCarriesTheLink() throws IOException {
        List<String> errors = List.of("error.auth.reset_token_invalid", "error.auth.verification_token_invalid",
                "error.auth.email_already_verified", "error.auth.no_email", "error.auth.reset_link_not_allowed");
        for (String file : List.of("messages.properties", "messages_en.properties", "messages_ru.properties")) {
            Properties properties = load(file);
            for (String key : errors) {
                assertThat(properties.getProperty(key)).as(file + ": " + key).isNotBlank();
            }
            assertThat(properties.getProperty("email.account.footer")).as(file).isNotBlank();
            for (String kind : List.of("verify_email", "reset_password")) {
                assertThat(properties.getProperty("email." + kind + ".subject")).as(file + ": " + kind)
                        .startsWith("Jeparla: ");
                String body = new MessageFormat(properties.getProperty("email." + kind + ".body"), Locale.ROOT)
                        .format(new Object[] {LINK, "60"});
                assertThat(body).as(file + ": " + kind).contains("\n" + LINK + "\n").contains("60");
            }
        }
    }

    @Test
    void linksPointToTheSiteInTheAccountLanguageWithTheTokenInTheFragment() {
        AccountLinks links = new AccountLinks(new SupportProperties("", "", "/help", "https://jeparla.az/"));
        assertThat(links.verifyEmail(Language.EN, "abc")).isEqualTo("https://jeparla.az/en/verify-email#token=abc");
        assertThat(links.resetPassword(Language.RU, "abc")).isEqualTo(LINK);
    }

    @Test
    void lifetimesMustBePositive() {
        assertThat(new AccountEmailProperties(Duration.ofHours(24), Duration.ofHours(1), Duration.ZERO).resetTtl())
                .isEqualTo(Duration.ofHours(1));
        assertThatThrownBy(() -> new AccountEmailProperties(Duration.ZERO, Duration.ofHours(1), Duration.ZERO))
                .hasMessageContaining("verification-ttl");
        assertThatThrownBy(() -> new AccountEmailProperties(Duration.ofHours(24), null, Duration.ZERO))
                .hasMessageContaining("reset-ttl");
        assertThatThrownBy(() -> new AccountEmailProperties(Duration.ofHours(24), Duration.ofHours(1),
                Duration.ofSeconds(10))).hasMessageContaining("forgot-response-floor");
    }
}
