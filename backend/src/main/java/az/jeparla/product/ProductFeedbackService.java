package az.jeparla.product;

import az.jeparla.auth.User;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.dto.ProductReportRequest;
import az.jeparla.share.ReferralService;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What visitors send about a listed product (#37): WhatsApp contact clicks (statistics for the
 * merchant dashboard) and complaints about a product or a store for the admin queue (PLAN 5.8). Guests
 * may do both; the controller applies the rate limits. Hidden or unknown products and stores give 404.
 */
@Service
public class ProductFeedbackService {

    /** Click statistics are counted per business day in Azerbaijan. */
    static final ZoneId BAKU = ZoneId.of("Asia/Baku");

    private final ProductCatalogService catalog;
    private final ProductContactClickRepository clicks;
    private final ProductReportRepository reports;
    private final StoreRepository stores;
    private final EntityManager entityManager;
    private final ReferralService referrals;
    private final Clock clock;

    public ProductFeedbackService(ProductCatalogService catalog, ProductContactClickRepository clicks,
            ProductReportRepository reports, StoreRepository stores, EntityManager entityManager,
            ReferralService referrals, Clock clock) {
        this.catalog = catalog;
        this.clicks = clicks;
        this.reports = reports;
        this.stores = stores;
        this.entityManager = entityManager;
        this.referrals = referrals;
        this.clock = clock;
    }

    /**
     * Counts one WhatsApp click on a listed product and, when the visitor came through a shared store link
     * ({@code referral} names a source, #100), counts it for that source of the store as well.
     */
    @Transactional
    public void contactClick(long productId, ReferralService.Hit referral) {
        Product product = catalog.requireListed(productId);
        clicks.increment(productId, LocalDate.now(clock.withZone(BAKU)));
        if (referral != null) {
            referrals.whatsappClick(product.getStore().getId(), referral);
        }
    }

    /**
     * Saves a complaint about a listed product.
     *
     * @param reporterId the signed-in user, or null for a guest
     * @return the report id
     */
    @Transactional
    public long report(long productId, ProductReportRequest request, Long reporterId) {
        Product product = catalog.requireListed(productId);
        User reporter = reporterId == null ? null : entityManager.getReference(User.class, reporterId);
        String message = request.message() == null ? "" : request.message().strip();
        return reports.save(new ProductReport(product, reporter, request.reason(), message)).getId();
    }

    /**
     * Saves a complaint about a public (APPROVED) store as a whole; other stores give 404.
     *
     * @param reporterId the signed-in user, or null for a guest
     * @return the report id
     */
    @Transactional
    public long reportStore(long storeId, ProductReportRequest request, Long reporterId) {
        Store store = stores.findById(storeId).filter(s -> s.getStatus() == StoreStatus.APPROVED)
                .orElseThrow(ApiException::notFound);
        User reporter = reporterId == null ? null : entityManager.getReference(User.class, reporterId);
        String message = request.message() == null ? "" : request.message().strip();
        return reports.save(ProductReport.aboutStore(store, reporter, request.reason(), message)).getId();
    }
}
