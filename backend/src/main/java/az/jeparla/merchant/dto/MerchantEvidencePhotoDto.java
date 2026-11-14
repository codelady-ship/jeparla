package az.jeparla.merchant.dto;

import az.jeparla.product.EvidenceKind;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * The hallmark or label photo of a product in the cabinet (#106).
 *
 * @param status    PENDING until an admin compared it with the product data, then VERIFIED or REJECTED
 * @param checkNote the admin's reason for REJECTED (or an optional note); null otherwise
 */
@Schema(name = "MerchantEvidencePhoto", requiredProperties = {"id", "kind", "url", "width", "height", "contentType",
        "sizeBytes", "status", "checkNote", "checkedAt", "createdAt"})
public record MerchantEvidencePhotoDto(long id, EvidenceKind kind, String url, int width, int height,
        String contentType, long sizeBytes, CheckStatus status, @Schema(nullable = true) String checkNote,
        @Schema(nullable = true) Instant checkedAt, Instant createdAt) {
}
