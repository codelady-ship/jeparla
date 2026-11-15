package az.jeparla.merchant.dto;

import az.jeparla.auth.AzMobilePhone;
import az.jeparla.store.LegalType;
import az.jeparla.store.SellerKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Store application, the store step of the /sell wizard ({@code POST /api/v1/merchant/stores}). Same rules
 * as {@code storeStep} in frontend/src/lib/seller/schemas.ts.
 *
 * @param sellerKind the wizard question "Do you sell official jewelry (gold, silver, platinum, diamonds)?"
 *                   (#128): yes = PRECIOUS, no, bijouterie or handmade = FASHION, both = MIXED
 * @param codeAccepted the wizard checkbox "I accept the seller code of conduct" (#107); true records the
 *                   acceptance of the current version, anything else leaves it to the cabinet
 */
public record StoreRequest(
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Size(max = 32) @AzMobilePhone String whatsapp,
        @Size(max = 32) @AzMobilePhone String phone,
        @NotBlank @Size(max = 60) String city,
        @NotBlank @Size(min = 5, max = 200) String address,
        @Size(max = 200) @Pattern(regexp = StoreProfileRequest.SOCIAL) String social,
        @Size(max = 1000) String description,
        @Size(max = 200) String openingHours,
        @NotNull LegalType legalType,
        @NotBlank @Pattern(regexp = "^[0-9]{10}$") String taxId,
        @NotNull SellerKind sellerKind,
        Boolean codeAccepted) {
}
