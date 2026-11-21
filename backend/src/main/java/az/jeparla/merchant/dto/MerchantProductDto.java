package az.jeparla.merchant.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.product.Audience;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.ProductStatus;
import az.jeparla.product.dto.DimensionsDto;
import az.jeparla.product.dto.StoneDto;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * A product of the seller's store with everything the edit form needs.
 *
 * @param hiddenBySeller   the seller hid it (INACTIVE): {@code PATCH status APPROVED} shows it again
 * @param expertiseStatus  always NONE for FASHION (#128)
 * @param audience         who the piece is for (#121)
 */
@Schema(name = "MerchantProduct")
public record MerchantProductDto(
        long id,
        String slug,
        ProductStatus status,
        @Schema(nullable = true) String reviewNote,
        boolean hiddenBySeller,
        MaterialKind materialKind,
        Audience audience,
        long categoryId,
        LocalizedTextDto name,
        LocalizedTextDto description,
        @Schema(nullable = true) Metal metal,
        @Schema(nullable = true) FashionMaterial material,
        @Schema(nullable = true) Instant notPreciousConfirmedAt,
        CheckStatus expertiseStatus,
        @Schema(nullable = true) Instant submittedAt,
        @Schema(nullable = true) Instant publishedAt,
        Instant updatedAt,
        List<MerchantImageDto> images,
        List<MerchantVariantDto> variants,
        List<StoneDto> stones,
        @Schema(description = "Hallmark and label photos (#106), at most one of each kind")
        List<MerchantEvidencePhotoDto> evidencePhotos,
        @Schema(nullable = true, description = "Sizes in mm (#174); null when none") DimensionsDto dimensions,
        @Schema(description = "Up to 5 key features (#174)") List<String> keyFeatures,
        @Schema(description = "Occasion collections (#115) it is tagged with, hidden ones too, by id")
        List<Long> collectionIds,
        @Schema(nullable = true, description = "The short video (#117); null when none") MerchantVideoDto video) {
}
