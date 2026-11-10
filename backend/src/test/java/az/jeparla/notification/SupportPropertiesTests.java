package az.jeparla.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.i18n.Language;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class SupportPropertiesTests {

    @Test
    void contactIsTheEmailAndTheUrl() {
        SupportProperties both = new SupportProperties(" destek@jeparla.az ", "https://jeparla.az/az/help", "/help");
        assertThat(both.hasContact()).isTrue();
        assertThat(both.contact()).isEqualTo("destek@jeparla.az, https://jeparla.az/az/help");
        assertThat(new SupportProperties("destek@jeparla.az", "", "/help").contact()).isEqualTo("destek@jeparla.az");
        assertThat(new SupportProperties("", "https://wa.me/994500000000", "/help").contact())
                .isEqualTo("https://wa.me/994500000000");
    }

    @Test
    void withoutContactTheHelpPageIsUsed() {
        SupportProperties none = new SupportProperties("", "", "/help");
        assertThat(none.hasContact()).isFalse();
        assertThat(none.contact()).isEmpty();
        assertThat(none.helpPath()).isEqualTo("/help");
    }

    @Test
    void wrongValuesStopTheStart() {
        assertThatThrownBy(() -> new SupportProperties("not-an-email", "", "/help"))
                .hasMessageContaining("jeparla.support.email");
        assertThatThrownBy(() -> new SupportProperties("", "javascript:alert(1)", "/help"))
                .hasMessageContaining("jeparla.support.url");
        assertThatThrownBy(() -> new SupportProperties("", "jeparla.az/help", "/help"))
                .hasMessageContaining("jeparla.support.url");
        assertThatThrownBy(() -> new SupportProperties("", "", "https://evil.example/help"))
                .hasMessageContaining("jeparla.support.help-path");
    }

    @Test
    void languageOfALocale() {
        assertThat(Language.of(Locale.forLanguageTag("ru"))).isEqualTo(Language.RU);
        assertThat(Language.of(Locale.forLanguageTag("en-GB"))).isEqualTo(Language.EN);
        assertThat(Language.of(Locale.forLanguageTag("tr"))).isEqualTo(Language.AZ);
    }
}
