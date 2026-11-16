package az.jeparla.auth;

import az.jeparla.auth.dto.DeleteAccountRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's own account (#249): self-service deletion. */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Account", description = "The signed-in user's own account")
public class AccountController {

    private final AccountDeletionService deletion;

    public AccountController(AccountDeletionService deletion) {
        this.deletion = deletion;
    }

    @DeleteMapping("/me")
    @Operation(summary = "Delete the signed-in account (password again); 409 for a store owner or an admin")
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteAccountRequest request) {
        deletion.delete(CurrentUser.id(), request);
        return ResponseEntity.noContent().build();
    }
}
