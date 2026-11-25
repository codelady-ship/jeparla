package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Attaches an uploaded file to the product ({@code POST /api/v1/merchant/products/{id}/images}).
 *
 * @param aiGenerated  the photo was generated or edited with AI: it is labelled in the catalog (CLAUDE.md); optional, false when absent
 * @param tryOnModelId optional AI model the seller picked: when this becomes the product's first original photo,
 *                     an on-model image with that model is queued (it still waits for the seller's approval)
 */
public record ImageAttachRequest(
        @NotBlank @Size(max = 200) String key,
        @Size(max = 200) String altAz,
        @Size(max = 200) String altEn,
        @Size(max = 200) String altRu,
        Boolean aiGenerated,
        @Positive Long tryOnModelId) {

    /** Absent means not AI-generated. */
    public boolean isAiGenerated() {
        return Boolean.TRUE.equals(aiGenerated);
    }
}
