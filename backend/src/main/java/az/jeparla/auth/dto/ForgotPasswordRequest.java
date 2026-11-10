package az.jeparla.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** "Forgot password" ({@code POST /api/v1/auth/password/forgot}, #131). */
public record ForgotPasswordRequest(@NotBlank @Size(max = 254) @Email String email) {

    @Override
    public String toString() {
        return "ForgotPasswordRequest[email=***]";
    }
}
