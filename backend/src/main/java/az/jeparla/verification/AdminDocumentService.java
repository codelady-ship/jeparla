package az.jeparla.verification;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.dto.PageDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedDownload;
import az.jeparla.notification.NotificationKind;
import az.jeparla.notification.NotificationService;
import az.jeparla.product.Product;
import az.jeparla.store.Store;
import az.jeparla.verification.dto.AdminDocumentDto;
import az.jeparla.verification.dto.DocumentDecisionRequest;
import az.jeparla.verification.dto.DocumentViewDto;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The admin review of verification documents (#40, #138). Every action is audited: opening a document
 * ({@code DOCUMENT_VIEWED}, a presigned GET valid for {@link DocumentProperties#viewUrlTtl}) and every decision.
 * A refusal (REJECT or REQUEST_CHANGES) needs a reason category and notifies the seller politely, in their
 * language, in the app and by email, with what to do next. Only an approval makes a check VERIFIED
 * ({@link VerificationChecks}). An admin never reviews the documents of a store they own.
 */
@Service
@PreAuthorize("hasRole('ADMIN')")
public class AdminDocumentService {

    private static final int MAX_PAGE_SIZE = 100;
    static final String SELLER_LINK = "/merchant/documents";

    private final VerificationDocumentRepository documents;
    private final UserRepository users;
    private final VerificationChecks checks;
    private final ObjectStorage storage;
    private final NotificationService notifications;
    private final AuditService audit;
    private final MessageSource messages;
    private final DocumentProperties properties;
    private final Clock clock;

    public AdminDocumentService(VerificationDocumentRepository documents, UserRepository users,
            VerificationChecks checks, ObjectStorage storage, NotificationService notifications, AuditService audit,
            MessageSource messages, DocumentProperties properties, Clock clock) {
        this.documents = documents;
        this.users = users;
        this.checks = checks;
        this.storage = storage;
        this.notifications = notifications;
        this.audit = audit;
        this.messages = messages;
        this.properties = properties;
        this.clock = clock;
    }

    /** Documents with {@code status} (default PENDING), oldest first. */
    @Transactional(readOnly = true)
    public PageDto<AdminDocumentDto> queue(DocumentStatus status, int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.page");
        }
        return PageDto.of(documents.findQueue(status == null ? DocumentStatus.PENDING : status,
                PageRequest.of(page, size)), AdminDocumentDto::of);
    }

    @Transactional(readOnly = true)
    public AdminDocumentDto get(UUID id) {
        return AdminDocumentDto.of(find(id));
    }

    /** A short-lived download URL of the file; the view is audited. */
    @Transactional
    public DocumentViewDto view(UUID id) {
        VerificationDocument document = find(id);
        requireNotOwnStore(document.getStore());
        PresignedDownload download = storage.presignPrivateDownload(document.getStorageKey(),
                document.getContentType(), document.getFileName(), properties.viewUrlTtl());
        audit.record("DOCUMENT_VIEWED", AuditTargetType.DOCUMENT, document.getId(), document.getFileName(), null,
                "{\"storeId\":" + document.getStore().getId() + ",\"ttlSeconds\":"
                        + properties.viewUrlTtl().toSeconds() + "}");
        return new DocumentViewDto(download.url(), download.expiresAt());
    }

    /** Approves, rejects or sends back a PENDING document (409 {@code verification.already_reviewed} otherwise). */
    @Transactional
    public AdminDocumentDto decide(UUID id, DocumentDecisionRequest request) {
        VerificationDocument document = find(id);
        Store store = document.getStore();
        requireNotOwnStore(store);
        if (document.getStatus() != DocumentStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "verification.already_reviewed");
        }
        if (!store.getSellerKind().sellsPrecious()) {
            // The store became a bijouterie store after the upload: there is no documents check any more (#128).
            throw new ApiException(HttpStatus.CONFLICT, "verification.not_precious");
        }
        boolean approve = request.decision() == DocumentDecisionRequest.Decision.APPROVE;
        if (approve && request.reason() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "verification.reason_not_allowed", "reason");
        }
        if (!approve && request.reason() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "verification.reason_required", "reason");
        }
        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        DocumentStatus decision = switch (request.decision()) {
            case APPROVE -> DocumentStatus.VERIFIED;
            case REJECT -> DocumentStatus.REJECTED;
            case REQUEST_CHANGES -> DocumentStatus.CHANGES_REQUESTED;
        };
        User admin = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        Instant now = clock.instant();
        document.review(decision, request.reason(), note, admin, now);
        Product product = document.getProduct();
        if (product != null) {
            checks.refresh(product);
        } else {
            checks.refresh(store);
        }
        documents.flush();
        String action = switch (decision) {
            case VERIFIED -> "DOCUMENT_APPROVED";
            case REJECTED -> "DOCUMENT_REJECTED";
            default -> "DOCUMENT_CHANGES_REQUESTED";
        };
        audit.record(action, AuditTargetType.DOCUMENT, document.getId(), document.getFileName(),
                request.reason() == null ? note : request.reason().name() + (note == null ? "" : ": " + note),
                "{\"storeId\":" + store.getId() + ",\"productId\":" + (product == null ? "null" : product.getId())
                        + ",\"checkKind\":\"" + document.getCheckKind() + "\",\"status\":\"" + decision + "\"}");
        NotificationKind kind = switch (decision) {
            case VERIFIED -> NotificationKind.DOCUMENT_APPROVED;
            case REJECTED -> NotificationKind.DOCUMENT_REJECTED;
            default -> NotificationKind.DOCUMENT_CHANGES_REQUESTED;
        };
        RejectReason reason = request.reason();
        // The product's name in the seller's language when it has one (Azerbaijani otherwise).
        notifications.notify(store.getOwner(), kind, locale -> new Object[] {
            reason == null ? "" : messages.getMessage("verification.reason." + reason.name(), null, locale),
            document.getFileName(),
            product != null ? product.getName().in(Language.of(locale)) : store.getName()}, note, SELLER_LINK);
        return AdminDocumentDto.of(document);
    }

    private VerificationDocument find(UUID id) {
        return documents.findById(id).orElseThrow(ApiException::notFound);
    }

    /** Conflict of interest (docs/legal/sellers-liability.md 3.1): nobody reviews their own store. */
    private static void requireNotOwnStore(Store store) {
        if (store.isOwnedBy(CurrentUser.id())) {
            throw new AccessDeniedException("An admin does not review the documents of their own store");
        }
    }
}
