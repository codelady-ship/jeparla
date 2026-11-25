package az.jeparla.merchant.dto;

import jakarta.validation.constraints.Positive;

/** {@code PUT /api/v1/merchant/products/{id}/metal-sibling}: link the product, or unlink with null (V69). */
public record MetalSiblingRequest(@Positive Long siblingId) {
}
