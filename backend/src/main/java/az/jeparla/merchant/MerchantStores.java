package az.jeparla.merchant;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.error.ApiException;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The signed-in merchant's store, found by the token {@code sub} (never by an id from the request). Call
 * it inside the {@code @Transactional} service method, so the store is managed.
 */
@Component
class MerchantStores {

    private final StoreRepository stores;

    MerchantStores(StoreRepository stores) {
        this.stores = stores;
    }

    /** The store, or 404 {@code merchant.no_store} before the seller applied with one. */
    Store own() {
        return stores.findByOwnerId(CurrentUser.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "merchant.no_store"));
    }

    /** The store for a change: a BLOCKED store is read-only (403 {@code merchant.store_blocked}). */
    Store ownWritable() {
        Store store = own();
        requireWritable(store);
        return store;
    }

    static void requireWritable(Store store) {
        if (store.getStatus() == StoreStatus.BLOCKED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "merchant.store_blocked");
        }
    }
}
