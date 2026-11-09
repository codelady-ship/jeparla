package az.jeparla.auth;

import az.jeparla.auth.AccessTokenService.AccessToken;
import az.jeparla.auth.RefreshTokenService.IssuedRefreshToken;
import az.jeparla.auth.RefreshTokenService.Rotation;
import az.jeparla.auth.dto.LoginRequest;
import az.jeparla.auth.dto.MerchantRegisterRequest;
import az.jeparla.auth.dto.RegisterRequest;
import az.jeparla.auth.dto.UserResponse;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.Language;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Registration, login, refresh and logout. Passwords are only hashed and compared here; neither
 * they nor tokens are ever logged.
 */
@Service
public class AuthService {

    /** BCrypt ignores everything after 72 bytes; longer passwords are rejected, never truncated. */
    static final int BCRYPT_MAX_BYTES = 72;

    /** Error code of a wrong password or unknown login (the only failure a login rate limit counts). */
    static final String INVALID_CREDENTIALS = "auth.invalid_credentials";

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenService accessTokens;
    private final RefreshTokenService refreshTokens;
    private final Clock clock;
    /**
     * A real hash of a random password. Unknown logins are checked against it, so they cost the
     * same BCrypt work as a wrong password and the response time does not reveal which emails exist.
     */
    private final String dummyHash;

    public AuthService(UserRepository users, RoleRepository roles, PasswordEncoder passwordEncoder,
            AccessTokenService accessTokens, RefreshTokenService refreshTokens, Clock clock) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /** Buyer sign-up: role USER, signed in right away. 409 when the email is taken. */
    @Transactional
    public Session registerUser(RegisterRequest request, Locale locale) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmailIgnoringCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.email_taken", "email");
        }
        User user = new User(email, null, passwordEncoder.encode(request.password()), request.name().strip());
        return create(user, RoleName.USER, locale, "email");
    }

    /** Seller sign-up: role MERCHANT, phone as the login. 409 when the phone or email is taken. */
    @Transactional
    public Session registerMerchant(MerchantRegisterRequest request, Locale locale) {
        String phone = PhoneNumbers.normalize(request.phone());
        if (phone == null) {
            // Already rejected by @AzMobilePhone; kept for callers outside the controller.
            throw new ApiException(HttpStatus.BAD_REQUEST, "validation.phone", "phone");
        }
        if (users.existsByPhone(phone)) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.phone_taken", "phone");
        }
        String email = request.email() == null || request.email().isBlank() ? null : normalizeEmail(request.email());
        if (email != null && users.existsByEmailIgnoringCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "auth.email_taken", "email");
        }
        User user = new User(email, phone, passwordEncoder.encode(request.password()), request.name().strip());
        return create(user, RoleName.MERCHANT, locale, "phone");
    }

    /**
     * Unknown login, wrong password and an unusable hash all give the same 401
     * {@code auth.invalid_credentials} after the same BCrypt work. A blocked account is only
     * reported (403) after the right password, so it reveals nothing to a guesser.
     */
    @Transactional
    public Session login(LoginRequest request) {
        Optional<User> found = findByLogin(request.login());
        boolean matches = passwordMatches(request.password(), found.map(User::getPasswordHash).orElse(dummyHash));
        if (found.isEmpty() || !matches) {
            throw invalidCredentials();
        }
        User user = found.get();
        if (user.getStatus() == UserStatus.BLOCKED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "auth.account_blocked");
        }
        user.setLastLoginAt(clock.instant());
        return session(user, refreshTokens.startFamily(user));
    }

    /** Rotates the refresh token and issues a new access token with the current roles. */
    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String rawRefreshToken) {
        Rotation rotation = refreshTokens.rotate(rawRefreshToken);
        User user = rotation.user();
        if (user.getStatus() == UserStatus.BLOCKED) {
            refreshTokens.revokeAllOf(user.getId());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "auth.refresh_invalid");
        }
        return session(user, rotation.next());
    }

    /** Revokes the session (refresh token family). Access tokens expire on their own (15 min). */
    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.revokeFamilyOf(rawRefreshToken);
    }

    @Transactional(readOnly = true)
    public UserResponse me(long userId) {
        User user = users.findWithRolesById(userId)
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "auth.invalid_token"));
        return UserResponse.of(user);
    }

    private Session create(User user, RoleName roleName, Locale locale, String uniqueField) {
        user.addRole(roles.findByName(roleName).orElseThrow());
        user.setPreferredLocale(language(locale));
        user.setLastLoginAt(clock.instant());
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email or phone at the same moment: the unique index decides.
            throw new ApiException(HttpStatus.CONFLICT,
                    "phone".equals(uniqueField) ? "auth.phone_taken" : "auth.email_taken", uniqueField);
        }
        return session(user, refreshTokens.startFamily(user));
    }

    private Session session(User user, IssuedRefreshToken refreshToken) {
        AccessToken accessToken = accessTokens.issue(user);
        return new Session(UserResponse.of(user), accessToken, refreshToken);
    }

    private Optional<User> findByLogin(String login) {
        String value = login.strip();
        if (value.contains("@")) {
            return users.findByEmailIgnoringCase(value);
        }
        String phone = PhoneNumbers.normalize(value);
        return phone == null ? Optional.empty() : users.findByPhone(phone);
    }

    private boolean passwordMatches(String password, String hash) {
        if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            // Cannot be a valid password (registration rejects it); spend the same work anyway.
            passwordEncoder.matches("", dummyHash);
            return false;
        }
        return passwordEncoder.matches(password, hash);
    }

    private static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private static Language language(Locale locale) {
        String code = locale == null ? "" : locale.getLanguage();
        for (Language language : Language.values()) {
            if (language.code().equals(code)) {
                return language;
            }
        }
        return Language.AZ;
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
    }

    /** Result of register, login and refresh: the body for the client and the cookie value. */
    public record Session(UserResponse user, AccessToken accessToken, IssuedRefreshToken refreshToken) {
    }
}
