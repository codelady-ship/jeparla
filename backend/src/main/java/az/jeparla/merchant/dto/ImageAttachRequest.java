package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Attaches an uploaded file to the product ({@code POST /api/v1/merchant/products/{id}/images}).
 *
 * @param aiGenerated the photo was generated or edited with AI: it is labelled in the catalog (CLAUDE.md)
 */
public record ImageAttachRequest(
        @NotBlank @Size(max = 200) String key,
        @Size(max = 200) String altAz,
        @Size(max = 200) String altEn,
        @Size(max = 200) String altRu,
        boolean aiGenerated) {
}
