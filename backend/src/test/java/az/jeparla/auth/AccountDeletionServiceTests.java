package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.admin.ActorRole;
import az.jeparla.admin.AuditService;
import az.jeparla.auth.dto.DeleteAccountRequest;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Self-service account deletion (#249) without a database; the HTTP and SQL side is AccountDeletionTests. */
class AccountDeletionServiceTests {

    private static final long ID = 42L;
    private final PasswordEncoder encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
    private final UserRepository users = mock(UserRepository.class);
    private final StoreRepository stores = mock(StoreRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private final RateLimitService rateLimits = mock(RateLimitService.class);
    private final AccountDeletionService service = new AccountDeletionService(users, stores, encoder, audit,
            rateLimits);

    private User user(RoleName roleName) {
        User user = new User("buyer@jeparla.test", null, encoder.encode("parol123"), "Alıcı");
        Role role = mock(Role.class);
        when(role.getName()).thenReturn(roleName);
        user.addRole(role);
        when(users.findWithRolesById(ID)).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void theAccountGoesAndOnlyTheRoleIsAudited() {
        User user = user(RoleName.USER);
        when(stores.findByOwnerId(ID)).thenReturn(Optional.empty());

        service.delete(ID, new DeleteAccountRequest("parol123"));

        verify(rateLimits).check(RateLimitPolicy.ACCOUNT_DELETE_ACCOUNT, String.valueOf(ID));
        verify(users).delete(user);
        verify(audit).recordAccountDeletion(ID, ActorRole.USER);
    }

    @Test
    void aWrongPasswordDeletesNothing() {
        user(RoleName.USER);

        assertThatThrownBy(() -> service.delete(ID, new DeleteAccountRequest("wrong")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("auth.wrong_password"));
        verify(users, never()).delete(any(User.class));
    }

    @Test
    void storeOwnersAndAdminsAreRefused() {
        user(RoleName.MERCHANT);
        when(stores.findByOwnerId(ID)).thenReturn(Optional.of(mock(Store.class)));
        assertThatThrownBy(() -> service.delete(ID, new DeleteAccountRequest("parol123")))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.code()).isEqualTo("auth.account_owns_store"));

        user(RoleName.ADMIN);
        assertThatThrownBy(() -> service.delete(ID, new DeleteAccountRequest("parol123")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("auth.account_admin"));
        verify(users, never()).delete(any(User.class));
        verify(audit, never()).recordAccountDeletion(anyLong(), any());
    }
}
