package az.jeparla.auth;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Issues short-lived access tokens. Claims: {@code sub} = user id, {@code roles}, {@code iss},
 * {@code aud}, {@code iat}, {@code exp}, {@code jti}. No email, phone or name: the token is only a
 * proof of identity and role, and it is readable by anyone who holds it.
 */
@Service
public class AccessTokenService {

    private final JwtEncoder encoder;
    private final AuthProperties properties;
    private final Clock clock;

    public AccessTokenService(JwtEncoder encoder, AuthProperties properties, Clock clock) {
        this.encoder = encoder;
        this.properties = properties;
        this.clock = clock;
    }

    public AccessToken issue(User user) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.accessTokenTtl());
        List<String> roles = user.getRoles().stream().map(role -> role.getName().name()).sorted().toList();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtConfig.ISSUER)
                .audience(List.of(JwtConfig.AUDIENCE))
                .subject(String.valueOf(user.getId()))
                .issuedAt(now)
                .expiresAt(expiresAt)
                .id(UUID.randomUUID().toString())
                .claim(JwtConfig.ROLES_CLAIM, roles)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AccessToken(value, expiresAt, properties.accessTokenTtl().toSeconds());
    }

    /**
     * @param value     the compact JWT
     * @param expiresAt when it stops being accepted
     * @param expiresIn lifetime in seconds, as in OAuth 2 token responses
     */
    public record AccessToken(String value, Instant expiresAt, long expiresIn) {

        @Override
        public String toString() {
            return "AccessToken[value=***, expiresAt=" + expiresAt + "]";
        }
    }
}
