package az.jeparla.merchant;

import az.jeparla.merchant.dto.MerchantDashboardDto;
import az.jeparla.merchant.dto.MerchantStoreDto;
import az.jeparla.merchant.dto.StoreProfileRequest;
import az.jeparla.merchant.dto.StoreRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The seller's store (#39): MERCHANT only, always the store of the signed-in user. */
@RestController
@RequestMapping("/api/v1/merchant")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: store", description = "Store application, profile and dashboard (MERCHANT)")
public class MerchantStoreController {

    private final MerchantStoreService stores;

    public MerchantStoreController(MerchantStoreService stores) {
        this.stores = stores;
    }

    @PostMapping("/stores")
    @Operation(summary = "Apply with a store (one per account)",
            description = "201 created; 200 when the Idempotency-Key repeats the request that created it; 409 "
                    + "merchant.store_exists otherwise.")
    public ResponseEntity<MerchantStoreDto> create(@Valid @RequestBody StoreRequest request,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey) {
        Created<MerchantStoreDto> result = stores.create(request, IdempotencyKeys.parse(idempotencyKey));
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.body());
    }

    @GetMapping("/store")
    @Operation(summary = "The seller's store", description = "404 merchant.no_store before the application.")
    public MerchantStoreDto get() {
        return stores.get();
    }

    @PutMapping("/store")
    @Operation(summary = "Change the store profile")
    public MerchantStoreDto update(@Valid @RequestBody StoreProfileRequest request) {
        return stores.update(request);
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Products per status and WhatsApp clicks of the last 30 days")
    public MerchantDashboardDto dashboard() {
        return stores.dashboard();
    }
}
