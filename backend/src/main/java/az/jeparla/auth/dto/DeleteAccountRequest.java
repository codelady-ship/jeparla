package az.jeparla.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The user deletes their own account ({@code DELETE /api/v1/auth/me}, #249). The password is asked again, so a
 * left-open session alone cannot delete the account.
 *
 * @param password the account's password; never logged
 */
public record DeleteAccountRequest(@NotBlank @Size(max = 128) String password) {

    @Override
    public String toString() {
        return "DeleteAccountRequest[password=***]";
    }
}
