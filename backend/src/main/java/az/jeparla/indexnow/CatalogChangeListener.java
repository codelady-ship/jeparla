package az.jeparla.indexnow;

import az.jeparla.product.Product;
import az.jeparla.product.ProductVariant;
import az.jeparla.store.Store;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * JPA entity listener of {@link Product}, {@link ProductVariant} and {@link Store} (#62): every insert, update or
 * delete of their rows is remembered for the running transaction and handed to {@link IndexNowService} only after
 * it commits, so a rolled-back change is never announced. Each entity only records its id here; the URLs are
 * looked up later on the IndexNow thread.
 *
 * <p>The daily metal-price repricing changes variants through JPA too, so the pages of metal-linked products are
 * announced once a day when their price changes (the price and its validity date are on the page). Changes made
 * with plain SQL do not pass through here: they are left to the sitemap and the engines' own crawling.
 *
 * <p>Created by Hibernate through Spring's bean container, hence a Spring bean with injected dependencies.
 */
@Component
public class CatalogChangeListener {

    /** Key of the changes of the current transaction in {@link TransactionSynchronizationManager}. */
    private static final Object RESOURCE = new Object();

    private final ObjectProvider<IndexNowService> indexNow;

    public CatalogChangeListener(ObjectProvider<IndexNowService> indexNow) {
        this.indexNow = indexNow;
    }

    @PostPersist
    @PostUpdate
    @PostRemove
    void changed(Object entity) {
        IndexNowService service = indexNow.getIfAvailable();
        if (service == null || !service.enabled()) {
            return;
        }
        CatalogChange change = switch (entity) {
            case Product product -> CatalogChange.product(product.getId(), product.wasPublicWhenLoaded());
            // The variant's product id comes from the proxy without loading the product.
            case ProductVariant variant -> CatalogChange.product(variant.getProduct().getId(), false);
            case Store store -> CatalogChange.store(store.getId(), store.wasPublicWhenLoaded(),
                    store.wasPublicWhenLoaded() != store.isPublic());
            default -> null;
        };
        if (change != null) {
            record(service, change);
        }
    }

    @SuppressWarnings("unchecked")
    private static void record(IndexNowService service, CatalogChange change) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            service.changed(Set.of(change));
            return;
        }
        Set<CatalogChange> changes = (Set<CatalogChange>) TransactionSynchronizationManager.getResource(RESOURCE);
        if (changes == null) {
            Set<CatalogChange> collected = new LinkedHashSet<>();
            changes = collected;
            TransactionSynchronizationManager.bindResource(RESOURCE, collected);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    TransactionSynchronizationManager.unbindResourceIfPossible(RESOURCE);
                    if (status == STATUS_COMMITTED) {
                        service.changed(collected);
                    }
                }
            });
        }
        changes.add(change);
    }
}
