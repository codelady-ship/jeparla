package az.jeparla.merchant.dto;

import az.jeparla.product.ProductStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /api/v1/merchant/products/bulk-status} (#109): the same status change as
 * {@code PATCH /products/{id}/status} for up to {@value #MAX_IDS} of the seller's own products, e.g. send the
 * selected drafts to review. Each product is changed on its own: one that cannot change does not stop the others.
 */
public record BulkStatusRequest(
        @NotEmpty @Size(max = MAX_IDS) List<@NotNull @Positive Long> ids,
        @NotNull ProductStatus status) {

    public static final int MAX_IDS = 100;
}
