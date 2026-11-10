package az.jeparla.verification;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.User;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedUpload;
import az.jeparla.common.storage.ObjectStorage.StoredObject;
import az.jeparla.common.storage.StagedUploadChangedException;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Product;
import az.jeparla.product.ProductAccess;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import az.jeparla.verification.dto.DeclarationDto;
import az.jeparla.verification.dto.DocumentConfirmRequest;
import az.jeparla.verification.dto.DocumentUploadDto;
import az.jeparla.verification.dto.DocumentUploadRequest;
import az.jeparla.verification.dto.MerchantDocumentDto;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.net.InetAddress;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Verification documents of a precious-metal seller (#40, #138), the seller's side.
 *
 * <ul>
 *   <li><b>Only precious sellers.</b> Documents and expertise are checks of precious metal and stones: a
 *       FASHION store (bijouterie, handmade) and a FASHION product never upload one (403
 *       {@code verification.not_precious}); their checks stay NONE (the database refuses anything else,
 *       V13).</li>
 *   <li><b>Private files.</b> The browser PUTs the file to a presigned URL in the private bucket, under
 *       {@code staging/documents/<store>/<uuid>.<ext>}. On confirmation the API checks the staged object (it was
 *       issued to this store, its size, its first bytes are the PDF, JPEG or PNG it announced), hashes it
 *       (SHA-256, kept as evidence) and moves it to {@code documents/...} in the same private bucket. Nothing
 *       ever reaches the public bucket, and no response carries the key back to a URL.</li>
 *   <li><b>Declaration.</b> Every upload is confirmed with the declaration ({@link DeclarationText}, draft until
 *       the lawyer approves it, #57): without {@code declarationAccepted: true} 400
 *       {@code verification.declaration_required}, with an older version 409
 *       {@code verification.declaration_outdated}. The text shown, its version and language, the user, the
 *       time and the IP are saved ({@link SellerDeclaration}) and audited.</li>
 *   <li><b>Limits</b> as for photos (#154): {@code document-upload-account} per seller (controller),
 *       {@link DocumentProperties#openUploadsPerStore} open uploads (409 {@code verification.upload_limit}) and
 *       {@link DocumentProperties#dailyUploadsPerStore} per day (429) per store.</li>
 * </ul>
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantDocumentService {

    private static final Logger log = LoggerFactory.getLogger(MerchantDocumentService.class);

    /** 10 MB, as the CHECK of verification_documents and the seller form. */
    public static final long MAX_BYTES = 10L * 1024 * 1024;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(10);
    static final Duration CONFIRM_GRACE = Duration.ofMinutes(30);
    static final Duration DAILY_WINDOW = Duration.ofHours(24);

    /** Accepted types and the key extension of each. */
    static final Map<String, String> EXTENSIONS = Map.of(
            "application/pdf", "pdf", "image/jpeg", "jpg", "image/png", "png");

    /** Kinds each check accepts. */
    private static final Map<CheckKind, Set<DocumentKind>> KINDS = Map.of(
            CheckKind.DOCUMENTS, EnumSet.of(DocumentKind.TAX_ID, DocumentKind.TRADE_LICENSE),
            CheckKind.EXPERTISE, EnumSet.of(DocumentKind.ASSAY_CERTIFICATE, DocumentKind.LAB_REPORT));

    /** File names are shown to admins only; control characters and path separators are dropped. */
    private static final Pattern UNSAFE_NAME = Pattern.compile("[\\p{Cntrl}/\\\\]");

    private final StoreRepository stores;
    private final UserRepository users;
    private final ProductAccess productAccess;
    private final VerificationDocumentRepository documents;
    private final DocumentUploadSlotRepository slots;
    private final SellerDeclarationRepository declarations;
    private final VerificationChecks checks;
    private final DeclarationText declarationText;
    private final ObjectStorage storage;
    private final AuditService audit;
    private final DocumentProperties properties;
    private final EntityManager entityManager;
    private final Clock clock;

    public MerchantDocumentService(StoreRepository stores, UserRepository users, ProductAccess productAccess,
            VerificationDocumentRepository documents, DocumentUploadSlotRepository slots,
            SellerDeclarationRepository declarations, VerificationChecks checks, DeclarationText declarationText,
            ObjectStorage storage, AuditService audit, DocumentProperties properties, EntityManager entityManager,
            Clock clock) {
        this.stores = stores;
        this.users = users;
        this.productAccess = productAccess;
        this.documents = documents;
        this.slots = slots;
        this.declarations = declarations;
        this.checks = checks;
        this.declarationText = declarationText;
        this.storage = storage;
        this.audit = audit;
        this.properties = properties;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    /** The current declaration in the request language. */
    @Transactional(readOnly = true)
    public DeclarationDto declaration() {
        Language language = requestLanguage();
        return new DeclarationDto(DeclarationText.VERSION, language.code(), declarationText.text(language),
                DeclarationText.DRAFT);
    }

    /** The store's documents, newest first; FASHION stores have none. */
    @Transactional(readOnly = true)
    public List<MerchantDocumentDto> list() {
        Store store = ownStore();
        return documents.findByStoreIdOrderByCreatedAtDesc(store.getId()).stream().map(MerchantDocumentDto::of)
                .toList();
    }

    /** A presigned upload for one document: 403 for a FASHION seller or product, 400, 409 and 429 on limits. */
    @Transactional
    public DocumentUploadDto upload(DocumentUploadRequest request) {
        Store store = ownWritableStore();
        requirePrecious(store);
        if (!KINDS.get(request.checkKind()).contains(request.kind())) {
            throw invalid("verification.document_kind", "kind");
        }
        Long productId = null;
        if (request.checkKind() == CheckKind.EXPERTISE) {
            if (request.productId() == null) {
                throw invalid("verification.product_required", "productId");
            }
            Product product = productAccess.requireOwner(request.productId());
            if (product.isDeleted()) {
                throw ApiException.notFound();
            }
            if (product.getMaterialKind() != MaterialKind.PRECIOUS) {
                throw new ApiException(HttpStatus.FORBIDDEN, "verification.not_precious");
            }
            productId = product.getId();
        } else if (request.productId() != null) {
            throw invalid("verification.product_not_allowed", "productId");
        }
        String type = request.contentType().strip().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(type);
        if (extension == null) {
            throw invalid("verification.document_type", "contentType");
        }
        if (request.sizeBytes() > MAX_BYTES) {
            throw invalid("verification.document_size", "sizeBytes");
        }
        String fileName = safeFileName(request.fileName());
        // Requests of one store take turns, so two at once cannot both take the last place.
        entityManager.find(Store.class, store.getId(), LockModeType.PESSIMISTIC_WRITE);
        Instant now = clock.instant();
        if (slots.countOpen(store.getId(), now) >= properties.openUploadsPerStore()) {
            throw new ApiException(HttpStatus.CONFLICT, "verification.upload_limit");
        }
        Instant dayAgo = now.minus(DAILY_WINDOW);
        if (slots.countByStoreIdAndCreatedAtAfter(store.getId(), dayAgo) >= properties.dailyUploadsPerStore()) {
            Instant oldest = slots.findFirstByStoreIdAndCreatedAtAfterOrderByCreatedAtAsc(store.getId(), dayAgo)
                    .map(DocumentUploadSlot::getCreatedAt).orElse(now);
            log.info("Daily document upload limit reached by store {}", store.getId());
            throw new RateLimitExceededException(
                    Math.max(1, Duration.between(now, oldest.plus(DAILY_WINDOW)).toSeconds() + 1));
        }
        String key = prefix(store.getId()) + UUID.randomUUID() + "." + extension;
        slots.save(new DocumentUploadSlot(key, store.getId(), productId, request.checkKind(), request.kind(), fileName,
                type, request.sizeBytes(), now, now.plus(UPLOAD_TTL)));
        PresignedUpload upload = storage.presignStagedUpload(key, type, request.sizeBytes(), UPLOAD_TTL);
        return new DocumentUploadDto(key, upload.url(), upload.method(), upload.headers(), upload.expiresAt(),
                MAX_BYTES);
    }

    /**
     * Confirms an uploaded document with the declaration: checks the stored file, keeps it privately, saves
     * the declaration and the document (PENDING) and sets the check to PENDING. 201 with the document.
     */
    @Transactional
    public MerchantDocumentDto confirm(DocumentConfirmRequest request) {
        Store store = ownWritableStore();
        requirePrecious(store);
        if (!request.accepted()) {
            throw invalid("verification.declaration_required", "declarationAccepted");
        }
        if (!DeclarationText.VERSION.equals(request.declarationVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "verification.declaration_outdated");
        }
        entityManager.find(Store.class, store.getId(), LockModeType.PESSIMISTIC_WRITE);
        String key = request.key().strip();
        Instant now = clock.instant();
        DocumentUploadSlot slot = slots.findByStorageKey(key)
                .filter(s -> s.getStoreId() == store.getId() && s.isOpen()
                        && now.isBefore(s.getExpiresAt().plus(CONFIRM_GRACE)))
                .orElseThrow(() -> invalid("verification.document_missing", "key"));
        Product product = null;
        if (slot.getProductId() != null) {
            product = productAccess.requireOwner(slot.getProductId());
            if (product.isDeleted() || product.getMaterialKind() != MaterialKind.PRECIOUS) {
                throw new ApiException(HttpStatus.FORBIDDEN, "verification.not_precious");
            }
        }
        StoredObject stored = storage.headStaged(key).orElseThrow(() -> invalid("verification.document_missing", "key"));
        if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MAX_BYTES) {
            discardStaged(slot, now);
            throw invalid("verification.document_size", "key");
        }
        String sha256;
        try {
            if (!DocumentProbe.contentType(storage.readStagedStart(key, stored, DocumentProbe.HEADER_BYTES))
                    .filter(slot.getContentType()::equals).isPresent()) {
                discardStaged(slot, now);
                throw invalid("verification.document_type", "key");
            }
            sha256 = storage.sha256Staged(key, stored);
        } catch (StagedUploadChangedException e) {
            discardStaged(slot, now);
            throw invalid("verification.document_missing", "key");
        }
        if (documents.existsByStoreIdAndSha256AndStatusIn(store.getId(), sha256,
                EnumSet.of(DocumentStatus.PENDING, DocumentStatus.VERIFIED))) {
            discardStaged(slot, now);
            throw new ApiException(HttpStatus.CONFLICT, "verification.document_duplicate");
        }

        User seller = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        Language language = request.declarationLanguage() != null
                ? Language.fromCode(request.declarationLanguage()) : requestLanguage();
        SellerDeclaration declaration = declarations.save(new SellerDeclaration(seller, label(seller), store,
                DeclarationText.VERSION, language, declarationText.text(language), clientIp(), now));
        VerificationDocument document = new VerificationDocument(store, product, slot.getCheckKind(), slot.getKind(),
                key, slot.getFileName(), slot.getContentType(), stored.sizeBytes(), sha256, seller);
        document.setDeclaration(declaration);
        documents.save(document);
        slot.attached(now);
        if (product != null) {
            checks.refresh(product);
        } else {
            checks.refresh(store);
        }
        documents.flush();
        audit.record("DECLARATION_CONFIRMED", AuditTargetType.STORE, store.getId(), store.getName(), null,
                "{\"declarationId\":" + declaration.getId() + ",\"version\":\"" + DeclarationText.VERSION
                        + "\",\"language\":\"" + language.code() + "\"}");
        audit.record("DOCUMENT_UPLOADED", AuditTargetType.DOCUMENT, document.getId(), document.getFileName(), null,
                "{\"storeId\":" + store.getId() + ",\"productId\":" + (product == null ? "null" : product.getId())
                        + ",\"checkKind\":\"" + document.getCheckKind() + "\",\"kind\":\"" + document.getKind()
                        + "\",\"sizeBytes\":" + document.getSizeBytes() + ",\"sha256\":\"" + sha256
                        + "\",\"declarationId\":" + declaration.getId() + "}");
        // Registered before the move: a move that succeeded on the server but failed in the client still removes
        // the private copy when the transaction rolls back (#158).
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deletePrivate(key);
                }
            }
        });
        try {
            storage.keepStagedPrivate(key, stored);
        } catch (StagedUploadChangedException e) {
            log.info("Staged document {} changed after its check", key);
            discardStagedQuietly(key);
            throw invalid("verification.document_missing", "key");
        }
        return MerchantDocumentDto.of(document);
    }

    private Store ownStore() {
        return stores.findByOwnerId(CurrentUser.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "merchant.no_store"));
    }

    private Store ownWritableStore() {
        Store store = ownStore();
        if (store.getStatus() == StoreStatus.BLOCKED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "merchant.store_blocked");
        }
        return store;
    }

    /** Documents are asked only of precious-metal sellers (#128): a FASHION store has nothing to certify. */
    private static void requirePrecious(Store store) {
        if (!store.getSellerKind().sellsPrecious()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "verification.not_precious");
        }
    }

    static String prefix(long storeId) {
        return "documents/" + storeId + "/";
    }

    static String safeFileName(String fileName) {
        String name = UNSAFE_NAME.matcher(fileName).replaceAll("_").strip();
        return name.isEmpty() ? "document" : name;
    }

    private void discardStaged(DocumentUploadSlot slot, Instant now) {
        discardStagedQuietly(slot.getStorageKey());
        slot.discarded(now);
    }

    /** Best effort: a staged file left behind is private and removed by the cleanup job or the lifecycle rule. */
    private void discardStagedQuietly(String key) {
        try {
            storage.deleteStaged(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete staged document {}: {}", key, e.toString());
        }
    }

    private void deletePrivate(String key) {
        try {
            storage.deletePrivate(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete private document {}: {}", key, e.toString());
        }
    }

    private static Language requestLanguage() {
        String language = LocaleContextHolder.getLocale().getLanguage();
        return switch (language) {
            case "en" -> Language.EN;
            case "ru" -> Language.RU;
            default -> Language.AZ;
        };
    }

    static String label(User user) {
        String contact = user.getEmail() != null ? user.getEmail() : user.getPhone();
        return user.getDisplayName() + " <" + contact + ">";
    }

    private static InetAddress clientIp() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servlet)) {
            return null;
        }
        return IpAddresses.parse(servlet.getRequest().getRemoteAddr());
    }

    private static ApiException invalid(String code, String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, field);
    }
}
