package az.jeparla.common;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Test-only endpoints under /api/v1/test, registered with {@code @Import(TestEndpoints.class)}. */
@TestConfiguration(proxyBeanMethods = false)
public class TestEndpoints {

    // The nested controller is registered as a member class of this imported configuration.

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
