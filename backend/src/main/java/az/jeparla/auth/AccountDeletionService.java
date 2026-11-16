package az.jeparla.auth;

import az.jeparla.admin.ActorRole;
import az.jeparla.admin.AuditService;
import az.jeparla.auth.dto.DeleteAccountRequest;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.store.StoreRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The user deletes their own account (#249, privacy policy "Your rights", docs/legal/analysis.md section 5).
 *
 * <p>The password is asked again. The account row goes, and with it (ON DELETE CASCADE) favourites, sessions,
 * notifications and the email queue; complaints, audit rows and seller declarations lose the link to the account
 * (ON DELETE SET NULL). The one exception the analysis names: a seller declaration keeps the signer's name and
 * contact ({@code user_label}) as evidence; it is pseudonymised after the retention period (V56, risk 7).
 *
 * <p>Refused with 409:
 * <ul>
 *   <li>{@code auth.account_owns_store}: a store owner. The store and its documents are evidence that must stay
 *       (stores.owner_id is ON DELETE RESTRICT); support closes the store first.</li>
 *   <li>{@code auth.account_admin}: an administrator; another admin removes the role first.</li>
 * </ul>
 * A wrong password is 400 {@code auth.wrong_password}; attempts are rate limited per account.
 */
@Service
public class AccountDeletionService {

    private final UserRepository users;
    private final StoreRepository stores;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;
    private final RateLimitService rateLimits;

    public AccountDeletionService(UserRepository users, StoreRepository stores, PasswordEncoder passwordEncoder,
            AuditService audit, RateLimitService rateLimits) {
        this.users = users;
        this.stores = stores;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
        this.rateLimits = rateLimits;
    }

    @Transactional
    public void delete(long userId, DeleteAccountRequest request) {
        rateLimits.check(RateLimitPolicy.ACCOUNT_DELETE_ACCOUNT, String.valueOf(userId));
        User user = users.findWithRolesById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "auth.invalid_token"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "auth.wrong_password", "password");
        }
        if (user.hasRole(RoleName.ADMIN)) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.account_admin");
        }
        if (stores.findByOwnerId(userId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.account_owns_store");
        }
        ActorRole role = user.hasRole(RoleName.MERCHANT) ? ActorRole.MERCHANT : ActorRole.USER;
        users.delete(user);
        users.flush();
        audit.recordAccountDeletion(userId, role);
    }
}
