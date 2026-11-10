package az.jeparla.verification.dto;

import az.jeparla.verification.CheckKind;
import az.jeparla.verification.DocumentKind;
import az.jeparla.verification.DocumentStatus;
import az.jeparla.verification.RejectReason;
import az.jeparla.verification.VerificationDocument;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * A document as its seller sees it (#40, #138): what it is and the review outcome. No storage key and no URL:
 * the seller never reads a document back through the API.
 */
@Schema(name = "MerchantDocument", requiredProperties = {
        "id", "checkKind", "kind", "fileName", "contentType", "sizeBytes", "status", "createdAt"})
public record MerchantDocumentDto(UUID id, CheckKind checkKind, DocumentKind kind, Long productId, String fileName,
        String contentType, long sizeBytes, DocumentStatus status, RejectReason rejectReason, String reviewNote,
        Instant createdAt, Instant reviewedAt) {

    public static MerchantDocumentDto of(VerificationDocument document) {
        return new MerchantDocumentDto(document.getId(), document.getCheckKind(), document.getKind(),
                document.getProduct() == null ? null : document.getProduct().getId(), document.getFileName(),
                document.getContentType(), document.getSizeBytes(), document.getStatus(), document.getRejectReason(),
                document.getReviewNote(), document.getCreatedAt(), document.getReviewedAt());
    }
}
