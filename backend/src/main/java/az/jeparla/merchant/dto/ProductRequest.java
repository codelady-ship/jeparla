package az.jeparla.merchant.dto;

import az.jeparla.product.Audience;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * A product with its variants and stones ({@code POST /api/v1/merchant/products},
 * {@code PUT /api/v1/merchant/products/{id}}). Images are uploaded separately.
 *
 * @param materialKind         PRECIOUS (metal, fineness, weight) or FASHION (material, FIXED price); fixed
 *                             once the product exists (#128)
 * @param metal                required for PRECIOUS, absent for FASHION
 * @param material             required for FASHION, absent for PRECIOUS
 * @param notPreciousConfirmed FASHION only: the seller confirms "this is not a precious metal" (must be true)
 * @param audience             who the piece is for (#121), picks the AI model of an on-model image; optional: on
 *                             create suggested from the category (MEN / KIDS roots, otherwise UNISEX), on update kept
 * @param dimensions           optional sizes in mm (#174); null clears them
 * @param keyFeatures          up to 5 short points the seller writes (#174), shown under the description
 */
public record ProductRequest(
        @NotNull MaterialKind materialKind,
        @NotNull @Positive Long categoryId,
        @NotNull @Valid LocalizedTextRequest name,
        @Valid DescriptionRequest description,
        Metal metal,
        FashionMaterial material,
        Boolean notPreciousConfirmed,
        @NotEmpty @Size(max = MAX_VARIANTS) List<@NotNull @Valid VariantRequest> variants,
        @Size(max = MAX_STONES) List<@NotNull @Valid StoneRequest> stones,
        Audience audience,
        @Valid DimensionsRequest dimensions,
        @Size(max = MAX_KEY_FEATURES) List<@NotBlank @Size(max = KEY_FEATURE_LENGTH) String> keyFeatures) {

    /** Same limits as frontend/src/lib/merchant/schemas.ts. */
    public static final int MAX_VARIANTS = 10;
    public static final int MAX_STONES = 6;
    public static final int MAX_KEY_FEATURES = 5;
    public static final int KEY_FEATURE_LENGTH = 120;

    public List<StoneRequest> stonesOrEmpty() {
        return stones == null ? List.of() : stones;
    }

    /** Key features on one line each (whitespace runs become one space), blank ones left out. */
    public List<String> keyFeaturesOrEmpty() {
        return keyFeatures == null ? List.of()
                : keyFeatures.stream().filter(f -> f != null && !f.isBlank())
                        .map(f -> f.replaceAll("\\s+", " ").strip()).toList();
    }

    /**
     * Product dimensions in millimetres (#174), all optional: width, thickness, length (chain, bracelet) and
     * diameter (earring). At most 9999.99, two decimals.
     */
    public record DimensionsRequest(
            @Positive @DecimalMax("9999.99") @Digits(integer = 4, fraction = 2) BigDecimal widthMm,
            @Positive @DecimalMax("9999.99") @Digits(integer = 4, fraction = 2) BigDecimal thicknessMm,
            @Positive @DecimalMax("9999.99") @Digits(integer = 4, fraction = 2) BigDecimal lengthMm,
            @Positive @DecimalMax("9999.99") @Digits(integer = 4, fraction = 2) BigDecimal diameterMm) {
    }
}
