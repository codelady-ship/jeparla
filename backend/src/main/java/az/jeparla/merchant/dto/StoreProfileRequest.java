package az.jeparla.merchant.dto;

import az.jeparla.auth.AzMobilePhone;
import az.jeparla.store.SellerKind;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Store profile ({@code PUT /api/v1/merchant/store}), {@code profileSchema} in
 * frontend/src/lib/merchant/schemas.ts. Legal form and VOEN are not changed here: the documents check is
 * tied to them (an admin changes them, #40). The slug stays, so shared links keep working.
 *
 * <p>Location for "near me" (#116), optional: a Google Maps or Yandex Maps link ({@code mapLink}) or the
 * coordinates themselves; both absent keeps the saved location. Rounded to 6 decimals.
 */
public record StoreProfileRequest(
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Size(max = 32) @AzMobilePhone String whatsapp,
        @Size(max = 32) @AzMobilePhone String phone,
        @NotBlank @Size(max = 60) String city,
        @NotBlank @Size(min = 5, max = 200) String address,
        @Size(max = 200) @Pattern(regexp = SOCIAL) String social,
        @Size(max = 1000) String description,
        @Size(max = 200) String openingHours,
        @NotNull SellerKind sellerKind,
        @Size(max = 2000) String mapLink,
        @DecimalMin("-90") @DecimalMax("90") @Digits(integer = 2, fraction = 8) BigDecimal latitude,
        @DecimalMin("-180") @DecimalMax("180") @Digits(integer = 3, fraction = 8) BigDecimal longitude) {

    /** An Instagram-style handle or an https link, or empty (frontend {@code social}). */
    public static final String SOCIAL = "^$|^@[\\w.]{2,30}$|^https://\\S+$";
}
