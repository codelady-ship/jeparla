package az.jeparla.product;

import az.jeparla.auth.User;
import az.jeparla.product.dto.ProductReportRequest;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What visitors send about a listed product (#37): WhatsApp contact clicks (statistics for the
 * merchant dashboard) and complaints for the admin queue (PLAN 5.8). Guests may do both; the
 * controller applies the rate limits. Hidden or unknown products give 404.
 */
@Service
public class ProductFeedbackService {

    /** Click statistics are counted per business day in Azerbaijan. */
    static final ZoneId BAKU = ZoneId.of("Asia/Baku");

    private final ProductCatalogService catalog;
    private final ProductContactClickRepository clicks;
    private final ProductReportRepository reports;
    private final EntityManager entityManager;
    private final Clock clock;

    public ProductFeedbackService(ProductCatalogService catalog, ProductContactClickRepository clicks,
            ProductReportRepository reports, EntityManager entityManager, Clock clock) {
        this.catalog = catalog;
        this.clicks = clicks;
        this.reports = reports;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    /** Counts one WhatsApp click on a listed product. */
    @Transactional
    public void contactClick(long productId) {
        catalog.requireListed(productId);
        clicks.increment(productId, LocalDate.now(clock.withZone(BAKU)));
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
}
