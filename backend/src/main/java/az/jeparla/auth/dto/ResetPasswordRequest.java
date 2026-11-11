package az.jeparla.auth.dto;

import az.jeparla.common.validation.MaxUtf8Bytes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * New password with a reset link ({@code POST /api/v1/auth/password/reset}, #131). The password follows the
 * sign-up rules ({@link RegisterRequest}).
 *
 * @param token the token from the link fragment ({@code #token=...})
 */
public record ResetPasswordRequest(
        @NotBlank @Size(max = 128) String token,
        @NotBlank @Size(min = 8, max = 128) @MaxUtf8Bytes(72) @Pattern(regexp = PasswordRules.LETTER_AND_DIGIT)
        String password) {

    @Override
    public String toString() {
        return "ResetPasswordRequest[token=***, password=***]";
    }
}
