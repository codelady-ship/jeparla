package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PhoneNumbersTests {

    @ParameterizedTest
    @ValueSource(strings = {"+994 50 123 45 67", "994501234567", "050 123 45 67", "501234567", "(050) 123-45-67"})
    void normalizesAzerbaijaniMobiles(String raw) {
        assertThat(PhoneNumbers.normalize(raw)).isEqualTo("+994501234567");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "12345", "+15551234567", "+994 12 123 45 67", "050 123 45 6", "0501234567890"})
    void rejectsEverythingElse(String raw) {
        assertThat(PhoneNumbers.normalize(raw)).isNull();
    }
}
