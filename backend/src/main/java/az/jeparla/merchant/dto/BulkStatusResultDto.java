package az.jeparla.merchant.dto;

import az.jeparla.product.ProductStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/** One product of a bulk status change (#109): its new status, or why it did not change (localized). */
@Schema(name = "MerchantBulkStatusResult", requiredProperties = {"id", "ok"})
public record BulkStatusResultDto(long id, boolean ok, @Schema(nullable = true) ProductStatus status,
        @Schema(nullable = true) String code, @Schema(nullable = true) String message) {
}
