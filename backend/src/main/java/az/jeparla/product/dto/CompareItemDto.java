package az.jeparla.product.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** One column of the compare page: comparison is per variant ({@code CompareItem} in frontend/src/types/api.ts). */
@Schema(name = "CompareItem", requiredProperties = {"product", "variant", "stones"})
public record CompareItemDto(ProductSummaryDto product, VariantDto variant, List<StoneDto> stones) {
}
