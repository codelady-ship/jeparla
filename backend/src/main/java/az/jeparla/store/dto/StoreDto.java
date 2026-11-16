package az.jeparla.store.dto;

import az.jeparla.common.dto.LocalizedTextDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import az.jeparla.verification.dto.VerificationDto;
import az.jeparla.store.LegalType;
import az.jeparla.store.StoreServiceKind;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

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
        @Schema(format = "date-time") String createdAt,
        @Schema(description = "Day (Asia/Baku) the store last accepted the seller code of conduct (#107); left "
                + "out when there is no valid acceptance", format = "date", nullable = true)
        @JsonInclude(JsonInclude.Include.NON_NULL) String codeAcceptedOn,
        @Schema(description = "Services the store says it offers (#174): its own statement, not a Jeparla "
                + "guarantee; left out when none")
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<StoreServiceKind> services,
        @Schema(description = "The store's return terms in its own words (#174); left out when none",
                nullable = true)
        @JsonInclude(JsonInclude.Include.NON_EMPTY) String returnPolicy,
        @Schema(description = "Made to order as the store declares it (#108); left out when not declared",
                nullable = true)
        @JsonInclude(JsonInclude.Include.NON_NULL) MadeToOrderDto madeToOrder,
        @Schema(description = "The seller's legal identity (ET 5.3, #249): registered name, legal form and VOEN, "
                + "as the seller gave them; left out when the seller has not provided the registered name",
                nullable = true)
        @JsonInclude(JsonInclude.Include.NON_NULL) SellerIdentityDto seller) {

    /** Who sells: the registered name the seller wrote, the legal form and the VOEN of the store (V3, V59). */
    @Schema(name = "SellerIdentity", requiredProperties = {"legalName", "legalType", "taxId"})
    public record SellerIdentityDto(String legalName, LegalType legalType,
            @Schema(example = "1234567890") String taxId) {
    }

    /** Coordinates as decimal strings. */
    @Schema(name = "Geo", requiredProperties = {"lat", "lng"})
    public record GeoDto(@Schema(example = "40.409264") String lat, @Schema(example = "49.867092") String lng) {
    }
}
