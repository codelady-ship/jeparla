package az.jeparla.common.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.common.TestEndpoints;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "jeparla.cors.allowed-origins=https://jeparla.example")
@AutoConfigureMockMvc
@Import(TestEndpoints.class)
class CorsTests {

    private static final String ALLOWED = "https://jeparla.example";
    private static final String OTHER = "https://evil.example";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void preflightFromFrontendOriginIsAllowed() throws Exception {
        mockMvc.perform(options("/api/v1/test/ping")
                        .header(HttpHeaders.ORIGIN, ALLOWED)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED));
    }

    @Test
    void preflightFromOtherOriginIsRejected() throws Exception {
        mockMvc.perform(options("/api/v1/test/ping")
                        .header(HttpHeaders.ORIGIN, OTHER)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void simpleRequestFromFrontendOriginGetsCorsHeader() throws Exception {
        mockMvc.perform(get("/api/v1/test/ping").header(HttpHeaders.ORIGIN, ALLOWED))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED));
    }

    @Test
    void simpleRequestFromOtherOriginIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/test/ping").header(HttpHeaders.ORIGIN, OTHER))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
