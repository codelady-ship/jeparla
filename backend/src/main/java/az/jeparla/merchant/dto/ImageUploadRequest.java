package az.jeparla.merchant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Asks for an upload URL ({@code POST /api/v1/merchant/products/{id}/images/uploads}). Type and size are
 * checked here and again on the stored file when it is attached.
 */
public record ImageUploadRequest(
        @NotBlank @Size(max = 100) String contentType,
        @NotNull @Positive Long sizeBytes) {
}
