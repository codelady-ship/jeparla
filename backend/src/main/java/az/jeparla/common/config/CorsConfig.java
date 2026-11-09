package az.jeparla.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The browser may call the REST API only from the configured frontend origin(s).
 * Other origins get no CORS headers (preflight is rejected with 403).
 */
@Configuration(proxyBeanMethods = false)
public class CorsConfig implements WebMvcConfigurer {

    private final CorsProperties properties;

    public CorsConfig(CorsProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(properties.allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE,
                        HttpHeaders.ACCEPT, HttpHeaders.ACCEPT_LANGUAGE, "Idempotency-Key")
                .exposedHeaders(HttpHeaders.LOCATION)
                .allowCredentials(true)
                .maxAge(3600);
    }
}
