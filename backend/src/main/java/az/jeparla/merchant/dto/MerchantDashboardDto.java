package az.jeparla.merchant.dto;

import az.jeparla.product.ProductStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

/**
 * {@code MerchantDashboard} in frontend/src/types/merchant.ts.
 *
 * @param views          product page views of the last 30 days; null: views are not counted yet (no counter
 *                       table), and a made-up number would be a fake statistic
 * @param whatsappClicks WhatsApp clicks on the store's products in the last 30 days (Asia/Baku days)
 * @param counts         the store's products per status, deleted ones excluded; every status is present
 */
@Schema(name = "MerchantDashboard")
public record MerchantDashboardDto(
        @Schema(nullable = true) Long views,
        long whatsappClicks,
        Map<ProductStatus, Long> counts) {
}
