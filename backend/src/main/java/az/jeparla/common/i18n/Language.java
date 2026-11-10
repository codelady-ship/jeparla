package az.jeparla.common.i18n;

import java.util.Locale;

/** The three Jeparla languages (CLAUDE.md). Stored as the lowercase code: {@code az}, {@code en}, {@code ru}. */
public enum Language {
    AZ,
    EN,
    RU;

    /** Lowercase language code, as in {@code users.preferred_locale} and {@code Accept-Language}. */
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** The language of {@code locale}; Azerbaijani for any other language (as the message files do). */
    public static Language of(Locale locale) {
        for (Language language : values()) {
            if (language.code().equals(locale.getLanguage())) {
                return language;
            }
        }
        return AZ;
    }

    public static Language fromCode(String code) {
        for (Language language : values()) {
            if (language.code().equals(code)) {
                return language;
            }
        }
        throw new IllegalArgumentException("Unknown language code: " + code);
    }
}
