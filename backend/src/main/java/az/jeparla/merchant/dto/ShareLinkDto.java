package az.jeparla.merchant.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The seller's shareable catalog link (#100).
 *
 * @param code   share code (8 characters)
 * @param url    the link to paste into an Instagram bio, TikTok profile, WhatsApp status or Tap.az ad
 * @param qrUrl  the link the QR code opens: {@code url} with {@code ?ref=qr}, so scans are counted as QR visits
 * @param active whether the link opens the store now: only an APPROVED store is public, before that the link
 *               answers 404
 */
@Schema(name = "ShareLink", requiredProperties = {"code", "url", "qrUrl", "active"})
public record ShareLinkDto(
        @Schema(example = "k7m2q9xa") String code,
        @Schema(example = "https://jeparla.az/s/k7m2q9xa") String url,
        @Schema(example = "https://jeparla.az/s/k7m2q9xa?ref=qr") String qrUrl,
        boolean active) {
}
