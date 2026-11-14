package az.jeparla.merchant.dto;

import az.jeparla.product.Audience;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import jakarta.validation.Valid;
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
        Audience audience) {

    /** Same limits as frontend/src/lib/merchant/schemas.ts. */
    public static final int MAX_VARIANTS = 10;
    public static final int MAX_STONES = 6;

    public List<StoneRequest> stonesOrEmpty() {
        return stones == null ? List.of() : stones;
    }
}
