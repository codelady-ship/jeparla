package az.jeparla.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class AuthPropertiesTests {

    private static final String GOOD_SECRET = "0123456789abcdef0123456789abcdef";

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(AuthProperties.class)
    static class PropertiesOnly {
    }

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesOnly.class, JwtConfig.class);

    @Test
    void startsWithA32ByteSecret() {
        context.withPropertyValues("jeparla.auth.jwt-secret=" + GOOD_SECRET).run(app -> {
            assertThat(app).hasNotFailed();
            AuthProperties properties = app.getBean(AuthProperties.class);
            assertThat(properties.accessTokenTtl()).isEqualTo(Duration.ofMinutes(15));
            assertThat(properties.refreshTokenTtl()).isEqualTo(Duration.ofDays(30));
            assertThat(properties.cookieSecure()).isTrue();
        });
    }

    @Test
    void missingSecretFailsStartup() {
        context.run(app -> assertThat(app).hasFailed()
                .getFailure().rootCause().hasMessageContaining("(JEPARLA_JWT_SECRET) must be set"));
        context.withPropertyValues("jeparla.auth.jwt-secret=   ").run(app -> assertThat(app).hasFailed());
    }

    @Test
    void shortSecretFailsStartup() {
        context.withPropertyValues("jeparla.auth.jwt-secret=" + GOOD_SECRET.substring(1)).run(app ->
                assertThat(app).hasFailed().getFailure().rootCause()
                        .hasMessageContaining("at least 32 bytes")
                        .hasMessageNotContaining(GOOD_SECRET.substring(1)));
    }

    @Test
    void refreshMustOutliveAccessToken() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                new AuthProperties(GOOD_SECRET, Duration.ofHours(1), Duration.ofMinutes(30), Duration.ofDays(90), true));
    }

    @Test
    void aSessionEndsNinetyDaysAfterLoginByDefault() {
        context.withPropertyValues("jeparla.auth.jwt-secret=" + GOOD_SECRET).run(app ->
                assertThat(app.getBean(AuthProperties.class).refreshFamilyTtl()).isEqualTo(Duration.ofDays(90)));
        // The family cannot end before its first token.
        assertThatIllegalArgumentException().isThrownBy(() ->
                new AuthProperties(GOOD_SECRET, Duration.ofMinutes(15), Duration.ofDays(30), Duration.ofDays(7), true))
                .withMessageContaining("refresh-family-ttl");
    }

    @Test
    void toStringHidesTheSecret() {
        AuthProperties properties = new AuthProperties(GOOD_SECRET, Duration.ofMinutes(15), Duration.ofDays(30),
                Duration.ofDays(90), true);
        assertThat(properties.toString()).doesNotContain(GOOD_SECRET).contains("***");
    }
}
