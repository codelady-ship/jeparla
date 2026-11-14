package az.jeparla.store;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/** "Near me" points, map links and distances (#116). */
class GeoPointTests {

    private static GeoPoint point(String latitude, String longitude) {
        return new GeoPoint(new BigDecimal(latitude), new BigDecimal(longitude));
    }

    @Test
    void theNearParameterIsALatitudeLongitudePair() {
        assertThat(GeoPoint.parse("40.4093,49.8671")).contains(point("40.409300", "49.867100"));
        assertThat(GeoPoint.parse(" 40.4093 , 49.8671 ")).contains(point("40.4093", "49.8671"));
        assertThat(GeoPoint.parse("40.40926172,49.86709211")).contains(point("40.409262", "49.867092"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "40.4", "91,49", "40,181", "abc,def", "40.4;49.8", "40.4,49.8,1"})
    void invalidPairsAreRefused(String pair) {
        assertThat(GeoPoint.parse(pair)).isEmpty();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "https://www.google.com/maps/place/Nizami/@40.3777,49.8414,17z/data=!3m1   | 40.377700 | 49.841400",
            "https://www.google.com/maps/place/X/data=!3m1!4b1!4m6!3m5!3d40.3777!4d49.8414 | 40.377700 | 49.841400",
            "https://maps.google.com/?q=40.3777,49.8414                                  | 40.377700 | 49.841400",
            "https://yandex.az/maps/?ll=49.8414%2C40.3777&z=17                            | 40.377700 | 49.841400",
            "https://yandex.ru/maps/?pt=49.8414,40.3777&z=17                              | 40.377700 | 49.841400",
            "40.3777, 49.8414                                                             | 40.377700 | 49.841400"})
    void mapLinksOfGoogleAndYandex(String link, String latitude, String longitude) {
        assertThat(GeoPoint.fromMapLink(link)).contains(point(latitude, longitude));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://maps.app.goo.gl/abc123", "https://yandex.az/maps/-/CDabc", "Nizami küçəsi 1"})
    void shortLinksAndAddressesHaveNoCoordinates(String link) {
        assertThat(GeoPoint.fromMapLink(link)).isEmpty();
    }

    @Test
    void distancesInKilometresToOneDecimal() {
        GeoPoint fountainSquare = point("40.3777", "49.8414");
        assertThat(fountainSquare.distanceKm(fountainSquare)).isEqualByComparingTo("0.0");
        // Baku to Ganja, about 300 km in a straight line.
        BigDecimal ganja = fountainSquare.distanceKm(point("40.6828", "46.3606"));
        assertThat(ganja).isBetween(new BigDecimal("290"), new BigDecimal("300"));
        assertThat(ganja.scale()).isEqualTo(1);
    }
}
