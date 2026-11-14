package az.jeparla.verification;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.notification.NotificationKind;
import az.jeparla.notification.NotificationService;
import az.jeparla.store.Store;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.dto.StoreSuspensionDto;
import az.jeparla.verification.dto.SuspensionDecisionRequest;
import java.time.Clock;
import java.time.Instant;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Suspected forged documents (#138, docs/legal/sellers-liability.md 3.1 and 2d). Rejecting a document for
 * {@link RejectReason#AUTHENTICITY} opens a suspension request ({@link #open}); only a second admin can confirm
 * it. Confirming hides the store and all its products (status BLOCKED) and sends the seller the non-accusing
 * notice {@code store_suspended} in their language, in the app and by email. Every step is audited; the
 * requester can neither confirm nor dismiss their own request, and nobody decides about a store they own.
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class StoreSuspensionService {

    private static final int MAX_PAGE_SIZE = 100;
    static final String SELLER_LINK = "/merchant";

    private final StoreSuspensionRequestRepository requests;
    private final UserRepository users;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public StoreSuspensionService(StoreSuspensionRequestRepository requests, UserRepository users,
            NotificationService notifications, AuditService audit, Clock clock) {
        this.requests = requests;
        this.users = users;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * Opens a PENDING request for the store of a document rejected for AUTHENTICITY, unless one is already open.
     * Runs in the caller's transaction (the document decision).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void open(VerificationDocument document, User admin, String note) {
        Store store = document.getStore();
        if (requests.existsByStoreIdAndStatus(store.getId(), StoreSuspensionRequest.Status.PENDING)) {
            return;
        }
        StoreSuspensionRequest request = requests.save(
                new StoreSuspensionRequest(store, document, admin, note, clock.instant()));
        audit.record("STORE_SUSPENSION_REQUESTED", AuditTargetType.STORE, store.getId(), store.getName(), note,
                "{\"requestId\":" + request.getId() + ",\"documentId\":\"" + document.getId() + "\"}");
    }

    /** Requests with {@code status} (default PENDING), oldest first. */
    @Transactional(readOnly = true)
    public PageDto<StoreSuspensionDto> queue(StoreSuspensionRequest.Status status, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.page");
        }
        return PageDto.of(requests.findQueue(status == null ? StoreSuspensionRequest.Status.PENDING : status,
                PageRequest.of(page, size)), StoreSuspensionDto::of);
    }

    /** The second admin confirms (store BLOCKED, seller notified) or dismisses a PENDING request. */
    @Transactional
    public StoreSuspensionDto decide(long id, SuspensionDecisionRequest decision) {
        StoreSuspensionRequest request = requests.findById(id).orElseThrow(ApiException::notFound);
        Store store = request.getStore();
        Long adminId = CurrentUser.id();
        if (store.isOwnedBy(adminId)) {
            throw new AccessDeniedException("An admin does not decide about their own store");
        }
        if (request.getStatus() != StoreSuspensionRequest.Status.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "verification.suspension_decided");
        }
        if (request.isRequestedBy(adminId)) {
            // Four eyes: the admin who suspected the document cannot also suspend the store.
            throw new ApiException(HttpStatus.CONFLICT, "verification.four_eyes");
        }
        User admin = users.findById(adminId).orElseThrow(ApiException::notFound);
        boolean confirm = decision.decision() == SuspensionDecisionRequest.Decision.CONFIRM;
        String note = decision.note() == null || decision.note().isBlank() ? null : decision.note().strip();
        Instant now = clock.instant();
        request.decide(confirm, admin, note, now);
        StoreStatus from = store.getStatus();
        if (confirm && from != StoreStatus.BLOCKED) {
            store.setStatus(StoreStatus.BLOCKED);
            // Internal wording only; the seller reads the notice of section 2d, never this note.
            store.setStatusNote("AUTHENTICITY review");
        }
        requests.flush();
        audit.record(confirm ? "STORE_SUSPENDED" : "STORE_SUSPENSION_DISMISSED", AuditTargetType.STORE,
                store.getId(), store.getName(), note,
                "{\"requestId\":" + request.getId() + ",\"from\":\"" + from + "\",\"to\":\""
                        + store.getStatus() + "\"}");
        if (confirm) {
            notifications.notify(store.getOwner(), NotificationKind.STORE_SUSPENDED,
                    locale -> new Object[] {store.getName()}, null, SELLER_LINK);
        }
        return StoreSuspensionDto.of(request);
    }
}
