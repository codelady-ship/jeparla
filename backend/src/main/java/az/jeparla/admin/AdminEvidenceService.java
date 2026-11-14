package az.jeparla.admin;

import az.jeparla.admin.dto.AdminEvidencePhotoDto;
import az.jeparla.admin.dto.EvidenceCheckRequest;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.Product;
import az.jeparla.product.ProductEvidencePhoto;
import az.jeparla.product.ProductEvidencePhotoRepository;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductVariant;
import az.jeparla.verification.CheckStatus;
import java.time.Clock;
import java.util.List;
import java.util.Objects;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin check of hallmark and label photos (#106): the photo next to the product data, then VERIFIED or REJECTED
 * (reason), every decision audited. Checking a photo changes nothing else: a mismatch that should take the product
 * off the catalog is a separate RETURN or DEACTIVATE decision on the product.
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminEvidenceService {

    private static final int MIN_REASON = 10;

    private final ProductEvidencePhotoRepository photos;
    private final ProductRepository products;
    private final UserRepository users;
    private final AuditService audit;
    private final ImageUrls imageUrls;
    private final Clock clock;

    public AdminEvidenceService(ProductEvidencePhotoRepository photos, ProductRepository products,
            UserRepository users, AuditService audit, ImageUrls imageUrls, Clock clock) {
        this.photos = photos;
        this.products = products;
        this.users = users;
        this.audit = audit;
        this.imageUrls = imageUrls;
        this.clock = clock;
    }

    /** Photos with {@code status} (default PENDING) of products that are not deleted, oldest first. */
    @Transactional(readOnly = true)
    public PageDto<AdminEvidencePhotoDto> queue(CheckStatus status, int page, int size) {
        CheckStatus wanted = status == null ? CheckStatus.PENDING : status;
        if (wanted == CheckStatus.NONE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.status_invalid", "status");
        }
        return PageDto.of(photos.findByStatusAndProductDeletedAtIsNull(wanted,
                AdminPages.of(page, size, Sort.by("createdAt", "id"))), this::dto);
    }

    /** The hallmark and label photos of one product (the moderation view shows them next to its data). */
    @Transactional(readOnly = true)
    public List<AdminEvidencePhotoDto> ofProduct(long productId) {
        Product product = products.findById(productId).filter(p -> !p.isDeleted()).orElseThrow(ApiException::notFound);
        return product.getEvidencePhotos().stream().map(this::dto).toList();
    }

    /** VERIFIED, or REJECTED with a reason of 10+ characters; checking again overwrites the earlier decision. */
    @Transactional
    public AdminEvidencePhotoDto check(long photoId, EvidenceCheckRequest request) {
        ProductEvidencePhoto photo = photos.findWithProductById(photoId)
                .filter(p -> !p.getProduct().isDeleted()).orElseThrow(ApiException::notFound);
        Product product = photo.getProduct();
        if (product.getStore().isOwnedBy(CurrentUser.id())) {
            throw new AccessDeniedException("An admin does not check their own store's photos");
        }
        CheckStatus to = request.decision();
        if (to != CheckStatus.VERIFIED && to != CheckStatus.REJECTED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.status_invalid", "decision");
        }
        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().strip();
        if (to == CheckStatus.REJECTED && (reason == null || reason.length() < MIN_REASON)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "reason");
        }
        CheckStatus from = photo.getStatus();
        photo.check(to, reason, users.getReferenceById(CurrentUser.id()), clock.instant());
        photos.flush();
        audit.record(to == CheckStatus.VERIFIED ? "EVIDENCE_PHOTO_VERIFIED" : "EVIDENCE_PHOTO_REJECTED",
                AuditTargetType.CHECK, product.getId(), product.getName().az(), reason,
                AuditDetails.of("check", "EVIDENCE_PHOTO", "kind", photo.getKind(), "photoId", photo.getId(),
                        "from", from, "to", to));
        return dto(photo);
    }

    private AdminEvidencePhotoDto dto(ProductEvidencePhoto photo) {
        Product product = photo.getProduct();
        List<ProductVariant> variants = product.getVariants();
        List<Integer> finenesses = variants.stream().map(ProductVariant::getFineness).filter(Objects::nonNull)
                .map(f -> f.getValue()).distinct().sorted().toList();
        List<String> weights = variants.stream().map(ProductVariant::getWeightGrams).filter(Objects::nonNull)
                .sorted().map(Decimal::of).distinct().toList();
        return new AdminEvidencePhotoDto(photo.getId(), photo.getKind(), imageUrls.url(photo.getStorageKey()),
                photo.getWidth(), photo.getHeight(), photo.getStatus(), photo.getCheckNote(), photo.getCheckedAt(),
                photo.getCreatedAt(), product.getId(), product.getSlug(), product.getName().az(), product.getStatus(),
                product.getMaterialKind(), product.getMetal(), finenesses, weights, product.getStore().getId(),
                product.getStore().getName());
    }
}
