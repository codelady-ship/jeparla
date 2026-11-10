package az.jeparla.admin;

import az.jeparla.admin.dto.AdminProductDto;
import az.jeparla.admin.dto.AdminStoreDto;
import az.jeparla.admin.dto.AuditLogDto;
import az.jeparla.admin.dto.ProductDecisionRequest;
import az.jeparla.admin.dto.SellerCheckRequest;
import az.jeparla.admin.dto.StoreStatusRequest;
import az.jeparla.auth.CurrentUser;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.notification.NotificationKind;
import az.jeparla.notification.NotificationService;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Product;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductStatus;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import az.jeparla.verification.SellerDeclarationRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moderation by the Jeparla team (#40): store status, the seller check, product review and the audit log.
 * Every decision is audited with its reason, and the seller is notified in their language (#138). An admin
 * never decides about a store they own.
 *
 * <p>Honesty (CLAUDE.md): the seller check is the admin's confirmation of the seller (VÖEN in the state
 * register, contact); the documents and expertise checks become VERIFIED only through approved documents
 * ({@code AdminDocumentService}), never here. A PRECIOUS product is published only when its seller has
 * confirmed the declaration (#138).
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MIN_REASON = 10;
    private static final String STORE_LINK = "/merchant/store";
    private static final String PRODUCTS_LINK = "/merchant/products";

    private final StoreRepository stores;
    private final ProductRepository products;
    private final SellerDeclarationRepository declarations;
    private final AuditLogRepository auditLogs;
    private final AuditService audit;
    private final NotificationService notifications;
    private final ImageUrls imageUrls;
    private final Clock clock;

    public AdminModerationService(StoreRepository stores, ProductRepository products,
            SellerDeclarationRepository declarations, AuditLogRepository auditLogs, AuditService audit,
            NotificationService notifications, ImageUrls imageUrls, Clock clock) {
        this.stores = stores;
        this.products = products;
        this.declarations = declarations;
        this.auditLogs = auditLogs;
        this.audit = audit;
        this.notifications = notifications;
        this.imageUrls = imageUrls;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ stores

    /**
     * Stores, oldest first. Without filters the store applications ({@code PENDING}); with {@code sellerStatus}
     * alone the seller identity-check queue of every marketplace status (e.g. {@code sellerStatus=PENDING} or
     * {@code NONE}); with both, both apply.
     */
    @Transactional(readOnly = true)
    public PageDto<AdminStoreDto> stores(StoreStatus status, CheckStatus sellerStatus, int page, int size) {
        PageRequest request = pageRequest(page, size, Sort.by("createdAt", "id"));
        Page<Store> found;
        if (sellerStatus == null) {
            found = stores.findByStatus(status == null ? StoreStatus.PENDING : status, request);
        } else if (status == null) {
            found = stores.findBySellerStatus(sellerStatus, request);
        } else {
            found = stores.findByStatusAndSellerStatus(status, sellerStatus, request);
        }
        Map<Long, Long> counts = productCounts(found.map(Store::getId).toList());
        return PageDto.of(found, store -> AdminStoreDto.of(store, counts.getOrDefault(store.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public AdminStoreDto store(long id) {
        return storeDto(stores.findById(id).orElseThrow(ApiException::notFound));
    }

    /** APPROVED, REJECTED (reason) or BLOCKED (reason); the same status again is a no-op. */
    @Transactional
    public AdminStoreDto changeStoreStatus(long id, StoreStatusRequest request) {
        Store store = stores.findById(id).orElseThrow(ApiException::notFound);
        requireNotOwn(store);
        StoreStatus from = store.getStatus();
        StoreStatus to = request.status();
        if (to == StoreStatus.PENDING) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.status_invalid", "status");
        }
        if (to == from) {
            return storeDto(store);
        }
        String reason = null;
        if (to == StoreStatus.APPROVED) {
            store.approve(clock.instant());
        } else {
            reason = requireReason(request.reason());
            store.setStatus(to);
            store.setStatusNote(reason);
        }
        stores.flush();
        audit.record("STORE_" + (to == StoreStatus.APPROVED ? "APPROVED" : to.name()), AuditTargetType.STORE,
                store.getId(), store.getName(), reason, "{\"from\":\"" + from + "\",\"to\":\"" + to + "\"}");
        NotificationKind kind = switch (to) {
            case APPROVED -> NotificationKind.STORE_APPROVED;
            case REJECTED -> NotificationKind.STORE_REJECTED;
            default -> NotificationKind.STORE_BLOCKED;
        };
        String note = reason;
        notifications.notify(store.getOwner(), kind, locale -> new Object[] {store.getName(), note == null ? "" : note},
                null, STORE_LINK);
        return storeDto(store);
    }

    /** The seller check: VERIFIED or REJECTED (reason). */
    @Transactional
    public AdminStoreDto sellerCheck(long id, SellerCheckRequest request) {
        Store store = stores.findById(id).orElseThrow(ApiException::notFound);
        requireNotOwn(store);
        CheckStatus to = request.decision();
        if (to != CheckStatus.VERIFIED && to != CheckStatus.REJECTED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.status_invalid", "decision");
        }
        CheckStatus from = store.getSellerStatus();
        String reason = to == CheckStatus.REJECTED ? requireReason(request.reason()) : null;
        store.setSellerStatus(to);
        stores.flush();
        audit.record(to == CheckStatus.VERIFIED ? "SELLER_VERIFIED" : "SELLER_REJECTED", AuditTargetType.CHECK,
                store.getId(), store.getName(), reason,
                "{\"check\":\"SELLER\",\"from\":\"" + from + "\",\"to\":\"" + to + "\"}");
        String note = reason;
        notifications.notify(store.getOwner(),
                to == CheckStatus.VERIFIED ? NotificationKind.SELLER_VERIFIED : NotificationKind.SELLER_REJECTED,
                locale -> new Object[] {store.getName(), note == null ? "" : note}, null, STORE_LINK);
        return storeDto(store);
    }

    // ------------------------------------------------------------------ products

    /** Products with {@code status} (default IN_REVIEW), the longest waiting first. */
    @Transactional(readOnly = true)
    public PageDto<AdminProductDto> products(ProductStatus status, int page, int size) {
        PageRequest request = pageRequest(page, size, Sort.by("submittedAt", "id"));
        return PageDto.of(products.findByStatus(status == null ? ProductStatus.IN_REVIEW : status, request),
                this::productDto);
    }

    @Transactional
    public AdminProductDto decideProduct(long id, ProductDecisionRequest request) {
        Product product = products.findById(id).filter(p -> !p.isDeleted()).orElseThrow(ApiException::notFound);
        Store store = product.getStore();
        requireNotOwn(store);
        ProductStatus from = product.getStatus();
        Instant now = clock.instant();
        String reason = null;
        NotificationKind kind;
        switch (request.decision()) {
            case APPROVE -> {
                requireStatus(from, ProductStatus.IN_REVIEW);
                if (store.getStatus() != StoreStatus.APPROVED) {
                    throw new ApiException(HttpStatus.CONFLICT, "admin.store_not_approved");
                }
                if (product.getMaterialKind() == MaterialKind.PRECIOUS && !declarations.existsByStoreId(store.getId())) {
                    // #138: a precious product is not published before its seller confirmed the declaration.
                    throw new ApiException(HttpStatus.CONFLICT, "admin.declaration_missing");
                }
                product.approve(now);
                kind = NotificationKind.PRODUCT_APPROVED;
            }
            case RETURN -> {
                requireStatus(from, ProductStatus.IN_REVIEW);
                reason = requireReason(request.reason());
                product.returnToSeller(reason);
                kind = NotificationKind.PRODUCT_RETURNED;
            }
            default -> {
                requireStatus(from, ProductStatus.APPROVED);
                reason = requireReason(request.reason());
                product.deactivate(reason);
                kind = NotificationKind.PRODUCT_DEACTIVATED;
            }
        }
        products.flush();
        audit.record("PRODUCT_" + switch (request.decision()) {
            case APPROVE -> "APPROVED";
            case RETURN -> "RETURNED";
            default -> "DEACTIVATED";
        }, AuditTargetType.PRODUCT, product.getId(), product.getName().az(), reason,
                "{\"from\":\"" + from + "\",\"to\":\"" + product.getStatus() + "\"}");
        String note = reason;
        notifications.notify(store.getOwner(), kind,
                locale -> new Object[] {product.getName().in(Language.of(locale)), note == null ? "" : note}, null,
                PRODUCTS_LINK);
        return productDto(product);
    }

    // ------------------------------------------------------------------ audit

    /** The audit log, newest first; optionally of one target. */
    @Transactional(readOnly = true)
    public PageDto<AuditLogDto> auditLog(AuditTargetType targetType, String targetId, int page, int size) {
        PageRequest request = pageRequest(page, size, Sort.unsorted());
        if (targetType != null && targetId != null && !targetId.isBlank()) {
            return PageDto.of(auditLogs.findByTargetTypeAndTargetIdOrderByCreatedAtDesc(targetType, targetId.strip(),
                    request), AuditLogDto::of);
        }
        return PageDto.of(auditLogs.findAllByOrderByCreatedAtDesc(request), AuditLogDto::of);
    }

    // ------------------------------------------------------------------ helpers

    private AdminStoreDto storeDto(Store store) {
        return AdminStoreDto.of(store, productCounts(List.of(store.getId())).getOrDefault(store.getId(), 0L));
    }

    private AdminProductDto productDto(Product product) {
        return AdminProductDto.of(product, imageUrls::url);
    }

    /** Products (not deleted, any status) per store, in one statement for a page of stores. */
    private Map<Long, Long> productCounts(List<Long> storeIds) {
        Map<Long, Long> counts = new HashMap<>();
        if (storeIds.isEmpty()) {
            return counts;
        }
        for (Object[] row : products.countLiveByStoreIds(storeIds)) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private static PageRequest pageRequest(int page, int size, Sort sort) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.page");
        }
        return PageRequest.of(page, size, sort);
    }

    private static void requireStatus(ProductStatus actual, ProductStatus expected) {
        if (actual != expected) {
            throw new ApiException(HttpStatus.CONFLICT, "admin.status_transition");
        }
    }

    private static String requireReason(String reason) {
        String stripped = reason == null ? "" : reason.strip();
        if (stripped.length() < MIN_REASON) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "reason");
        }
        return stripped;
    }

    /** Conflict of interest: an admin does not decide about their own store. */
    private static void requireNotOwn(Store store) {
        if (store.isOwnedBy(CurrentUser.id())) {
            throw new AccessDeniedException("An admin does not moderate their own store");
        }
    }
}
