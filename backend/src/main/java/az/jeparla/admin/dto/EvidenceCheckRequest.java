package az.jeparla.admin.dto;

import az.jeparla.verification.CheckStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Admin check of a hallmark or label photo (#106): VERIFIED when the photo matches the product data (metal,
 * fineness, weight on the label), or REJECTED with a reason (10+ characters) when it does not or cannot be read.
 * A mismatch is also a reason to RETURN the product ({@code POST /admin/products/{id}/decision}).
 *
 * @param reason required for REJECTED, optional note for VERIFIED
 */
public record EvidenceCheckRequest(@NotNull CheckStatus decision, @Size(max = 1000) String reason) {
}
