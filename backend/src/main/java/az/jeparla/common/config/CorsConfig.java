package az.jeparla.common.config;

import java.time.Duration;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * The browser may call the REST API only from the configured frontend origin(s).
 * Other origins get no CORS headers (preflight and requests are rejected with 403).
 *
 * <p>Applied by the Spring Security filter chain ({@code http.cors()}), before authentication.
 * Credentials are allowed for the refresh-token cookie on {@code /api/v1/auth}.
 */
@Configuration(proxyBeanMethods = false)
public class CorsConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
        CorsConfiguration api = new CorsConfiguration();
        api.setAllowedOrigins(properties.allowedOrigins());
        api.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        api.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE,
                HttpHeaders.ACCEPT, HttpHeaders.ACCEPT_LANGUAGE, "Idempotency-Key"));
        api.setExposedHeaders(List.of(HttpHeaders.LOCATION, HttpHeaders.RETRY_AFTER));
        api.setAllowCredentials(true);
        api.setMaxAge(Duration.ofHours(1));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", api);
        return source;
    }
}
