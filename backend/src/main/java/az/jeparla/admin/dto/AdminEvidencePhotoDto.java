package az.jeparla.admin.dto;

import az.jeparla.product.EvidenceKind;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.ProductStatus;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * A hallmark or label photo in the admin check (#106), with the product data it is compared with.
 *
 * @param finenesses   distinct fineness values of the product's live variants (e.g. 585), ascending
 * @param weightsGrams distinct weights of the live variants as decimal strings, ascending
 * @param checkNote    the admin's reason (REJECTED) or note (VERIFIED); null when none
 */
@Schema(name = "AdminEvidencePhoto", requiredProperties = {"id", "kind", "url", "width", "height", "status",
        "checkNote", "checkedAt", "createdAt", "productId", "productSlug", "productName", "productStatus",
        "materialKind", "metal", "finenesses", "weightsGrams", "storeId", "storeName"})
public record AdminEvidencePhotoDto(long id, EvidenceKind kind, String url, int width, int height, CheckStatus status,
        @Schema(nullable = true) String checkNote, @Schema(nullable = true) Instant checkedAt, Instant createdAt,
        long productId, String productSlug, String productName, ProductStatus productStatus,
        MaterialKind materialKind, @Schema(nullable = true) Metal metal, List<Integer> finenesses,
        List<String> weightsGrams, long storeId, String storeName) {
}
