package az.jeparla.verification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Map;

/**
 * A presigned upload into the private bucket: the browser sends {@code method} to {@code url} with
 * {@code headers} and exactly the announced size, then confirms {@code key} with the declaration.
 */
@Schema(name = "DocumentUpload", requiredProperties = {"key", "url", "method", "headers", "expiresAt", "maxBytes"})
public record DocumentUploadDto(String key, String url, String method, Map<String, String> headers, Instant expiresAt,
        long maxBytes) {
}
