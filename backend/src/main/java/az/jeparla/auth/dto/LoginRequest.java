package az.jeparla.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Sign-in ({@code POST /api/v1/auth/login}).
 *
 * @param login    email (buyers) or Azerbaijani mobile number (sellers), in any common format
 * @param password the password; never logged
 */
public record LoginRequest(
        @NotBlank @Size(max = 254) String login,
        @NotBlank @Size(max = 128) String password) {

    @Override
    public String toString() {
        return "LoginRequest[login=***, password=***]";
    }
}
