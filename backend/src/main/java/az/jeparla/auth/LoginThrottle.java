package az.jeparla.auth;

import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import org.springframework.stereotype.Component;

/**
 * Login rate limits (#133). Only failed passwords count against an account, so nobody can lock
 * a seller out by sending requests with their public phone number.
 *
 * <ol>
 * <li>{@code login-ip}: every attempt from one address (guessing many accounts).</li>
 * <li>{@code login-account-ip}: failures for one account from one address. That pair is refused
 * before the password is checked; a successful login clears it.</li>
 * <li>{@code login-account}: failures for one account from all addresses. Over the limit the
 * account is under attack and only its known addresses (successful logins in the last 30 days)
 * may still sign in; others get 429 before the password is checked.</li>
 * </ol>
 *
 * <p>Keys depend only on what the client sent (login and address), never on whether the account
 * exists, and a refusal happens before any password work: known and unknown accounts get the same
 * answers in the same time.
 */
@Component
class LoginThrottle {

    private final RateLimitService limits;

    LoginThrottle(RateLimitService limits) {
        this.limits = limits;
    }

    /**
     * @param account normalized login (lowercase email or E.164 phone)
     * @param address client address key (IPv4, or IPv6 /64)
     * @throws RateLimitExceededException when this attempt must not reach the password check
     */
    void beforeAttempt(String account, String address) {
        limits.check(RateLimitPolicy.LOGIN_IP, address);
        String pair = pair(account, address);
        limits.requireUnder(RateLimitPolicy.LOGIN_ACCOUNT_IP, pair);
        long underAttack = limits.blockedFor(RateLimitPolicy.LOGIN_ACCOUNT, account);
        if (underAttack > 0 && !limits.isCounted(RateLimitPolicy.LOGIN_KNOWN_ADDRESS, pair)) {
            throw new RateLimitExceededException(underAttack);
        }
    }

    /** A wrong password (or unknown login). */
    void failed(String account, String address) {
        limits.count(RateLimitPolicy.LOGIN_ACCOUNT_IP, pair(account, address));
        limits.count(RateLimitPolicy.LOGIN_ACCOUNT, account);
    }

    /** The right password: clears this address's failures and remembers it for 30 days. */
    void succeeded(String account, String address) {
        String pair = pair(account, address);
        limits.reset(RateLimitPolicy.LOGIN_ACCOUNT_IP, pair);
        // Restart the marker's window, so an address in regular use never expires.
        limits.reset(RateLimitPolicy.LOGIN_KNOWN_ADDRESS, pair);
        limits.count(RateLimitPolicy.LOGIN_KNOWN_ADDRESS, pair);
    }

    private static String pair(String account, String address) {
        return account + "|" + address;
    }
}
