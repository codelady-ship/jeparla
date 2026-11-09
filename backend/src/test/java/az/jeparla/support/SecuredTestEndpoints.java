package az.jeparla.support;

import az.jeparla.product.ProductAccess;
import az.jeparla.store.Store;
import az.jeparla.store.StoreAccess;
import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only protected endpoints: one per URL rule (admin, merchant, signed-in), method security
 * on a public URL, and the ownership guards.
 */
@TestConfiguration(proxyBeanMethods = false)
public class SecuredTestEndpoints {

    @RestController
    public static class ProtectedController {

        private final StoreAccess storeAccess;
        private final ProductAccess productAccess;

        public ProtectedController(StoreAccess storeAccess, ProductAccess productAccess) {
            this.storeAccess = storeAccess;
            this.productAccess = productAccess;
        }

        @GetMapping("/api/v1/admin/test/ping")
        public Map<String, String> admin() {
            return Map.of("status", "admin");
        }

        @GetMapping("/api/v1/merchant/test/ping")
        public Map<String, String> merchant() {
            return Map.of("status", "merchant");
        }

        /** Any signed-in user (POST under /api/v1 is not public). */
        @PostMapping("/api/v1/test/secure/ping")
        public Map<String, String> signedIn() {
            return Map.of("status", "signed-in");
        }

        /** Public URL (GET), protected by method security only. */
        @GetMapping("/api/v1/test/secure/merchant-only")
        @PreAuthorize("hasRole('MERCHANT')")
        public Map<String, String> merchantOnlyMethod() {
            return Map.of("status", "merchant");
        }

        /** Role hierarchy: MERCHANT and ADMIN include USER. */
        @PostMapping("/api/v1/test/secure/user-only")
        @PreAuthorize("hasRole('USER')")
        public Map<String, String> userOnlyMethod() {
            return Map.of("status", "user");
        }

        @PatchMapping("/api/v1/merchant/test/stores/{storeId}")
        public Map<String, Object> editStore(@PathVariable long storeId) {
            Store store = storeAccess.requireOwner(storeId);
            return Map.of("id", store.getId());
        }

        @PatchMapping("/api/v1/merchant/test/products/{productId}")
        public Map<String, Object> editProduct(@PathVariable long productId) {
            return Map.of("id", productAccess.requireOwner(productId).getId());
        }
    }
}
