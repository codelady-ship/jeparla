package az.jeparla.auth;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.WithPostgres;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Production default (#134): without {@code JEPARLA_API_DOCS=true} the API publishes no OpenAPI document and no
 * Swagger UI; the paths answer 404 with the strict JSON Content-Security-Policy. (The test profile turns the
 * docs on for the contract tests; these properties are the application.yml defaults.)
 */
@WithPostgres
@SpringBootTest(properties = {"springdoc.api-docs.enabled=false", "springdoc.swagger-ui.enabled=false"})
@AutoConfigureMockMvc
class ApiDocsOffTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void openApiAndSwaggerUiAreNotFound() throws Exception {
        for (String path : List.of("/v3/api-docs", "/v3/api-docs/swagger-config", "/swagger-ui.html",
                "/swagger-ui/index.html")) {
            mockMvc.perform(get(path))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")));
        }
    }
}
