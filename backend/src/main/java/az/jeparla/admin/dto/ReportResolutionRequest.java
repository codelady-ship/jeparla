package az.jeparla.admin.dto;

import az.jeparla.product.ReportStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Closes a complaint (#40): RESOLVED (it was justified; the seller is notified with the note, never with the
 * reporter's identity or message) or DISMISSED (nobody is notified). The note is required, 10-1000 characters.
 */
@Schema(name = "ReportResolutionRequest", requiredProperties = {"status", "note"})
public record ReportResolutionRequest(
        @NotNull @Schema(allowableValues = {"RESOLVED", "DISMISSED"}) ReportStatus status,
        @Size(max = 1000) String note) {
}
