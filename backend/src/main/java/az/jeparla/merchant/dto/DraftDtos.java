package az.jeparla.merchant.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Requests and responses of the product drafts API (#129, #109). */
public final class DraftDtos {

    private DraftDtos() {
    }

    /** What the browser is about to upload: a photo (PHOTO, CAMERA) or a catalog PDF. */
    public enum UploadKind {
        PHOTO,
        CAMERA,
        PDF
    }

    /** {@code POST /merchant/drafts/uploads}: a presigned PUT for one photo or one PDF. */
    public record UploadRequest(@NotNull UploadKind kind, @NotBlank @Size(max = 100) String contentType,
            @Positive long sizeBytes) {
    }

    /** {@code POST /merchant/drafts}: the uploaded photo becomes a draft. */
    public record PhotoRequest(@NotBlank @Size(max = 255) String key, @NotNull UploadKind kind) {
    }

    /** {@code POST /merchant/drafts/pdf}: the uploaded PDF becomes one draft per photo in it. */
    public record PdfRequest(@NotBlank @Size(max = 255) String key) {
    }

    /** A draft with a short-lived link to its photo (private bucket) and the suggestions of its PDF page. */
    @Schema(name = "MerchantDraft", requiredProperties = {"id", "source", "imageUrl", "imageUrlExpiresAt", "width",
            "height", "createdAt"})
    public record DraftDto(long id, String source, String imageUrl, Instant imageUrlExpiresAt, int width, int height,
            @Schema(nullable = true) Integer pdfPage, @Schema(nullable = true) String suggestedName,
            @Schema(nullable = true, example = "1250.50") String suggestedPrice,
            @Schema(nullable = true, example = "4.200") String suggestedWeight,
            @Schema(nullable = true, description = "Cleaned text of a PDF page with one photo (at most 4000 characters)")
            String pageText, Instant createdAt) {
    }

    /** The drafts a PDF gave; {@code limited} when the daily draft limit or the image limit cut it short. */
    @Schema(name = "MerchantPdfImport", requiredProperties = {"drafts", "limited"})
    public record PdfResultDto(List<DraftDto> drafts, boolean limited) {
    }
}
