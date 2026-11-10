package az.jeparla.merchant.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import io.swagger.v3.oas.annotations.media.Schema;

/** A product photo in the cabinet; the first one (lowest {@code sortOrder}) is the cover. */
@Schema(name = "MerchantImage")
public record MerchantImageDto(long id, String url, LocalizedTextDto alt, int width, int height, String contentType,
        long sizeBytes, boolean aiGenerated, int sortOrder) {
}
