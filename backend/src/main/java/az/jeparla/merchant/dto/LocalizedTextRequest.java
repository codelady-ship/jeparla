package az.jeparla.merchant.dto;

import az.jeparla.common.i18n.LocalizedText;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Product name in three languages: Azerbaijani is required, en and ru fall back to it. */
public record LocalizedTextRequest(
        @NotBlank @Size(min = 3, max = 120) String az,
        @Size(max = 120) String en,
        @Size(max = 120) String ru) {

    public LocalizedText toText() {
        return LocalizedText.of(az.strip(), blankToNull(en), blankToNull(ru));
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
