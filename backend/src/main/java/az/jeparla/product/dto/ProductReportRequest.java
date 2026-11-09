package az.jeparla.product.dto;

import az.jeparla.product.ReportReason;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/v1/products/{id}/reports}: a buyer complaint (PLAN 5.8).
 *
 * @param message optional explanation, up to 2000 characters
 */
@Schema(name = "ProductReportRequest", requiredProperties = {"reason"})
public record ProductReportRequest(@NotNull ReportReason reason, @Size(max = 2000) String message) {

    @Override
    public String toString() {
        // The message is free text from a visitor: keep it out of logs.
        return "ProductReportRequest[reason=" + reason + ", message=" + (message == null ? 0 : message.length())
                + " chars]";
    }
}
