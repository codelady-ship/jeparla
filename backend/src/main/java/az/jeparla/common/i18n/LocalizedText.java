package az.jeparla.common.i18n;

import jakarta.persistence.Embeddable;

/**
 * Text in the three Jeparla languages, stored as {@code *_az}, {@code *_en}, {@code *_ru}
 * columns (#32). Azerbaijani is the main language: a missing translation falls back to it.
 * Each use names its columns with {@code @AttributeOverride}.
 *
 * <p>When all three columns are NULL, Hibernate loads the embedded value as {@code null}.
 */
@Embeddable
public record LocalizedText(String az, String en, String ru) {

    public static LocalizedText of(String az, String en, String ru) {
        return new LocalizedText(az, en, ru);
    }

    /** The text in {@code language}, or the Azerbaijani text when that translation is missing. */
    public String in(Language language) {
        String value = switch (language) {
            case AZ -> az;
            case EN -> en;
            case RU -> ru;
        };
        return value == null || value.isBlank() ? az : value;
    }
}
