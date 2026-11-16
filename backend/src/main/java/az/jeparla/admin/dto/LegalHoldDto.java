package az.jeparla.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** Legal hold of a store (#138); both fields are null when there is none. */
@Schema(name = "LegalHold", requiredProperties = {"storeId"})
public record LegalHoldDto(long storeId, Instant legalHoldAt, String legalHoldReason) {
}
