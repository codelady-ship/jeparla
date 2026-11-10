package az.jeparla.merchant.dto;

import az.jeparla.product.ProductStatus;
import jakarta.validation.constraints.NotNull;

/**
 * {@code PATCH /api/v1/merchant/products/{id}/status}. What a seller may do:
 * <ul>
 *   <li>IN_REVIEW: send a DRAFT, RETURNED or INACTIVE product to moderation (approved store and verified
 *       seller, at least one photo and one variant);</li>
 *   <li>DRAFT: withdraw it from moderation;</li>
 *   <li>INACTIVE: hide an APPROVED product;</li>
 *   <li>APPROVED: show again a product the seller hid (never one an admin deactivated).</li>
 * </ul>
 */
public record StatusChangeRequest(@NotNull ProductStatus status) {
}
