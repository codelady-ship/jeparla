package az.jeparla.store.dto;

import az.jeparla.verification.dto.VerificationDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A store in lists ({@code StoreSummary} in frontend/src/types/api.ts).
 *
 * @param productCount listed products of the store (public, in a visible category)
 * @param openingHours schema.org openingHours for "open now" on the card (#116), empty when not filled in
 * @param geo          the store's public map point for "open in map" on the card (#116), or null when not set
 */
@Schema(name = "StoreSummary",
        requiredProperties = {"id", "slug", "name", "city", "logoUrl", "verification", "productCount",
                "openingHours", "geo"})
public record StoreSummaryDto(
        long id,
        String slug,
        @Schema(description = "Proper name, the same in every language") String name,
        String city,
        @Schema(nullable = true) String logoUrl,
        VerificationDto verification,
        long productCount,
        @Schema(description = "schema.org openingHours", example = "Mo-Sa 10:00-20:00") String openingHours,
        @Schema(nullable = true) StoreDto.GeoDto geo,
        @Schema(description = "Kilometres from the near point, 0.1 km; only with ?near=", example = "2.4")
        @JsonInclude(JsonInclude.Include.NON_NULL) String distanceKm) {
}
