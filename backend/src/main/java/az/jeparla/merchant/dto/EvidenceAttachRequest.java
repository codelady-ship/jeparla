package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Sets the hallmark or label photo of a product ({@code PUT /api/v1/merchant/products/{id}/evidence/{kind}}, #106)
 * from the key of an evidence upload. No {@code aiGenerated}: evidence is a photo of the piece itself.
 */
public record EvidenceAttachRequest(@NotBlank @Size(max = 200) String key) {
}
