package az.jeparla.admin.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Place ({@code hold: true}, a reason of 10-500 characters, e.g. the number of the authority's request) or release
 * ({@code hold: false}) a legal hold on a store's evidence (#138). Internal: the seller never sees it.
 */
public record LegalHoldRequest(@NotNull Boolean hold, @Size(max = 500) String reason) {
}
