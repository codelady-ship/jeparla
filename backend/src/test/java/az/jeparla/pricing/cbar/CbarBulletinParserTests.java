package az.jeparla.pricing.cbar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.product.Metal;
import az.jeparla.support.CbarStub;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The CBAR bulletin parser (#43) on real bulletins saved from https://www.cbar.az/currencies/ on
 * 10.11.2026 ({@code src/test/resources/cbar/}) and on broken ones. Nothing partial is ever accepted.
 */
class CbarBulletinParserTests {

    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 9);

    private static byte[] fixture(String name) {
        return CbarStub.bytes("cbar/" + name);
    }

    private static CbarBulletin parse(String xml, LocalDate requested) {
        return CbarBulletinParser.parse(xml.getBytes(StandardCharsets.UTF_8), requested);
    }

    /** A bulletin with the four metals; {@code metals} replaces the metal block. */
    private static String bulletin(String date, String metals) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <ValCurs Date="%s" Name="AZN məzənnələri">
                    <ValType Type="Bank metalları">%s</ValType>
                    <ValType Type="Xarici valyutalar">
                        <Valute Code="USD"><Nominal>1</Nominal><Name>1 ABŞ dolları</Name><Value>1.7</Value></Valute>
                    </ValType>
                </ValCurs>
                """.formatted(date, metals);
    }

    private static String valute(String code, String nominal, String value) {
        return "<Valute Code=\"%s\"><Nominal>%s</Nominal><Name>x</Name><Value>%s</Value></Valute>"
                .formatted(code, nominal, value);
    }

    private static String metals(String gold) {
        return valute("XPD", "1 t.u.", "1741.1145") + valute("XPT", "1 t.u.", "2580.175")
                + valute("XAG", "1 t.u.", "87.6642") + gold;
    }

    @Test
    void readsTheRealBulletinOfABusinessDay() {
        CbarBulletin bulletin = CbarBulletinParser.parse(fixture("cbar-2026-11-06.xml"), LocalDate.of(2026, 11, 6));
        assertThat(bulletin.date()).isEqualTo(LocalDate.of(2026, 11, 6));
        assertThat(bulletin.ouncePrices()).containsExactlyInAnyOrderEntriesOf(java.util.Map.of(
                Metal.GOLD, new BigDecimal("6877.435"),
                Metal.SILVER, new BigDecimal("87.6642"),
                Metal.PLATINUM, new BigDecimal("2580.175"),
                Metal.PALLADIUM, new BigDecimal("1741.1145")));
    }

    @Test
    void readsAnotherRealBulletin() {
        CbarBulletin bulletin = CbarBulletinParser.parse(fixture("cbar-2026-11-05.xml"), LocalDate.of(2026, 11, 5));
        assertThat(bulletin.date()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(bulletin.ouncePrices().get(Metal.GOLD)).isEqualByComparingTo("7034.7105");
    }

    @Test
    void weekendAnswerKeepsTheDateOfTheLastBulletin() {
        // Asked for Saturday 31.10.2026, CBAR answered with the bulletin of Friday 30.10.2026.
        CbarBulletin bulletin = CbarBulletinParser.parse(fixture("cbar-2026-10-30.xml"), LocalDate.of(2026, 10, 31));
        assertThat(bulletin.date()).isEqualTo(LocalDate.of(2026, 10, 30));
        assertThat(bulletin.ouncePrices().get(Metal.GOLD)).isEqualByComparingTo("6796.43");
        // A holiday answer (here: four days later, the bulletin of 06.11 asked for 10.11) is fine too.
        assertThat(CbarBulletinParser.parse(fixture("cbar-2026-11-06.xml"), LocalDate.of(2026, 11, 10)).date())
                .isEqualTo(LocalDate.of(2026, 11, 6));
    }

    @Test
    void refusesAMissingMetal() {
        String xml = bulletin("09.11.2026", valute("XPD", "1 t.u.", "1741.1145") + valute("XAG", "1 t.u.", "87.66")
                + valute("XAU", "1 t.u.", "6877.435"));
        assertThatThrownBy(() -> parse(xml, MONDAY)).isInstanceOf(CbarFeedException.class)
                .hasMessageContaining("XPT (PLATINUM) is missing")
                .satisfies(e -> assertThat(((CbarFeedException) e).isRetryable()).isFalse());
    }

    @Test
    void refusesARepeatedMetal() {
        String xml = bulletin("09.11.2026", metals(valute("XAU", "1 t.u.", "6877.435") + valute("XAU", "1 t.u.", "1")));
        assertThatThrownBy(() -> parse(xml, MONDAY)).hasMessageContaining("XAU appears more than once");
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "0.0000", "-6877.435", "", "abc", "6 877,435", "6877,435", "6.877435e3", "6877.43512",
            "+6877.435", "12345678901.5", "NaN"})
    void refusesAValueThatIsNotAPositiveDecimal(String value) {
        String xml = bulletin("09.11.2026", metals(valute("XAU", "1 t.u.", value)));
        assertThatThrownBy(() -> parse(xml, MONDAY)).isInstanceOf(CbarFeedException.class).hasMessageContaining("XAU");
    }

    @Test
    void acceptsWhitespaceAroundTheValue() {
        String xml = bulletin("09.11.2026", metals(valute("XAU", " 1 t.u. ", "\n   6877.435\n ")));
        assertThat(parse(xml, MONDAY).ouncePrices().get(Metal.GOLD)).isEqualByComparingTo("6877.435");
    }

    @ParameterizedTest
    @ValueSource(strings = {"1 qram", "10 t.u.", "1", ""})
    void refusesAnotherUnit(String nominal) {
        String xml = bulletin("09.11.2026", metals(valute("XAU", nominal, "6877.435")));
        assertThatThrownBy(() -> parse(xml, MONDAY)).hasMessageContaining("XAU nominal");
    }

    @Test
    void refusesAValuteWithoutValue() {
        String xml = bulletin("09.11.2026", metals("<Valute Code=\"XAU\"><Nominal>1 t.u.</Nominal></Valute>"));
        assertThatThrownBy(() -> parse(xml, MONDAY)).hasMessageContaining("XAU has no <Value>");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "2026-11-09", "31.11.2026", "9.11.2026", "09/11/2026"})
    void refusesAMissingOrInvalidDate(String date) {
        String xml = bulletin(date, metals(valute("XAU", "1 t.u.", "6877.435")));
        assertThatThrownBy(() -> parse(xml, MONDAY)).isInstanceOf(CbarFeedException.class)
                .hasMessageContaining("Date");
    }

    @Test
    void refusesABulletinFromTheFutureOrTooOld() {
        String tomorrow = bulletin("10.11.2026", metals(valute("XAU", "1 t.u.", "6877.435")));
        assertThatThrownBy(() -> parse(tomorrow, MONDAY)).hasMessageContaining("after the requested date");
        String old = bulletin("09.10.2026", metals(valute("XAU", "1 t.u.", "6877.435")));
        assertThatThrownBy(() -> parse(old, MONDAY)).hasMessageContaining("more than 30 days");
        assertThat(parse(bulletin("10.10.2026", metals(valute("XAU", "1 t.u.", "6877.435"))), MONDAY).date())
                .isEqualTo(LocalDate.of(2026, 10, 10));
    }

    @Test
    void refusesWhatIsNotABulletin() {
        assertThatThrownBy(() -> CbarBulletinParser.parse(new byte[0], MONDAY)).hasMessageContaining("empty");
        assertThatThrownBy(() -> parse("<html><body>Home</body></html>", MONDAY))
                .hasMessageContaining("root element is <html>");
        assertThatThrownBy(() -> parse("<ValCurs Date=\"09.11.2026\"><Valute", MONDAY))
                .hasMessageContaining("not well-formed");
        assertThatThrownBy(() -> parse("not xml at all", MONDAY)).hasMessageContaining("not well-formed");
    }

    @Test
    void refusesDoctypesAndExternalEntities() {
        String xxe = """
                <?xml version="1.0"?>
                <!DOCTYPE ValCurs [<!ENTITY gold SYSTEM "file:///etc/passwd">]>
                <ValCurs Date="09.11.2026"><ValType><Valute Code="XAU"><Nominal>1 t.u.</Nominal>
                <Value>&gold;</Value></Valute></ValType></ValCurs>
                """;
        assertThatThrownBy(() -> parse(xxe, MONDAY)).isInstanceOf(CbarFeedException.class)
                .hasMessageContaining("not well-formed");
    }
}
