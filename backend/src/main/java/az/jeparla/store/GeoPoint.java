package az.jeparla.store;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A point on the map (#116): a store's coordinates or the buyer's position for "near me". Coordinates are
 * {@link BigDecimal} with at most 6 decimals (about 10 cm, the {@code NUMERIC(9,6)} columns). The buyer's point
 * is only a request parameter: it is never stored or logged.
 */
public record GeoPoint(BigDecimal latitude, BigDecimal longitude) {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);
    private static final double EARTH_RADIUS_KM = 6371.0088;
    private static final String NUMBER = "(-?\\d{1,3}(?:\\.\\d+)?)";
    private static final Pattern PAIR = Pattern.compile("^\\s*" + NUMBER + "\\s*,\\s*" + NUMBER + "\\s*$");

    /** Google Maps: ".../@40.4093,49.8671,17z", "!3d40.4093!4d49.8671", "?q=40.4093,49.8671" (latitude first). */
    private static final Pattern GOOGLE_DATA = Pattern.compile("!3d" + NUMBER + "!4d" + NUMBER);
    private static final Pattern GOOGLE_AT = Pattern.compile("@" + NUMBER + "," + NUMBER);
    private static final Pattern LAT_LNG_QUERY = Pattern.compile(
            "[?&](?:q|query|ll|center|destination)=" + NUMBER + "(?:,|%2C)\\s*" + NUMBER, Pattern.CASE_INSENSITIVE);
    /** Yandex Maps: "?ll=49.8671%2C40.4093" or "pt=49.8671,40.4093" (longitude first). */
    private static final Pattern YANDEX_QUERY = Pattern.compile(
            "[?&](?:ll|pt|whatshere%5Bpoint%5D|whatshere\\[point])=" + NUMBER + "(?:,|%2C)" + NUMBER,
            Pattern.CASE_INSENSITIVE);

    public GeoPoint {
        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException("Both coordinates are required");
        }
        latitude = latitude.setScale(6, RoundingMode.HALF_UP);
        longitude = longitude.setScale(6, RoundingMode.HALF_UP);
        if (latitude.abs().compareTo(MAX_LATITUDE) > 0 || longitude.abs().compareTo(MAX_LONGITUDE) > 0) {
            throw new IllegalArgumentException("Coordinates out of range");
        }
    }

    /** "40.4093,49.8671" (the {@code near} parameter), or empty when it is not a valid pair. */
    public static Optional<GeoPoint> parse(String pair) {
        if (pair == null || pair.length() > 64) {
            return Optional.empty();
        }
        Matcher m = PAIR.matcher(pair);
        return m.matches() ? of(m.group(1), m.group(2)) : Optional.empty();
    }

    /**
     * The point of a map link a seller copies from Google Maps or Yandex Maps, or empty. Short links
     * (maps.app.goo.gl, yandex.az/maps/-/...) carry no coordinates and are not followed: the seller opens the
     * link and copies the full address, or types the coordinates.
     */
    public static Optional<GeoPoint> fromMapLink(String link) {
        if (link == null || link.isBlank() || link.length() > 2000) {
            return Optional.empty();
        }
        String text = link.strip();
        if (text.toLowerCase(Locale.ROOT).contains("yandex.")) {
            Matcher yandex = YANDEX_QUERY.matcher(text);
            return yandex.find() ? of(yandex.group(2), yandex.group(1)) : Optional.empty();
        }
        for (Pattern pattern : new Pattern[] {GOOGLE_DATA, GOOGLE_AT, LAT_LNG_QUERY}) {
            Matcher m = pattern.matcher(text);
            if (m.find()) {
                return of(m.group(1), m.group(2));
            }
        }
        return parse(text);
    }

    private static Optional<GeoPoint> of(String latitude, String longitude) {
        try {
            return Optional.of(new GeoPoint(new BigDecimal(latitude), new BigDecimal(longitude)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /**
     * Great-circle distance in kilometres (haversine), rounded to 0.1 km. A distance on a map is neither money
     * nor weight: the trigonometry is in {@code double} and only the rounded result is a {@link BigDecimal}.
     */
    public BigDecimal distanceKm(GeoPoint other) {
        double lat1 = Math.toRadians(latitude.doubleValue());
        double lat2 = Math.toRadians(other.latitude.doubleValue());
        double dLat = lat2 - lat1;
        double dLon = Math.toRadians(other.longitude.doubleValue() - longitude.doubleValue());
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double km = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
        return new BigDecimal(Double.toString(km)).setScale(1, RoundingMode.HALF_UP);
    }
}
