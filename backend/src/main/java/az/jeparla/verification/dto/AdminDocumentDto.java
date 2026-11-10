package az.jeparla.verification.dto;

import az.jeparla.store.SellerKind;
import az.jeparla.verification.CheckKind;
import az.jeparla.verification.DocumentKind;
import az.jeparla.verification.DocumentStatus;
import az.jeparla.verification.RejectReason;
import az.jeparla.verification.SellerDeclaration;
import az.jeparla.verification.VerificationDocument;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * A document in the admin review (#40): metadata, the store and product it supports, the SHA-256 of the file
 * and the declaration the seller confirmed. The file itself is opened through a short-lived URL
 * ({@code POST /admin/documents/{id}/view}); its storage key is never in a response.
 */
@Schema(name = "AdminDocument", requiredProperties = {
        "id", "storeId", "storeName", "sellerKind", "checkKind", "kind", "fileName", "contentType", "sizeBytes",
        "status", "createdAt"})
public record AdminDocumentDto(UUID id, long storeId, String storeName, SellerKind sellerKind, Long productId,
        String productName, CheckKind checkKind, DocumentKind kind, String fileName, String contentType,
        long sizeBytes, String sha256, DocumentStatus status, RejectReason rejectReason, String reviewNote,
        Instant createdAt, Instant reviewedAt, Declaration declaration) {

    /** The declaration confirmed for the upload, as evidence. */
    @Schema(name = "AdminDocumentDeclaration", requiredProperties = {"version", "language", "text", "confirmedAt",
            "confirmedBy"})
    public record Declaration(long id, String version, String language, String text, Instant confirmedAt,
            String confirmedBy) {

        static Declaration of(SellerDeclaration declaration) {
            return declaration == null ? null : new Declaration(declaration.getId(), declaration.getTextVersion(),
                    declaration.getLanguage().code(), declaration.getText(), declaration.getConfirmedAt(),
                    declaration.getUserLabel());
        }
    }

    public static AdminDocumentDto of(VerificationDocument document) {
        return new AdminDocumentDto(document.getId(), document.getStore().getId(), document.getStore().getName(),
                document.getStore().getSellerKind(),
                document.getProduct() == null ? null : document.getProduct().getId(),
                document.getProduct() == null ? null : document.getProduct().getName().az(),
                document.getCheckKind(), document.getKind(), document.getFileName(), document.getContentType(),
                document.getSizeBytes(), document.getSha256(), document.getStatus(), document.getRejectReason(),
                document.getReviewNote(), document.getCreatedAt(), document.getReviewedAt(),
                Declaration.of(document.getDeclaration()));
    }
}
