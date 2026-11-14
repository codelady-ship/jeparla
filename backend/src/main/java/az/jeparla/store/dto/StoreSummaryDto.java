package az.jeparla.store.dto;

import az.jeparla.verification.dto.VerificationDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A store in lists ({@code StoreSummary} in frontend/src/types/api.ts).
 *
 * @param productCount listed products of the store (public, in a visible category)
 */
@Schema(name = "StoreSummary",
        requiredProperties = {"id", "slug", "name", "city", "logoUrl", "verification", "productCount"})
public record StoreSummaryDto(
        long id,
        String slug,
        @Schema(description = "Proper name, the same in every language") String name,
        String city,
        @Schema(nullable = true) String logoUrl,
        VerificationDto verification,
        long productCount,
        @Schema(description = "Kilometres from the near point, 0.1 km; only with ?near=", example = "2.4")
        @JsonInclude(JsonInclude.Include.NON_NULL) String distanceKm) {
}
