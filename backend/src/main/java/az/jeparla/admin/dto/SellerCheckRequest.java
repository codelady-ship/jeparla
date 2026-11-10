package az.jeparla.admin.dto;

import az.jeparla.verification.CheckStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Admin decision on the seller check of a store (#40): VERIFIED after the admin confirmed the seller (VÖEN in the
 * state register, contact), or REJECTED with a reason. Separate from the documents check, which only approved
 * documents make VERIFIED.
 */
public record SellerCheckRequest(@NotNull CheckStatus decision, @Size(max = 1000) String reason) {
}
