package az.jeparla.admin;

import az.jeparla.admin.dto.AdminProductDto;
import az.jeparla.admin.dto.AdminStoreDto;
import az.jeparla.admin.dto.AuditLogDto;
import az.jeparla.admin.dto.ProductDecisionRequest;
import az.jeparla.admin.dto.SellerCheckRequest;
import az.jeparla.admin.dto.StoreStatusRequest;
import az.jeparla.common.dto.PageDto;
import az.jeparla.product.ProductStatus;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Store and product moderation and the audit log (#40): ADMIN only, every decision audited. */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: moderation", description = "Stores, seller check, product review, audit log (ADMIN)")
public class AdminModerationController {

    private final AdminModerationService moderation;

    public AdminModerationController(AdminModerationService moderation) {
        this.moderation = moderation;
    }

    @GetMapping("/stores")
    @Operation(summary = "Stores, oldest first: by status (default PENDING) and/or seller check status",
            description = "Without parameters: store applications (status=PENDING). sellerStatus alone is the seller "
                    + "identity-check queue across every store status (e.g. sellerStatus=PENDING); with both, both "
                    + "apply. productCount is the store's products that are not deleted, in any status.")
    public PageDto<AdminStoreDto> stores(@RequestParam(required = false) StoreStatus status,
            @RequestParam(required = false) CheckStatus sellerStatus,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return moderation.stores(status, sellerStatus, page, size);
    }

    @GetMapping("/stores/{id}")
    public AdminStoreDto store(@PathVariable long id) {
        return moderation.store(id);
    }

    @PostMapping("/stores/{id}/status")
    @Operation(summary = "Approve, reject (reason) or block (reason) a store; the seller is notified")
    public AdminStoreDto storeStatus(@PathVariable long id, @Valid @RequestBody StoreStatusRequest request) {
        return moderation.changeStoreStatus(id, request);
    }

    @PostMapping("/stores/{id}/seller-check")
    @Operation(summary = "Seller check: VERIFIED or REJECTED (reason)")
    public AdminStoreDto sellerCheck(@PathVariable long id, @Valid @RequestBody SellerCheckRequest request) {
        return moderation.sellerCheck(id, request);
    }

    @GetMapping("/products")
    @Operation(summary = "Products by status (default IN_REVIEW), the longest waiting first",
            description = "Each card has the cheapest live variant's price, fineness and weight and the first photo; "
                    + "missing values are null (no live variant, a FASHION product, no photo), never zero.")
    public PageDto<AdminProductDto> products(@RequestParam(required = false) ProductStatus status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return moderation.products(status, page, size);
    }

    @PostMapping("/products/{id}/decision")
    @Operation(summary = "APPROVE or RETURN (reason) a product in review, DEACTIVATE (reason) a published one",
            description = "409 admin.declaration_missing: a precious product needs the seller's declaration (#138); "
                    + "409 admin.expertise_rejected: its certificate did not pass, a new one has to be reviewed first.")
    public AdminProductDto decideProduct(@PathVariable long id, @Valid @RequestBody ProductDecisionRequest request) {
        return moderation.decideProduct(id, request);
    }

    @GetMapping("/audit")
    @Operation(summary = "Audit log, newest first; filter by targetType and targetId")
    public PageDto<AuditLogDto> audit(@RequestParam(required = false) AuditTargetType targetType,
            @RequestParam(required = false) String targetId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return moderation.auditLog(targetType, targetId, page, size);
    }
}
