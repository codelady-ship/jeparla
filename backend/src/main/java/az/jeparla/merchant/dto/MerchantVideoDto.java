package az.jeparla.merchant.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** The short video of a product in the cabinet (#117). */
@Schema(name = "MerchantVideo")
public record MerchantVideoDto(String url, String contentType, long sizeBytes, int durationMs, int width, int height,
        boolean aiGenerated) {
}
