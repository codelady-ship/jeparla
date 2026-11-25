package az.jeparla.merchant;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageProbe.ImageInfo;
import az.jeparla.common.storage.ObjectStorage;
import az.jeparla.common.storage.ObjectStorage.PresignedDownload;
import az.jeparla.common.storage.ObjectStorage.PresignedUpload;
import az.jeparla.common.storage.ObjectStorage.StoredObject;
import az.jeparla.common.storage.StagedUploadChangedException;
import az.jeparla.merchant.dto.DraftDtos.DraftDto;
import az.jeparla.merchant.dto.DraftDtos.PdfRequest;
import az.jeparla.merchant.dto.DraftDtos.PdfResultDto;
import az.jeparla.merchant.dto.DraftDtos.PhotoRequest;
import az.jeparla.merchant.dto.DraftDtos.UploadKind;
import az.jeparla.merchant.dto.DraftDtos.UploadRequest;
import az.jeparla.merchant.dto.ImageUploadDto;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Product drafts from photos and catalog PDFs (#129, #109), so the first products take minutes, not hours.
 *
 * <ul>
 *   <li><b>Photos</b> (one from the phone camera, or many picked at once): a presigned PUT into private staging
 *       ({@code drafts/<store>/<uuid>.<ext>}), then {@code POST /drafts} checks the staged file like a product
 *       photo (size, magic bytes, dimensions) and keeps it in the <b>private</b> bucket. One draft per photo.</li>
 *   <li><b>Catalog PDF</b> (at most {@value #MAX_PDF_BYTES} bytes): a presigned PUT, then {@code POST /drafts/pdf}
 *       reads it once, takes the photos out ({@link CatalogPdf}: PDFBox, images and text only), stores each as a
 *       private JPEG draft with the name, price and weight its page suggests (only when the page has one photo),
 *       and deletes the PDF. Suggestions are never published: the seller confirms them in the form.</li>
 *   <li>The seller lists drafts (short-lived private links), turns one into a product with the normal form and
 *       photo upload, and deletes it. Another seller's draft is 403.</li>
 * </ul>
 * Limits: {@link #DAILY_DRAFTS} drafts per store in 24 hours (429), the rate-limit policies in the controller.
 * No paid or AI service is involved.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantDraftService {

    private static final Logger log = LoggerFactory.getLogger(MerchantDraftService.class);

    static final long MAX_PDF_BYTES = 20L * 1024 * 1024;
    static final int DAILY_DRAFTS = 300;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(10);
    static final Duration VIEW_TTL = Duration.ofMinutes(15);
    private static final Duration DAY = Duration.ofHours(24);
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private final MerchantStores merchantStores;
    private final ProductDraftRepository drafts;
    private final ObjectStorage storage;
    private final AuditService audit;
    private final Clock clock;
    private final TransactionTemplate tx;

    public MerchantDraftService(MerchantStores merchantStores, ProductDraftRepository drafts, ObjectStorage storage,
            AuditService audit, Clock clock, PlatformTransactionManager transactions) {
        this.merchantStores = merchantStores;
        this.drafts = drafts;
        this.storage = storage;
        this.audit = audit;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactions);
    }

    /** A presigned PUT for one photo (JPEG, PNG, WebP up to 15 MB) or one PDF. */
    public ImageUploadDto upload(UploadRequest request) {
        long storeId = writableStoreId();
        String type = request.contentType().strip().toLowerCase(Locale.ROOT);
        String extension;
        long maxBytes;
        if (request.kind() == UploadKind.PDF) {
            if (!type.equals("application/pdf")) {
                throw invalid("merchant.pdf_type", "contentType");
            }
            extension = "pdf";
            maxBytes = MAX_PDF_BYTES;
        } else {
            extension = MerchantImageService.EXTENSIONS.get(type);
            if (extension == null) {
                throw invalid("merchant.image_type", "contentType");
            }
            maxBytes = MerchantImageService.MAX_BYTES;
        }
        if (request.sizeBytes() > maxBytes) {
            throw invalid(request.kind() == UploadKind.PDF ? "merchant.pdf_size" : "merchant.image_size", "sizeBytes");
        }
        requireUnderDailyLimit(storeId, 1);
        String key = prefix(storeId) + UUID.randomUUID() + "." + extension;
        PresignedUpload upload = storage.presignStagedUpload(key, type, request.sizeBytes(), UPLOAD_TTL);
        return new ImageUploadDto(key, upload.url(), upload.method(), upload.headers(), upload.expiresAt(), maxBytes);
    }

    /** The uploaded photo becomes a draft; the same key twice is refused (the staged file is gone). */
    public DraftDto photo(PhotoRequest request) {
        if (request.kind() == UploadKind.PDF) {
            throw invalid("merchant.image_type", "kind");
        }
        long storeId = writableStoreId();
        String key = request.key().strip();
        if (!photoKey(storeId).matcher(key).matches()) {
            throw invalid("merchant.image_key", "key");
        }
        requireUnderDailyLimit(storeId, 1);
        StoredObject stored = storage.headStaged(key).orElseThrow(() -> invalid("merchant.image_missing", "key"));
        if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MerchantImageService.MAX_BYTES) {
            storage.deleteStaged(key);
            throw invalid("merchant.image_size", "key");
        }
        String expected = MerchantImageService.EXTENSIONS.entrySet().stream()
                .filter(entry -> key.endsWith("." + entry.getValue())).map(Map.Entry::getKey).findFirst().orElseThrow();
        ImageInfo info;
        try {
            info = ImageProbe.probe(storage.readStagedStart(key, stored, ImageProbe.HEADER_BYTES))
                    .filter(found -> found.contentType().equals(expected))
                    .orElse(null);
            if (info == null || info.width() > MerchantImageService.MAX_SIDE
                    || info.height() > MerchantImageService.MAX_SIDE) {
                storage.deleteStaged(key);
                throw invalid(info == null ? "merchant.image_type" : "merchant.image_dimensions", "key");
            }
            storage.keepStagedPrivate(key, stored);
        } catch (StagedUploadChangedException e) {
            storage.deleteStaged(key);
            throw invalid("merchant.image_missing", "key");
        }
        ImageInfo checked = info;
        ProductDraft.Source source = request.kind() == UploadKind.CAMERA ? ProductDraft.Source.CAMERA
                : ProductDraft.Source.PHOTO;
        ProductDraft draft = tx.execute(status -> drafts.save(new ProductDraft(storeId, source, key, expected,
                checked.width(), checked.height(), null, null, clock.instant())));
        return dto(draft);
    }

    /** One draft per photo of the uploaded PDF; the PDF itself is deleted after it is read. */
    public PdfResultDto pdf(PdfRequest request) {
        long storeId = writableStoreId();
        String key = request.key().strip();
        if (!pdfKey(storeId).matcher(key).matches()) {
            throw invalid("merchant.pdf_key", "key");
        }
        StoredObject stored = storage.headStaged(key).orElseThrow(() -> invalid("merchant.pdf_missing", "key"));
        byte[] bytes;
        try {
            if (stored.sizeBytes() <= 0 || stored.sizeBytes() > MAX_PDF_BYTES) {
                throw invalid("merchant.pdf_size", "key");
            }
            bytes = storage.readStagedStart(key, stored, (int) stored.sizeBytes());
        } catch (StagedUploadChangedException e) {
            throw invalid("merchant.pdf_missing", "key");
        } finally {
            storage.deleteStaged(key);
        }
        if (bytes.length < PDF_MAGIC.length || !startsWith(bytes, PDF_MAGIC)) {
            throw invalid("merchant.pdf_invalid", "key");
        }
        List<CatalogPdf.Photo> photos;
        try {
            photos = CatalogPdf.photos(bytes);
        } catch (CatalogPdf.Refused e) {
            ApiException error = invalid(e.code(), "key");
            throw e.code().equals("merchant.pdf_pages") ? error.withArgs(CatalogPdf.MAX_PAGES) : error;
        }
        long room = DAILY_DRAFTS - tx.execute(status -> drafts.countByStoreIdAndCreatedAtAfter(storeId,
                clock.instant().minus(DAY)));
        boolean limited = photos.size() >= CatalogPdf.MAX_IMAGES || photos.size() > room;
        List<DraftDto> created = new ArrayList<>();
        for (CatalogPdf.Photo photo : photos.subList(0, (int) Math.max(0, Math.min(room, photos.size())))) {
            String draftKey = prefix(storeId) + UUID.randomUUID() + ".jpg";
            storage.putPrivate(draftKey, photo.jpeg(), "image/jpeg");
            DraftSuggestions suggestions = photo.onlyOneOnPage() ? DraftSuggestions.of(photo.pageText()) : null;
            ProductDraft draft = tx.execute(status -> drafts.save(new ProductDraft(storeId, ProductDraft.Source.PDF,
                    draftKey, "image/jpeg", photo.width(), photo.height(), photo.page(), suggestions,
                    clock.instant())));
            created.add(dto(draft));
        }
        tx.executeWithoutResult(status -> audit.record("CATALOG_PDF_IMPORTED", AuditTargetType.STORE, storeId,
                "catalog PDF", null, "{\"drafts\":" + created.size() + ",\"limited\":" + limited + "}"));
        return new PdfResultDto(created, limited);
    }

    /** The store's drafts, newest first. */
    public List<DraftDto> list() {
        long storeId = tx.execute(status -> merchantStores.own().getId());
        return tx.execute(status -> drafts.findByStoreIdOrderByCreatedAtDescIdDesc(storeId)).stream()
                .map(this::dto).toList();
    }

    /** Deletes a draft (made into a product, or not wanted) and its private photo. */
    public void delete(long id) {
        long storeId = writableStoreId();
        String key = tx.execute(status -> {
            ProductDraft draft = drafts.findById(id).orElseThrow(ApiException::notFound);
            if (!draft.getStoreId().equals(storeId)) {
                throw new AccessDeniedException("Another store's draft");
            }
            drafts.delete(draft);
            return draft.getImageKey();
        });
        try {
            storage.deletePrivate(key);
        } catch (RuntimeException e) {
            // Best effort: no row points at the file any more, it is never shown.
            log.warn("Could not delete the photo of draft {}: {}", id, e.toString());
        }
    }

    private DraftDto dto(ProductDraft draft) {
        PresignedDownload view = storage.presignPrivateDownload(draft.getImageKey(), draft.getContentType(),
                "draft-" + draft.getId() + draft.getImageKey().substring(draft.getImageKey().lastIndexOf('.')),
                VIEW_TTL);
        return new DraftDto(draft.getId(), draft.getSource().name(), view.url(), view.expiresAt(), draft.getWidth(),
                draft.getHeight(), draft.getPdfPage(), draft.getSuggestedName(),
                draft.getSuggestedPrice() == null ? null : draft.getSuggestedPrice().toPlainString(),
                draft.getSuggestedWeight() == null ? null : draft.getSuggestedWeight().toPlainString(),
                draft.getPageText(), draft.getCreatedAt());
    }

    private long writableStoreId() {
        return tx.execute(status -> merchantStores.ownWritable().getId());
    }

    private void requireUnderDailyLimit(long storeId, int adding) {
        Instant now = clock.instant();
        long count = tx.execute(status -> drafts.countByStoreIdAndCreatedAtAfter(storeId, now.minus(DAY)));
        if (count + adding > DAILY_DRAFTS) {
            throw new RateLimitExceededException(DAY.toSeconds());
        }
    }

    static String prefix(long storeId) {
        return "drafts/" + storeId + "/";
    }

    private static Pattern photoKey(long storeId) {
        return Pattern.compile(Pattern.quote(prefix(storeId)) + "[0-9a-f-]{36}\\.(jpg|png|webp)");
    }

    private static Pattern pdfKey(long storeId) {
        return Pattern.compile(Pattern.quote(prefix(storeId)) + "[0-9a-f-]{36}\\.pdf");
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static ApiException invalid(String code, String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, field);
    }
}
