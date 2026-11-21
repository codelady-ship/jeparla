package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Sets the video of a product ({@code PUT /api/v1/merchant/products/{id}/video}, #117) from the key of a video
 * upload.
 *
 * @param aiGenerated the video was generated or edited with AI: it is labelled on the product page (CLAUDE.md);
 *                    optional, false when absent
 */
public record VideoAttachRequest(@NotBlank @Size(max = 200) String key, Boolean aiGenerated) {

    /** Absent means not AI-generated. */
    public boolean isAiGenerated() {
        return Boolean.TRUE.equals(aiGenerated);
    }
}
