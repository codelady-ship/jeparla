package az.jeparla.product.dto;

import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.Product;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * {@code ProductVideo} in frontend/src/types/api.ts: the short clip of a product (#117). The page loads the file
 * only after the buyer presses play; the poster is the cover photo.
 *
 * @param url         absolute URL in the public bucket, or a frontend path ({@code /demo/...}) for the demo clip
 * @param contentType {@code video/mp4} (H.264) or {@code video/webm}
 * @param aiGenerated an AI-generated or AI-edited video carries a visible label (CLAUDE.md, honesty)
 */
@Schema(name = "ProductVideo", requiredProperties = {"url", "contentType", "durationMs", "width", "height",
        "aiGenerated"})
public record ProductVideoDto(String url, String contentType, int durationMs, int width, int height,
        boolean aiGenerated) {

    /** The video of {@code product}, or null when it has none. */
    public static ProductVideoDto of(Product product, ImageUrls urls) {
        return product.getVideo()
                .map(video -> new ProductVideoDto(urls.url(video.storageKey()), video.contentType(),
                        video.durationMs(), video.width(), video.height(), video.aiGenerated()))
                .orElse(null);
    }
}
