package az.jeparla.product.dto;

import az.jeparla.common.dto.MoneyDto;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * A saved product of the signed-in buyer (#41, PLAN 5.11). {@code product.priceFrom} is today's price (the
 * cheapest live variant); {@code savedPrice} is what it cost when it was saved, so the page can show the change
 * (#112). {@code savedPrice} is null for products saved before the price was recorded: unknown, not zero.
 */
@Schema(name = "Favorite", requiredProperties = {"product", "savedAt"})
public record FavoriteDto(ProductSummaryDto product, Instant savedAt, @Schema(nullable = true) MoneyDto savedPrice) {
}
