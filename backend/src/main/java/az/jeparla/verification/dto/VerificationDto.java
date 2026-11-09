package az.jeparla.verification.dto;

import az.jeparla.verification.CheckStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The three separate "Jeparla Verified" checks (PLAN 5.9, {@code Verification} in
 * frontend/src/types/api.ts): seller and documents are checks of the store, expertise is the physical
 * check of one product (always NONE on a store).
 */
@Schema(name = "Verification", requiredProperties = {"seller", "documents", "expertise"})
public record VerificationDto(CheckStatus seller, CheckStatus documents, CheckStatus expertise) {
}
