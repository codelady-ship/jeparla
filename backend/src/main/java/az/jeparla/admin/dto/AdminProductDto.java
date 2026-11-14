package az.jeparla.admin.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.product.ProductStatus;
import az.jeparla.product.ProductVariant;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.function.UnaryOperator;

/**
 * A product in the moderation queue (#40). What the card shows comes from the product's cheapest live variant
 * (as {@code priceFrom} of the catalog); values that do not exist are null, never zero: a product without a live
 * variant has no price, a bijouterie product (FASHION) has no metal and no fineness, one without photos no image.
 *
 * @param name             Azerbaijani name (kept for the existing admin pages)
 * @param names            the name in az, en and ru
 * @param priceFrom        price of the cheapest live variant (decimal string + currency), or null
 * @param fineness         its fineness in parts per thousand, or null
 * @param finenessLabel    its fineness label, e.g. "585 (14K)", or null
 * @param weightGrams      its weight, decimal string, or null
 * @param variantCount     live variants
 * @param imageUrl         URL of the first photo, or null
 * @param imageAiGenerated whether that photo is AI-generated (shown with a label), or null without a photo
 */
@Schema(name = "AdminProduct", requiredProperties = {
        "id", "slug", "name", "names", "storeId", "storeName", "materialKind", "status", "expertiseStatus",
        "variantCount"})
public record AdminProductDto(long id, String slug, String name, LocalizedTextDto names, long storeId,
        String storeName, MaterialKind materialKind, @Schema(nullable = true) Metal metal,
        @Schema(nullable = true) FashionMaterial material, ProductStatus status, CheckStatus expertiseStatus,
        @Schema(nullable = true) String reviewNote, @Schema(nullable = true) Instant submittedAt,
        @Schema(nullable = true) Instant publishedAt, @Schema(nullable = true) MoneyDto priceFrom,
        @Schema(nullable = true, example = "585") Integer fineness,
        @Schema(nullable = true, example = "585 (14K)") String finenessLabel,
        @Schema(nullable = true, example = "3.250") String weightGrams, int variantCount,
        @Schema(nullable = true) String imageUrl, @Schema(nullable = true) Boolean imageAiGenerated) {

    /**
     * @param imageUrls turns a storage key into a browser URL ({@code ImageUrls::url})
     */
    public static AdminProductDto of(Product product, UnaryOperator<String> imageUrls) {
        ProductVariant cheapest = product.cheapestVariant().orElse(null);
        ProductImage image = product.getImages().isEmpty() ? null : product.getImages().getFirst();
        boolean hasFineness = cheapest != null && cheapest.getFineness() != null;
        return new AdminProductDto(product.getId(), product.getSlug(), product.getName().az(),
                LocalizedTextDto.of(product.getName()), product.getStore().getId(), product.getStore().getName(),
                product.getMaterialKind(), product.getMaterialKind() == MaterialKind.PRECIOUS ? product.getMetal() : null,
                product.getMaterial(), product.getStatus(), product.getExpertiseStatus(), product.getReviewNote(),
                product.getSubmittedAt(), product.getPublishedAt(),
                cheapest == null ? null : MoneyDto.of(cheapest.getPrice(), cheapest.getCurrency()),
                hasFineness ? cheapest.getFineness().getValue() : null,
                hasFineness ? cheapest.getFineness().getLabel() : null,
                cheapest == null || cheapest.getWeightGrams() == null ? null : Decimal.of(cheapest.getWeightGrams()),
                product.getVariants().size(),
                image == null ? null : imageUrls.apply(image.getStorageKey()),
                image == null ? null : image.isAiGenerated());
    }
}
