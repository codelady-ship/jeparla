package az.jeparla.common;

import az.jeparla.auth.AccessRule;
import az.jeparla.auth.AccessRule.Access;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpMethod;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only endpoints under /api/v1/test, registered with {@code @Import(TestEndpoints.class)}, with their URL
 * rules (the API denies every path without one, #134): GETs public, the POST for signed-in users.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestEndpoints {

    // The nested controller is registered as a member class of this imported configuration.

    @Bean
    AccessRule testEndpointGets() {
        return AccessRule.of(HttpMethod.GET, Access.PUBLIC, "/api/v1/test/ping", "/api/v1/test/boom");
    }

    @Bean
    AccessRule testEndpointEcho() {
        return AccessRule.of(HttpMethod.POST, Access.AUTHENTICATED, "/api/v1/test/echo");
    }

    public record EchoRequest(@NotBlank String name, @Size(min = 2, max = 10) String code) {
    }

    @RestController
    @RequestMapping("/api/v1/test")
    public static class EchoController {

        @PostMapping("/echo")
        public EchoRequest echo(@Valid @RequestBody EchoRequest request) {
            return request;
        }

        @GetMapping("/ping")
        public Map<String, String> ping() {
            return Map.of("status", "ok");
        }

        @GetMapping("/boom")
        public Map<String, String> boom() {
            throw new IllegalStateException("internal detail that must not leak");
        }
    }
}
