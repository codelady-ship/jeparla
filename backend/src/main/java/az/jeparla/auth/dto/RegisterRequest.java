package az.jeparla.auth.dto;

import az.jeparla.common.validation.MaxUtf8Bytes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Buyer sign-up ({@code POST /api/v1/auth/register}). Same rules as the frontend
 * {@code registerSchema}; the password must also fit BCrypt (72 bytes in UTF-8).
 */
public record RegisterRequest(
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Size(max = 254) @Email String email,
        @NotBlank @Size(min = 8, max = 128) @MaxUtf8Bytes(72) @Pattern(regexp = PasswordRules.LETTER_AND_DIGIT)
        String password) {

    @Override
    public String toString() {
        return "RegisterRequest[name=" + name + ", email=***, password=***]";
    }
}
