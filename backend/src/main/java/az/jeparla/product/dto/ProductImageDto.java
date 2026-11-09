package az.jeparla.product.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * {@code ProductImage} in frontend/src/types/api.ts.
 *
 * @param url         absolute URL in the public bucket, or a frontend path ({@code /demo/...}) for
 *                    demo images; never with a fragment
 * @param aiGenerated AI-generated or AI-edited images carry a visible label (CLAUDE.md, honesty)
 */
@Schema(name = "ProductImage", requiredProperties = {"url", "alt", "width", "height", "aiGenerated"})
public record ProductImageDto(String url, LocalizedTextDto alt, int width, int height, boolean aiGenerated) {
}
