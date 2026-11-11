package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** The password encoder of {@link SecurityConfig}. */
class PasswordEncoderTests {

    @Test
    void realHashesMatch() {
        PasswordEncoder encoder = new SecurityConfig().passwordEncoder();
        String hash = encoder.encode("parol123");
        assertThat(hash).startsWith("{bcrypt}$2a$10$");
        assertThat(encoder.matches("parol123", hash)).isTrue();
        assertThat(encoder.matches("parol124", hash)).isFalse();
    }

    @Test
    void hashesWithoutAPrefixNeverMatchButCostTheSameBcryptWork() {
        // The demo seed accounts (#134): no BCrypt prefix, so they never sign in. The check still runs one
        // BCrypt comparison, so their answer is not faster than a real account's.
        BCryptPasswordEncoder bcrypt = spy(new BCryptPasswordEncoder());
        PasswordEncoder neverMatching = new SecurityConfig.NeverMatchingPasswordEncoder(bcrypt);
        assertThat(neverMatching.matches("parol123", "demo-not-a-hash")).isFalse();
        assertThat(neverMatching.matches("parol123", "parol123")).isFalse();
        verify(bcrypt, times(2)).matches(any(CharSequence.class), anyString());

        PasswordEncoder encoder = new SecurityConfig().passwordEncoder();
        assertThat(encoder.matches("parol123", "parol123")).isFalse();
    }
}
