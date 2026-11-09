package az.jeparla.store.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.verification.dto.VerificationDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Store page ({@code Store} = {@code StoreSummary} + contact details in frontend/src/types/api.ts).
 * Optional text the store has not filled in ({@code phone}, {@code openingHours}) is an empty string.
 */
@Schema(name = "Store", requiredProperties = {"id", "slug", "name", "city", "logoUrl", "verification",
        "productCount", "description", "address", "whatsapp", "phone", "openingHours", "geo", "createdAt"})
public record StoreDto(
        long id,
        String slug,
        String name,
        String city,
        @Schema(nullable = true) String logoUrl,
        VerificationDto verification,
        long productCount,
        LocalizedTextDto description,
        String address,
        @Schema(description = "E.164, for the wa.me link", example = "+994500000001") String whatsapp,
        String phone,
        @Schema(description = "schema.org openingHours", example = "Mo-Sa 10:00-20:00") String openingHours,
        @Schema(nullable = true) GeoDto geo,
        @Schema(format = "date-time") String createdAt) {

    /** Coordinates as decimal strings. */
    @Schema(name = "Geo", requiredProperties = {"lat", "lng"})
    public record GeoDto(@Schema(example = "40.409264") String lat, @Schema(example = "49.867092") String lng) {
    }
}
