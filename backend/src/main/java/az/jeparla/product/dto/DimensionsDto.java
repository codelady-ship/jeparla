package az.jeparla.product.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.product.Product;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/**
 * Sizes of a product in millimetres (#174), as decimal strings; a size the seller did not enter is null.
 * The whole object is null when there is none.
 */
@Schema(name = "Dimensions", requiredProperties = {"widthMm", "thicknessMm", "lengthMm", "diameterMm"})
public record DimensionsDto(
        @Schema(nullable = true, example = "2.50") String widthMm,
        @Schema(nullable = true) String thicknessMm,
        @Schema(nullable = true) String lengthMm,
        @Schema(nullable = true) String diameterMm) {

    public static DimensionsDto of(Product product) {
        if (product.getWidthMm() == null && product.getThicknessMm() == null && product.getLengthMm() == null
                && product.getDiameterMm() == null) {
            return null;
        }
        return new DimensionsDto(text(product.getWidthMm()), text(product.getThicknessMm()),
                text(product.getLengthMm()), text(product.getDiameterMm()));
    }

    private static String text(BigDecimal value) {
        return value == null ? null : Decimal.of(value);
    }
}
