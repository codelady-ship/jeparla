package az.jeparla.store.dto;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.store.Store;
import az.jeparla.verification.CheckStatus;
import az.jeparla.verification.dto.VerificationDto;
import java.math.BigDecimal;

/** Store entity to public DTOs. The logo URL is built by the caller ({@code ImageUrls}). */
public final class StoreDtos {

    private StoreDtos() {
    }

    /** Store checks: seller and documents; expertise is a product check, so NONE on a store. */
    public static VerificationDto verification(Store store) {
        return new VerificationDto(store.getSellerStatus(), store.getDocumentsStatus(), CheckStatus.NONE);
    }

    public static StoreSummaryDto summary(Store store, String logoUrl, long productCount) {
        return summary(store, logoUrl, productCount, null);
    }

    /** A store card with its distance from the buyer ({@code ?near=}, #116); null distance leaves the key out. */
    public static StoreSummaryDto summary(Store store, String logoUrl, long productCount, BigDecimal distanceKm) {
        return new StoreSummaryDto(store.getId(), store.getSlug(), store.getName(), store.getCity(), logoUrl,
                verification(store), productCount, distanceKm == null ? null : distanceKm.toPlainString());
    }

    public static StoreDto detail(Store store, String logoUrl, long productCount) {
        StoreDto.GeoDto geo = store.getLatitude() == null || store.getLongitude() == null ? null
                : new StoreDto.GeoDto(Decimal.of(store.getLatitude()), Decimal.of(store.getLongitude()));
        return new StoreDto(store.getId(), store.getSlug(), store.getName(), store.getCity(), logoUrl,
                verification(store), productCount, LocalizedTextDto.of(store.getDescription()), store.getAddress(),
                store.getWhatsapp(), orEmpty(store.getPhone()), orEmpty(store.getOpeningHours()), geo,
                store.getCreatedAt().toString());
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }
}
