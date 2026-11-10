package az.jeparla.merchant.dto;

import az.jeparla.common.i18n.LocalizedText;
import jakarta.validation.constraints.Size;

/** Product description in three languages, all optional. */
public record DescriptionRequest(
        @Size(max = 2000) String az,
        @Size(max = 2000) String en,
        @Size(max = 2000) String ru) {

    /** Null when every language is blank (Hibernate stores the embedded text as three NULLs). */
    public LocalizedText toText() {
        String a = LocalizedTextRequest.blankToNull(az);
        String e = LocalizedTextRequest.blankToNull(en);
        String r = LocalizedTextRequest.blankToNull(ru);
        if (a == null && e == null && r == null) {
            return null;
        }
        // The Azerbaijani text is the fallback of the others: a translation alone is kept as az too.
        return LocalizedText.of(a != null ? a : e != null ? e : r, e, r);
    }
}
