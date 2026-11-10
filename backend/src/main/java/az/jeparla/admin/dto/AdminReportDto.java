package az.jeparla.admin.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.product.Product;
import az.jeparla.product.ProductReport;
import az.jeparla.product.ReportReason;
import az.jeparla.product.ReportStatus;
import az.jeparla.store.Store;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * A buyer complaint in the admin queue (#40, PLAN 5.8): about a product (then {@code product} is set) or about a
 * store as a whole ({@code targetType = STORE}, {@code product} null).
 *
 * @param reporterId the signed-in reporter, or null for a guest (or a deleted account)
 * @param note       the admin's resolution note, null while open
 */
@Schema(name = "AdminReport", requiredProperties = {
        "id", "targetType", "store", "reason", "message", "status", "createdAt"})
public record AdminReportDto(long id, TargetType targetType, @Schema(nullable = true) ProductRef product,
        StoreRef store, ReportReason reason, String message, ReportStatus status, @Schema(nullable = true) String note,
        @Schema(nullable = true) Long reporterId, Instant createdAt, @Schema(nullable = true) Instant resolvedAt,
        @Schema(nullable = true) String resolvedBy) {

    /** What the complaint is about. */
    public enum TargetType {
        PRODUCT,
        STORE
    }

    @Schema(name = "AdminReportProduct", requiredProperties = {"id", "slug", "name"})
    public record ProductRef(long id, String slug, LocalizedTextDto name) {
    }

    @Schema(name = "AdminReportStore", requiredProperties = {"id", "slug", "name"})
    public record StoreRef(long id, String slug, String name) {
    }

    public static AdminReportDto of(ProductReport report) {
        Product product = report.getProduct();
        Store store = report.getStore();
        return new AdminReportDto(report.getId(), product == null ? TargetType.STORE : TargetType.PRODUCT,
                product == null ? null
                        : new ProductRef(product.getId(), product.getSlug(), LocalizedTextDto.of(product.getName())),
                new StoreRef(store.getId(), store.getSlug(), store.getName()), report.getReason(), report.getMessage(),
                report.getStatus(), report.getResolutionNote(),
                report.getReporter() == null ? null : report.getReporter().getId(), report.getCreatedAt(),
                report.getResolvedAt(), report.getResolvedBy() == null ? null : report.getResolvedBy().getDisplayName());
    }
}
