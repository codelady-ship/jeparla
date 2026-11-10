package az.jeparla.admin.dto;

import az.jeparla.store.StoreStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Admin decision on a store's marketplace status (#40): APPROVED, REJECTED or BLOCKED. REJECTED and BLOCKED
 * need a reason (10-1000 characters) that the seller sees.
 */
public record StoreStatusRequest(@NotNull StoreStatus status, @Size(max = 1000) String reason) {
}
