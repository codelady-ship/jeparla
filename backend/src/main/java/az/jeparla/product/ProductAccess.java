package az.jeparla.product;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.error.ApiException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Ownership check for merchant product endpoints (docs/RBAC.md): a merchant changes only the
 * products of their own store. Same contract as {@code StoreAccess}.
 */
@Component
public class ProductAccess {

    private final ProductRepository products;

    public ProductAccess(ProductRepository products) {
        this.products = products;
    }

    /**
     * @return the product (with its store) when the signed-in user owns its store
     * @throws AccessDeniedException 403 when the product belongs to another store
     * @throws ApiException          404 when it does not exist
     */
    public Product requireOwner(long productId) {
        long userId = CurrentUser.id();
        return products.findByIdAndStoreOwnerId(productId, userId).orElseThrow(() -> products.existsById(productId)
                ? new AccessDeniedException("Product " + productId + " is not owned by user " + userId)
                : ApiException.notFound());
    }
}
