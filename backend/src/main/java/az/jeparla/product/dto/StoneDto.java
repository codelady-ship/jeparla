package az.jeparla.product.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.product.ProductStone;
import az.jeparla.product.StoneOrigin;
import az.jeparla.product.StoneType;
import io.swagger.v3.oas.annotations.media.Schema;

/** {@code Stone} in frontend/src/types/api.ts; {@code carat} is per stone, a decimal string. */
@Schema(name = "Stone", requiredProperties = {"type", "origin", "shape", "carat", "color", "clarity", "cut", "count",
        "certificateLab", "certificateNumber"})
public record StoneDto(
        StoneType type,
        StoneOrigin origin,
        @Schema(nullable = true, example = "ROUND") String shape,
        @Schema(nullable = true, example = "0.250") String carat,
        @Schema(nullable = true, example = "F") String color,
        @Schema(nullable = true, example = "VS1") String clarity,
        @Schema(nullable = true, example = "EXCELLENT") String cut,
        int count,
        @Schema(nullable = true, example = "GIA") String certificateLab,
        @Schema(nullable = true) String certificateNumber) {

    public static StoneDto of(ProductStone stone) {
        return new StoneDto(stone.getStoneType(), stone.getOrigin(), stone.getShape(), Decimal.of(stone.getCarat()),
                stone.getColor(), stone.getClarity(), stone.getCut(), stone.getStoneCount(),
                stone.getCertificateLab(), stone.getCertificateNumber());
    }
}
