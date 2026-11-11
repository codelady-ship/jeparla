package az.jeparla.store;

import az.jeparla.common.error.ApiException;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.ProductCatalogService;
import az.jeparla.product.ProductRepository;
import az.jeparla.store.dto.StoreDtos;
import az.jeparla.store.dto.StoreFactsDto;
import az.jeparla.store.dto.StoreFactsDto.ShareOfProducts;
import az.jeparla.store.dto.StorePreviewDto;
import az.jeparla.verification.CheckStatus;
import az.jeparla.verification.DocumentKind;
import az.jeparla.verification.VerificationDocumentRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trust facts (#108) and the link preview (#100) of a public store. Everything is counted from the database
 * on the request (a handful of indexed statements per store; the CDN keeps the response for 5 minutes), over
 * the same listed products as the catalog: APPROVED, not deleted, PRECIOUS, in a visible category, with a
 * live variant. Nothing is stored or typed in by hand, so a fact can never drift from the data.
 */
@Service
@Transactional(readOnly = true)
public class StoreFactsService {

    static final ZoneId BAKU = ZoneId.of("Asia/Baku");

    private final StoreRepository stores;
    private final ProductRepository products;
    private final ProductCatalogService catalog;
    private final VerificationDocumentRepository documents;
    private final ImageUrls imageUrls;
    private final Clock clock;

    public StoreFactsService(StoreRepository stores, ProductRepository products, ProductCatalogService catalog,
            VerificationDocumentRepository documents, ImageUrls imageUrls, Clock clock) {
        this.stores = stores;
        this.products = products;
        this.catalog = catalog;
        this.documents = documents;
        this.imageUrls = imageUrls;
        this.clock = clock;
    }

    /** {@code GET /stores/{slug}/facts}: 404 unless the store is APPROVED. */
    public StoreFactsDto facts(String slug) {
        Store store = stores.findPublicBySlug(slug).orElseThrow(ApiException::notFound);
        Set<Long> categories = catalog.visibleCategoryIds();
        long active = 0;
        Instant updated = null;
        long expertise = 0;
        long metalLinked = 0;
        if (!categories.isEmpty()) {
            Object[] stats = products.listedStatsOfStore(store.getId(), categories).getFirst();
            active = ((Number) stats[0]).longValue();
            updated = (Instant) stats[1];
            if (active > 0) {
                expertise = products.countListedWithVerifiedExpertise(store.getId(), categories);
                metalLinked = products.countListedMetalLinked(store.getId(), categories);
            }
        }
        Instant since = store.getApprovedAt();
        return new StoreFactsDto(
                since == null ? null : since.toString(),
                since == null ? null : monthsSince(since),
                active,
                updated == null ? null : updated.toString(),
                ShareOfProducts.of(expertise, active),
                ShareOfProducts.of(metalLinked, active),
                null,
                documents(store));
    }

    /** {@code GET /stores/{slug}/preview}: 404 unless the store is APPROVED. */
    public StorePreviewDto previewBySlug(String slug) {
        return preview(stores.findPublicBySlug(slug).orElseThrow(ApiException::notFound));
    }

    /** {@code GET /share/{code}}: the store behind a share link; 404 for an unknown or replaced code. */
    public StorePreviewDto previewByShareCode(String code) {
        if (!ShareCodes.isValid(code)) {
            throw ApiException.notFound();
        }
        return preview(stores.findPublicByShareCode(code).orElseThrow(ApiException::notFound));
    }

    private StorePreviewDto preview(Store store) {
        Set<Long> categories = catalog.visibleCategoryIds();
        long count = 0;
        String cover = null;
        if (!categories.isEmpty()) {
            count = ((Number) products.listedStatsOfStore(store.getId(), categories).getFirst()[0]).longValue();
            List<String> keys = products.listedImageKeysOfStore(store.getId(), categories, PageRequest.of(0, 1));
            cover = keys.isEmpty() ? null : imageUrls.url(keys.getFirst());
        }
        return new StorePreviewDto(store.getSlug(), store.getName(), store.getCity(),
                store.getSellerStatus() == CheckStatus.VERIFIED, StoreDtos.verification(store), count, cover,
                imageUrls.url(store.getLogoKey()));
    }

    /** Store documents for a store that sells precious metal; null for a FASHION store (no documents check). */
    private StoreFactsDto.Documents documents(Store store) {
        if (!store.getSellerKind().sellsPrecious()) {
            return null;
        }
        List<DocumentKind> verified = documents.verifiedDocumentKindsOfStore(store.getId());
        return new StoreFactsDto.Documents(verified.contains(DocumentKind.TAX_ID),
                verified.contains(DocumentKind.TRADE_LICENSE));
    }

    private int monthsSince(Instant since) {
        LocalDate from = since.atZone(BAKU).toLocalDate();
        LocalDate today = LocalDate.now(clock.withZone(BAKU));
        return (int) Math.max(0, ChronoUnit.MONTHS.between(from, today));
    }
}
