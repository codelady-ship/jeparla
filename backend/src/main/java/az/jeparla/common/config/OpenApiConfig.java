package az.jeparla.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI document at /v3/api-docs, Swagger UI at /swagger-ui.html. */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    @Bean
    public OpenAPI jeparlaOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Jeparla API")
                .version("v1")
                .description("REST API of the Jeparla jewelry catalog. Errors use RFC 9457 "
                        + "ProblemDetail, localized by Accept-Language (az, en, ru)."));
    }
}
