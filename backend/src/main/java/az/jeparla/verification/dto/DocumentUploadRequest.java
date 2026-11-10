package az.jeparla.verification.dto;

import az.jeparla.verification.CheckKind;
import az.jeparla.verification.DocumentKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Asks for a presigned upload of one verification document (#40). {@code checkKind} DOCUMENTS (business
 * documents of the store: TAX_ID, TRADE_LICENSE) or EXPERTISE (a product: ASSAY_CERTIFICATE, LAB_REPORT, with
 * {@code productId}). PDF, JPEG or PNG, at most 10 MB.
 */
public record DocumentUploadRequest(
        @NotNull CheckKind checkKind,
        @NotNull DocumentKind kind,
        Long productId,
        @NotBlank @Size(max = 200) String fileName,
        @NotBlank @Size(max = 100) String contentType,
        @NotNull @Positive Long sizeBytes) {
}
