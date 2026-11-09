package az.jeparla.auth.dto;

import az.jeparla.auth.AzMobilePhone;
import az.jeparla.common.validation.MaxUtf8Bytes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Seller sign-up, the account step of the /sell wizard ({@code POST /api/v1/auth/register/merchant}).
 * The phone identifies the seller; email is optional. The store is created afterwards with the
 * access token (#39). SMS confirmation of the phone is off in v1 (#52), so {@code phoneVerified}
 * stays false.
 */
public record MerchantRegisterRequest(
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Size(max = 32) @AzMobilePhone String phone,
        @Size(max = 254) @Email String email,
        @NotBlank @Size(min = 8, max = 128) @MaxUtf8Bytes(72) @Pattern(regexp = PasswordRules.LETTER_AND_DIGIT)
        String password) {

    @Override
    public String toString() {
        return "MerchantRegisterRequest[name=" + name + ", phone=***, email=***, password=***]";
    }
}
