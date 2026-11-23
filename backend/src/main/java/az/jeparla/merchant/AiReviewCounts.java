package az.jeparla.merchant;

import jakarta.persistence.EntityManager;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * AI Studio results that wait for the seller's approval (#316): jobs in {@code REVIEW_REQUIRED} of the store's
 * products that are not deleted. Read with SQL on {@code ai_jobs} (index V66) so the merchant package does not
 * depend on the AI package, which already depends on it. Callers resolve the store through the signed-in user.
 */
@Component
class AiReviewCounts {

    private static final String WAITING = "FROM ai_jobs j JOIN products p ON p.id = j.product_id"
            + " WHERE j.store_id = :storeId AND j.status = 'REVIEW_REQUIRED' AND p.deleted_at IS NULL";

    private final EntityManager entityManager;

    AiReviewCounts(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** Results waiting for approval in the whole store. */
    long total(long storeId) {
        Number count = (Number) entityManager.createNativeQuery("SELECT count(*) " + WAITING)
                .setParameter("storeId", storeId).getSingleResult();
        return count.longValue();
    }

    /** Results waiting for approval per product; products without any are absent. */
    Map<Long, Integer> byProduct(long storeId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT j.product_id, count(*) " + WAITING + " GROUP BY j.product_id")
                .setParameter("storeId", storeId).getResultList();
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
        }
        return counts;
    }
}
