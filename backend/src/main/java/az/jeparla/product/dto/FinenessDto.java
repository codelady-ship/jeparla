package az.jeparla.product.dto;

import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import io.swagger.v3.oas.annotations.media.Schema;

/** {@code Fineness} in frontend/src/types/api.ts: parts per thousand of one metal. */
@Schema(name = "Fineness", requiredProperties = {"id", "metal", "value", "label"})
public record FinenessDto(long id, Metal metal, @Schema(example = "585") int value,
        @Schema(example = "585 (14K)") String label) {

    public static FinenessDto of(Fineness fineness) {
        return new FinenessDto(fineness.getId(), fineness.getMetal(), fineness.getValue(), fineness.getLabel());
    }
}
