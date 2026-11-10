package az.jeparla.merchant.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Map;

/**
 * A presigned upload: the browser sends the file with {@code method} to {@code url} and exactly these
 * {@code headers}, before {@code expiresAt}, then attaches it with {@code key}.
 */
@Schema(name = "ImageUpload")
public record ImageUploadDto(String key, String url, String method, Map<String, String> headers, Instant expiresAt,
        long maxBytes) {
}
