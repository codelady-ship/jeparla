package az.jeparla.verification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** A short-lived URL that downloads one document from the private bucket (admin only, audited). */
@Schema(name = "DocumentView", requiredProperties = {"url", "expiresAt"})
public record DocumentViewDto(String url, Instant expiresAt) {
}
