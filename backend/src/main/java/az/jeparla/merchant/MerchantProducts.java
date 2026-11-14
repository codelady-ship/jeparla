package az.jeparla.merchant;

import az.jeparla.common.error.ApiException;
import az.jeparla.product.Product;
import az.jeparla.product.ProductAccess;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductStatus;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.CheckStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import org.springframework.stereotype.Component;

/**
 * Shared steps of the merchant product services: the seller's product by id (ownership) and what a change
 * does to its status. Call inside the {@code @Transactional} service method.
 */
@Component
public class MerchantProducts {

    private final ProductAccess access;
    private final ProductRepository products;
    private final EntityManager entityManager;

    MerchantProducts(ProductAccess access, ProductRepository products, EntityManager entityManager) {
        this.access = access;
        this.products = products;
        this.entityManager = entityManager;
    }

    /** The seller's product, not deleted: 403 another seller's, 404 missing or deleted. */
    public Product owned(long productId) {
        Product product = access.requireOwner(productId);
        if (product.isDeleted()) {
            throw ApiException.notFound();
        }
        return product;
    }

    /** {@link #owned} for a change: the product of a BLOCKED store is read-only. */
    public Product ownedWritable(long productId) {
        Product product = owned(productId);
        MerchantStores.requireWritable(product.getStore());
        return product;
    }

    /**
     * After a change: when what is sold changed, an APPROVED product is reviewed again (or becomes a draft
     * when its seller can no longer submit) and a hidden or deactivated product becomes a draft.
     */
    public void afterChange(Product product, boolean content, Instant now) {
        if (!content) {
            return;
        }
        if (product.getStatus() == ProductStatus.APPROVED) {
            if (canSubmit(product.getStore())) {
                product.submitForReview(now);
            } else {
                product.backToDraft();
            }
        } else if (product.getStatus() == ProductStatus.INACTIVE) {
            product.backToDraft();
        }
    }

    /**
     * Locks the product's store row ({@code SELECT ... FOR UPDATE}) until the end of the transaction, so
     * concurrent requests of one store that count something (e.g. open photo uploads) take turns.
     */
    public void lockStore(Product product) {
        entityManager.find(Store.class, product.getStore().getId(), LockModeType.PESSIMISTIC_WRITE);
    }

    public void flush() {
        products.flush();
    }

    /** Only an approved store whose seller is verified sends products to review (PLAN 5.6, 5.9). */
    static boolean canSubmit(Store store) {
        return store.getStatus() == StoreStatus.APPROVED && store.getSellerStatus() == CheckStatus.VERIFIED;
    }
}
