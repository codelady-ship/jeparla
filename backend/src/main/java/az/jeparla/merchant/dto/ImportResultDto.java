package az.jeparla.merchant.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Result of a product spreadsheet import (#109). Every valid row became a DRAFT product ({@code created}); a
 * repeated import with the same Idempotency-Key returns the same products ({@code created} false on them).
 * Invalid rows are listed in {@code errors} with the line of the file, the column and a message in the
 * seller's language; they never stop the other rows.
 */
@Schema(name = "MerchantImportResult", requiredProperties = {"rows", "created", "errors"})
public record ImportResultDto(int rows, List<CreatedRow> created, List<RowError> errors) {

    @Schema(name = "MerchantImportCreatedRow", requiredProperties = {"line", "productId", "created"})
    public record CreatedRow(int line, long productId, boolean created) {
    }

    @Schema(name = "MerchantImportRowError", requiredProperties = {"line", "code", "message"})
    public record RowError(int line, @Schema(nullable = true) String column, String code, String message) {
    }
}
