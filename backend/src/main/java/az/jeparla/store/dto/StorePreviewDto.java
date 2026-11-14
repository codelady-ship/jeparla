package az.jeparla.store.dto;

import az.jeparla.verification.dto.VerificationDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * What a link preview of a store shows (#100): Open Graph tags and the share image the frontend renders for
 * Instagram, WhatsApp and Telegram.
 *
 * @param slug          the store page is {@code /<locale>/stores/<slug>}
 * @param verified      the seller check is VERIFIED ("Satıcı təsdiqlənib"); the other checks are in
 *                      {@code verification}
 * @param productCount  listed products (as on the store page)
 * @param coverImageUrl first photo of the store's most recently published listed product; null without one.
 *                      Demo keys give a path of the frontend ({@code /demo/...}): make it absolute for og:image
 * @param logoUrl       store logo, or null
 */
@Schema(name = "StorePreview", requiredProperties = {"slug", "name", "city", "verified", "verification",
        "productCount", "coverImageUrl", "logoUrl"})
public record StorePreviewDto(
        String slug,
        String name,
        String city,
        boolean verified,
        VerificationDto verification,
        long productCount,
        @Schema(nullable = true) String coverImageUrl,
        @Schema(nullable = true) String logoUrl) {
}
