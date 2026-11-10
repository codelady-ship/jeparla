package az.jeparla.store;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Store coordinates follow the {@code NUMERIC(9,6)} column like money follows its column (#126). */
class StoreGeoTests {

    private final Store store = new Store(null, "store", "Store", "Bakı", "Nizami 1", "+994500000001",
            LegalType.COMPANY, "1234567890");

    @Test
    void coordinatesAreBroughtToSixDecimals() {
        store.setGeo(new BigDecimal("40.4"), new BigDecimal("49"));
        assertThat(store.getLatitude()).isEqualTo(new BigDecimal("40.400000"));
        assertThat(store.getLongitude()).isEqualTo(new BigDecimal("49.000000"));
    }

    @Test
    void sixDecimalsAreKeptAsTheyAre() {
        store.setGeo(new BigDecimal("40.409262"), new BigDecimal("-179.999999"));
        assertThat(store.getLatitude()).isEqualTo(new BigDecimal("40.409262"));
        assertThat(store.getLongitude()).isEqualTo(new BigDecimal("-179.999999"));
    }

    @Test
    void moreDecimalsAreRefusedNotRounded() {
        assertThatThrownBy(() -> store.setGeo(new BigDecimal("40.40926172"), new BigDecimal("49.867092")))
                .isInstanceOf(ArithmeticException.class);
        assertThatThrownBy(() -> store.setGeo(new BigDecimal("40.409262"), new BigDecimal("49.8670921")))
                .isInstanceOf(ArithmeticException.class);
        assertThat(store.getLatitude()).isNull();
    }

    @Test
    void trailingZerosBeyondTheScaleAreNotRounding() {
        store.setGeo(new BigDecimal("40.40926200"), new BigDecimal("49.86709200"));
        assertThat(store.getLatitude()).isEqualTo(new BigDecimal("40.409262"));
    }

    @ParameterizedTest
    @CsvSource({"90.000001, 0", "-90.5, 0", "0, 180.000001", "0, -181"})
    void outOfRangeIsRefused(String latitude, String longitude) {
        assertThatThrownBy(() -> store.setGeo(new BigDecimal(latitude), new BigDecimal(longitude)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void edgesOfTheRangeAreAccepted() {
        store.setGeo(new BigDecimal("-90"), new BigDecimal("180"));
        assertThat(store.getLatitude()).isEqualTo(new BigDecimal("-90.000000"));
        assertThat(store.getLongitude()).isEqualTo(new BigDecimal("180.000000"));
    }

    @Test
    void bothOrNeither() {
        assertThatThrownBy(() -> store.setGeo(new BigDecimal("40.4"), null))
                .isInstanceOf(IllegalArgumentException.class);
        store.setGeo(new BigDecimal("40.4"), new BigDecimal("49.8"));
        store.setGeo(null, null);
        assertThat(store.getLatitude()).isNull();
        assertThat(store.getLongitude()).isNull();
    }
}
