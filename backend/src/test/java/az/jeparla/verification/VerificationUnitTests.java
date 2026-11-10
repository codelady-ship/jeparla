package az.jeparla.verification;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.common.i18n.Language;
import az.jeparla.notification.NotificationKind;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.support.ResourceBundleMessageSource;

/** Document checks without a database (#40, #138): file types, check status, file names and the texts. */
class VerificationUnitTests {

    // ------------------------------------------------------------------ file type

    @Test
    void theTypeComesFromTheFirstBytes() {
        assertThat(DocumentProbe.contentType("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII)))
                .contains("application/pdf");
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13, 'I', 'H', 'D', 'R'};
        assertThat(DocumentProbe.contentType(png)).contains("image/png");
        assertThat(DocumentProbe.contentType(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}))
                .contains("image/jpeg");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "%PDF", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "<html>%PDF-1.4</html>",
            " %PDF-1.4", "GIF89a", "PK\u0003\u0004"})
    void anythingElseIsNoDocument(String start) {
        assertThat(DocumentProbe.contentType(start.getBytes(StandardCharsets.ISO_8859_1))).isEmpty();
    }

    @Test
    void aTruncatedPngIsNoDocument() {
        assertThat(DocumentProbe.contentType(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}))
                .isEmpty();
        assertThat(DocumentProbe.contentType(null)).isEmpty();
    }

    // ------------------------------------------------------------------ check status

    @Test
    void onlyAnApprovedDocumentVerifiesACheck() {
        assertThat(VerificationChecks.resolve(List.of())).isEqualTo(CheckStatus.NONE);
        assertThat(VerificationChecks.resolve(List.of(DocumentStatus.PENDING))).isEqualTo(CheckStatus.PENDING);
        assertThat(VerificationChecks.resolve(List.of(DocumentStatus.REJECTED, DocumentStatus.CHANGES_REQUESTED)))
                .isEqualTo(CheckStatus.REJECTED);
        assertThat(VerificationChecks.resolve(List.of(DocumentStatus.REJECTED, DocumentStatus.PENDING)))
                .isEqualTo(CheckStatus.PENDING);
        assertThat(VerificationChecks.resolve(EnumSet.allOf(DocumentStatus.class))).isEqualTo(CheckStatus.VERIFIED);
        for (DocumentStatus status : EnumSet.complementOf(EnumSet.of(DocumentStatus.VERIFIED))) {
            assertThat(VerificationChecks.resolve(List.of(status))).isNotEqualTo(CheckStatus.VERIFIED);
        }
    }

    // ------------------------------------------------------------------ file names and keys

    @Test
    void fileNamesLoseSeparatorsAndControlCharacters() {
        assertThat(MerchantDocumentService.safeFileName("../../etc/passwd")).isEqualTo(".._.._etc_passwd");
        assertThat(MerchantDocumentService.safeFileName("a\\b\u0000c\nd.pdf")).isEqualTo("a_b_c_d.pdf");
        assertThat(MerchantDocumentService.safeFileName("  VÖEN çıxarışı.pdf ")).isEqualTo("VÖEN çıxarışı.pdf");
        assertThat(MerchantDocumentService.prefix(42)).isEqualTo("documents/42/");
        assertThat(MerchantDocumentService.EXTENSIONS).containsOnlyKeys("application/pdf", "image/jpeg", "image/png");
    }

    // ------------------------------------------------------------------ texts

    private static ResourceBundleMessageSource messages() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return source;
    }

    @Test
    void theDeclarationNamesCriminalLiabilityInEveryLanguage() {
        DeclarationText text = new DeclarationText(messages());
        assertThat(text.text(Language.AZ)).contains("Cinayət Məcəlləsinə").contains("əyar damğası");
        assertThat(text.text(Language.EN)).contains("including the Criminal Code").contains("assay hallmark");
        assertThat(text.text(Language.RU)).contains("включая Уголовный кодекс").contains("пробирное клеймо");
        assertThat(DeclarationText.VERSION).hasSizeBetween(1, 64).endsWith("-draft");
        assertThat(DeclarationText.DRAFT).as("draft until the lawyer approves it (#57)").isTrue();
    }

    private static Properties load(String file) throws IOException {
        Properties properties = new Properties();
        try (InputStream in = VerificationUnitTests.class.getResourceAsStream("/" + file)) {
            assertThat(in).as(file).isNotNull();
            properties.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        return properties;
    }

    @Test
    void reasonsAndNotificationsExistInAzEnAndRu() throws IOException {
        List<String> keys = new ArrayList<>(List.of(DeclarationText.KEY, "notification.note",
                "notification.email.footer", "notification.support", "notification.support.help"));
        Arrays.stream(RejectReason.values()).forEach(reason -> keys.add("verification.reason." + reason.name()));
        for (NotificationKind kind : NotificationKind.values()) {
            keys.add(kind.messageKey() + ".title");
            keys.add(kind.messageKey() + ".body");
        }
        for (String file : List.of("messages.properties", "messages_en.properties", "messages_ru.properties")) {
            Properties properties = load(file);
            for (String key : keys) {
                assertThat(properties.getProperty(key)).as(file + ": " + key).isNotBlank();
            }
            // #138: no review within a deadline is promised until an appeal flow exists.
            for (NotificationKind kind : NotificationKind.values()) {
                assertThat(properties.getProperty(kind.messageKey() + ".body")).as(file + ": " + kind)
                        .doesNotContain("14");
            }
        }
    }

    @Test
    void everyErrorCodeOfTheFeatureIsTranslated() throws IOException {
        Properties az = load("messages.properties");
        List<String> codes = az.stringPropertyNames().stream()
                .filter(key -> key.startsWith("error.verification.") || key.startsWith("error.admin.")
                        || key.startsWith("error.notifications."))
                .toList();
        assertThat(codes).contains("error.verification.not_precious", "error.verification.declaration_required",
                "error.verification.declaration_outdated", "error.admin.declaration_missing");
        for (String file : List.of("messages_en.properties", "messages_ru.properties")) {
            Properties properties = load(file);
            for (String code : codes) {
                assertThat(properties.getProperty(code)).as(file + ": " + code).isNotBlank();
            }
        }
    }
}
