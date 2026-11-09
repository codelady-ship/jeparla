package az.jeparla.common.dto;

import az.jeparla.common.i18n.Language;
import az.jeparla.common.i18n.LocalizedText;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Text in all three languages ({@code LocalizedText} in frontend/src/types/api.ts). Responses always
 * carry az, en and ru: a missing translation is the Azerbaijani text, and missing text is empty.
 * Accept-Language never changes data, only error messages.
 */
@Schema(name = "LocalizedText", requiredProperties = {"az", "en", "ru"})
public record LocalizedTextDto(String az, String en, String ru) {

    private static final LocalizedTextDto EMPTY = new LocalizedTextDto("", "", "");

    public static LocalizedTextDto of(LocalizedText text) {
        if (text == null || text.az() == null) {
            return EMPTY;
        }
        return new LocalizedTextDto(text.az(), text.in(Language.EN), text.in(Language.RU));
    }

    /** {@code text}, or {@code fallback} when the text is missing (e.g. image alt -> product name). */
    public static LocalizedTextDto of(LocalizedText text, LocalizedText fallback) {
        return text == null || text.az() == null || text.az().isBlank() ? of(fallback) : of(text);
    }
}
