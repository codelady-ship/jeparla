package az.jeparla.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Email verification link ({@code POST /api/v1/auth/email/verify}, #131).
 *
 * @param token the token from the link fragment ({@code #token=...})
 */
public record VerifyEmailRequest(@NotBlank @Size(max = 128) String token) {

    @Override
    public String toString() {
        return "VerifyEmailRequest[token=***]";
    }
}
