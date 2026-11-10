package az.jeparla.verification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Confirms an uploaded document (#138). {@code declarationAccepted} must be true: the seller ticked the
 * declaration ({@code GET /merchant/documents/declaration}) of {@code declarationVersion}, shown in
 * {@code declarationLanguage} (default: the request language).
 */
public record DocumentConfirmRequest(
        @NotBlank @Size(max = 200) String key,
        Boolean declarationAccepted,
        @Size(max = 64) String declarationVersion,
        @Pattern(regexp = "az|en|ru") String declarationLanguage) {

    public boolean accepted() {
        return Boolean.TRUE.equals(declarationAccepted);
    }
}
