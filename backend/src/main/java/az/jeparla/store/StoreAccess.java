package az.jeparla.store;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.error.ApiException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Ownership check for merchant endpoints (docs/RBAC.md): a merchant changes only their own store.
 * The user id comes from the verified access token, never from the request.
 *
 * <p>Call it inside the {@code @Transactional} service method that changes the store, so the
 * returned entity is managed.
 */
@Component
public class StoreAccess {

    private final StoreRepository stores;

    public StoreAccess(StoreRepository stores) {
        this.stores = stores;
    }

    /**
     * @return the store when the signed-in user owns it
     * @throws AccessDeniedException 403 when it belongs to someone else
     * @throws ApiException          404 when it does not exist
     */
    public Store requireOwner(long storeId) {
        long userId = CurrentUser.id();
        return stores.findByIdAndOwnerId(storeId, userId).orElseThrow(() -> stores.existsById(storeId)
                ? new AccessDeniedException("Store " + storeId + " is not owned by user " + userId)
                : ApiException.notFound());
    }
}
