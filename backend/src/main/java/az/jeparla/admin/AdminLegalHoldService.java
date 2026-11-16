package az.jeparla.admin;

import az.jeparla.admin.dto.LegalHoldDto;
import az.jeparla.admin.dto.LegalHoldRequest;
import az.jeparla.common.error.ApiException;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Legal hold on a store's evidence (#138, docs/legal/analysis.md section 5): while it is set, the declaration
 * retention job leaves the store's declarations and their audit rows unchanged. Every change is audited
 * ({@code LEGAL_HOLD_PLACED}, {@code LEGAL_HOLD_RELEASED}) with the reason.
 */
@Service
public class AdminLegalHoldService {

    static final int MIN_REASON = 10;

    private final StoreRepository stores;
    private final AuditService audit;
    private final Clock clock;

    public AdminLegalHoldService(StoreRepository stores, AuditService audit, Clock clock) {
        this.stores = stores;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public LegalHoldDto get(long storeId) {
        return dto(stores.findById(storeId).orElseThrow(ApiException::notFound));
    }

    @Transactional
    public LegalHoldDto change(long storeId, LegalHoldRequest request) {
        Store store = stores.findById(storeId).orElseThrow(ApiException::notFound);
        String reason = request.reason() == null ? "" : request.reason().strip();
        if (request.hold()) {
            if (reason.length() < MIN_REASON) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "admin.reason_required", "reason");
            }
            store.placeLegalHold(reason, clock.instant());
            audit.record("LEGAL_HOLD_PLACED", AuditTargetType.STORE, store.getId(), store.getName(), reason, null);
        } else if (store.getLegalHoldAt() != null) {
            store.releaseLegalHold();
            audit.record("LEGAL_HOLD_RELEASED", AuditTargetType.STORE, store.getId(), store.getName(),
                    reason.isEmpty() ? null : reason, null);
        }
        return dto(store);
    }

    private static LegalHoldDto dto(Store store) {
        return new LegalHoldDto(store.getId(), store.getLegalHoldAt(), store.getLegalHoldReason());
    }
}
