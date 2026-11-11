package az.jeparla.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** SMTP relay settings (#131): off without a host, a sender address required with one, the password never shown. */
class SmtpPropertiesTests {

    @Test
    void withoutAHostNothingIsSent() {
        SmtpProperties none = new SmtpProperties("", 587, "", "", "");
        assertThat(none.enabled()).isFalse();
    }

    @Test
    void aHostNeedsASenderAddress() {
        assertThatThrownBy(() -> new SmtpProperties("smtp.example.com", 587, "user", "key", ""))
                .hasMessageContaining("jeparla.mail.from");
        assertThatThrownBy(() -> new SmtpProperties("smtp.example.com", 587, "user", "key", "no-reply"))
                .hasMessageContaining("jeparla.mail.from");
        assertThatThrownBy(() -> new SmtpProperties("smtp.example.com", 0, "user", "key", "no-reply@jeparla.az"))
                .hasMessageContaining("jeparla.mail.port");

        SmtpProperties named = new SmtpProperties(" smtp.example.com ", 587, "user", "key",
                "Jeparla <no-reply@jeparla.az>");
        assertThat(named.enabled()).isTrue();
        assertThat(named.host()).isEqualTo("smtp.example.com");
        assertThat(new SmtpProperties("smtp.example.com", 587, "", "", "no-reply@jeparla.az").enabled()).isTrue();
    }

    @Test
    void thePasswordIsNeverPrinted() {
        SmtpProperties smtp = new SmtpProperties("smtp.example.com", 587, "apikey", "s3cr3t-key",
                "no-reply@jeparla.az");
        assertThat(smtp.toString()).doesNotContain("s3cr3t-key").doesNotContain("apikey");
    }

    @Test
    void theSenderUsesTheRelay() {
        SmtpEmailSender sender = SmtpEmailSender.of(
                new SmtpProperties("smtp.example.com", 587, "user", "key", "no-reply@jeparla.az"));
        assertThat(sender.enabled()).isTrue();
    }
}
