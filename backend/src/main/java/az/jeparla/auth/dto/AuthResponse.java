package az.jeparla.auth.dto;

/**
 * Successful register, login or refresh. The refresh token is not in the body: it is set as the
 * httpOnly {@code jeparla_refresh} cookie.
 *
 * @param accessToken JWT for {@code Authorization: Bearer ...}
 * @param tokenType   always {@code Bearer}
 * @param expiresIn   access token lifetime in seconds
 * @param user        the account
 */
public record AuthResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {

    public AuthResponse(String accessToken, long expiresIn, UserResponse user) {
        this(accessToken, "Bearer", expiresIn, user);
    }

    @Override
    public String toString() {
        return "AuthResponse[accessToken=***, expiresIn=" + expiresIn + ", user=" + user.id() + "]";
    }
}
