package az.jeparla.store.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Measurable trust facts of a public store (#108), computed from the database on every request (no
 * number is typed in by anyone). A fact that is not known is {@code null}, never a made-up zero. How each
 * fact is computed: backend/README.md, "Mağaza faktları".
 *
 * <p>Not here on purpose: ratings and reviews (none exist yet, #63) and the WhatsApp response time (the chat
 * happens outside Jeparla, so it cannot be measured).
 *
 * @param onJeparlaSince   when an admin first approved the store (it became public); null when not recorded
 * @param monthsOnJeparla  full calendar months since {@code onJeparlaSince} (Asia/Baku); null with it
 * @param activeProducts   products listed now (the same count as {@code productCount} of the store page)
 * @param catalogUpdatedAt latest change of a product listed now; null without listed products
 * @param verifiedExpertise listed products whose assay certificate or lab report an admin verified
 * @param metalLinkedPrice listed products whose price follows the daily CBAR metal price
 * @param hallmarkPhoto    listed products with a hallmark photo a buyer can see (#106: any status but REJECTED)
 * @param documents        which store documents an admin verified; null for a store that sells only fashion
 *                         jewellery (it has no documents check)
 */
@Schema(name = "StoreFacts", requiredProperties = {"onJeparlaSince", "monthsOnJeparla", "activeProducts",
        "catalogUpdatedAt", "verifiedExpertise", "metalLinkedPrice", "hallmarkPhoto", "documents"})
public record StoreFactsDto(
        @Schema(nullable = true, format = "date-time") String onJeparlaSince,
        @Schema(nullable = true) Integer monthsOnJeparla,
        long activeProducts,
        @Schema(nullable = true, format = "date-time") String catalogUpdatedAt,
        ShareOfProducts verifiedExpertise,
        ShareOfProducts metalLinkedPrice,
        ShareOfProducts hallmarkPhoto,
        @Schema(nullable = true) Documents documents) {

    /**
     * A part of the listed products.
     *
     * @param count   listed products with the property
     * @param percent {@code count} of {@code activeProducts} in percent, rounded down (never overstated); null
     *                when the store has no listed product (no share to speak of)
     */
    @Schema(name = "StoreFactShare", requiredProperties = {"count", "percent"})
    public record ShareOfProducts(long count, @Schema(nullable = true, minimum = "0", maximum = "100") Integer percent) {

        public static ShareOfProducts of(long count, long total) {
            return new ShareOfProducts(count, total == 0 ? null : (int) (count * 100 / total));
        }
    }

    /**
     * Store documents (#40, #164): true when an admin approved at least one document of the kind.
     *
     * @param taxId        VOEN certificate
     * @param tradeLicense trade licence or registration extract
     */
    @Schema(name = "StoreFactDocuments", requiredProperties = {"taxId", "tradeLicense"})
    public record Documents(boolean taxId, boolean tradeLicense) {
    }
}
