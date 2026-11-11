package az.jeparla.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.i18n.Language;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class SupportPropertiesTests {

    private static final String SITE = "https://jeparla.az";

    @Test
    void contactIsTheEmailAndTheUrl() {
        SupportProperties both = new SupportProperties(" destek@jeparla.az ", "https://jeparla.az/az/help", "/help",
                SITE);
        assertThat(both.hasContact()).isTrue();
        assertThat(both.contact()).isEqualTo("destek@jeparla.az, https://jeparla.az/az/help");
        assertThat(new SupportProperties("destek@jeparla.az", "", "/help", SITE).contact())
                .isEqualTo("destek@jeparla.az");
        assertThat(new SupportProperties("", "https://wa.me/994500000000", "/help", SITE).contact())
                .isEqualTo("https://wa.me/994500000000");
    }

    @Test
    void withoutContactTheHelpPageIsUsed() {
        SupportProperties none = new SupportProperties("", "", "/help", SITE);
        assertThat(none.hasContact()).isFalse();
        assertThat(none.contact()).isEmpty();
        assertThat(none.helpPath()).isEqualTo("/help");
    }

    @Test
    void theHelpPageIsInTheLanguageAndAbsoluteForEmails() {
        SupportProperties none = new SupportProperties("", "", "/help", " https://jeparla.az/ ");
        assertThat(none.siteUrl()).isEqualTo(SITE);
        assertThat(none.helpPath(Language.AZ)).isEqualTo("/az/help");
        assertThat(none.helpPath(Language.RU)).isEqualTo("/ru/help");
        assertThat(none.helpUrl(Language.AZ)).isEqualTo("https://jeparla.az/az/help");
        assertThat(none.helpUrl(Language.EN)).isEqualTo("https://jeparla.az/en/help");
        assertThat(none.helpUrl(Language.RU)).isEqualTo("https://jeparla.az/ru/help");
        assertThat(new SupportProperties("", "", "/help", "http://localhost:3000").helpUrl(Language.EN))
                .isEqualTo("http://localhost:3000/en/help");
    }

    @Test
    void wrongValuesStopTheStart() {
        assertThatThrownBy(() -> new SupportProperties("not-an-email", "", "/help", SITE))
                .hasMessageContaining("jeparla.support.email");
        assertThatThrownBy(() -> new SupportProperties("", "javascript:alert(1)", "/help", SITE))
                .hasMessageContaining("jeparla.support.url");
        assertThatThrownBy(() -> new SupportProperties("", "jeparla.az/help", "/help", SITE))
                .hasMessageContaining("jeparla.support.url");
        assertThatThrownBy(() -> new SupportProperties("", "", "https://evil.example/help", SITE))
                .hasMessageContaining("jeparla.support.help-path");
        for (String site : new String[] {"", "jeparla.az", "javascript:alert(1)", "https://jeparla.az/az",
                "https://jeparla.az?x=1", "https://user@jeparla.az", "ftp://jeparla.az"}) {
            assertThatThrownBy(() -> new SupportProperties("", "", "/help", site))
                    .as(site).hasMessageContaining("jeparla.support.site-url");
        }
    }

    @Test
    void languageOfALocale() {
        assertThat(Language.of(Locale.forLanguageTag("ru"))).isEqualTo(Language.RU);
        assertThat(Language.of(Locale.forLanguageTag("en-GB"))).isEqualTo(Language.EN);
        assertThat(Language.of(Locale.forLanguageTag("tr"))).isEqualTo(Language.AZ);
    }
}
