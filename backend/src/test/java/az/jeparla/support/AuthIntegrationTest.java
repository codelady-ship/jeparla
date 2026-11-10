package az.jeparla.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

/**
 * Security and auth tests over HTTP (MockMvc): PostgreSQL 16 and Redis 7 in containers, rate-limit
 * counters in Redis (as in production) with small limits, the protected test endpoints of
 * {@link SecuredTestEndpoints}, and an in-memory bucket ({@link FakeObjectStorage}) for photo uploads. All classes with this annotation share one application context.
 * Skipped without Docker, mandatory in CI.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@WithPostgres
@Import({RedisContainerConfig.class, SecuredTestEndpoints.class, FakeObjectStorage.Config.class})
@SpringBootTest(properties = {
        "jeparla.rate-limit.store=redis",
        "jeparla.rate-limit.policies.login-ip.limit=" + AuthIntegrationTest.LOGIN_IP_LIMIT,
        "jeparla.rate-limit.policies.login-account-ip.limit=" + AuthIntegrationTest.LOGIN_ACCOUNT_IP_LIMIT,
        "jeparla.rate-limit.policies.login-account.limit=" + AuthIntegrationTest.LOGIN_ACCOUNT_LIMIT,
        "jeparla.rate-limit.policies.register-ip.limit=" + AuthIntegrationTest.REGISTER_IP_LIMIT,
        "jeparla.rate-limit.policies.image-upload-account.limit=" + AuthIntegrationTest.IMAGE_UPLOAD_LIMIT,
        // 192.0.2.0/24 stands for the Caddy network: X-Forwarded-For is believed only from there.
        "jeparla.client-ip.trusted-proxies=127.0.0.1/32,::1/128," + AuthIntegrationTest.TRUSTED_PROXIES,
})
@AutoConfigureMockMvc
public @interface AuthIntegrationTest {

    int LOGIN_IP_LIMIT = 6;
    int LOGIN_ACCOUNT_IP_LIMIT = 3;
    int LOGIN_ACCOUNT_LIMIT = 8;
    int REGISTER_IP_LIMIT = 5;
    int IMAGE_UPLOAD_LIMIT = 15;
    String TRUSTED_PROXIES = "192.0.2.0/24";
}
