package az.jeparla.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CorsPropertiesTests {

    @Test
    void acceptsExactOriginsAndTrimsThem() {
        var properties = new CorsProperties(List.of(" https://jeparla.az ", "http://localhost:3000"));
        assertThat(properties.allowedOrigins()).containsExactly("https://jeparla.az", "http://localhost:3000");
    }

    @ParameterizedTest
    @ValueSource(strings = {"*", "https://*.jeparla.az", "jeparla.az", "https://jeparla.az/path", "ftp://jeparla.az", " "})
    void rejectsWildcardsAndNonOrigins(String origin) {
        assertThatIllegalArgumentException().isThrownBy(() -> new CorsProperties(List.of(origin)));
    }

    @Test
    void rejectsMissingOrigins() {
        assertThatIllegalArgumentException().isThrownBy(() -> new CorsProperties(List.of()));
        assertThatIllegalArgumentException().isThrownBy(() -> new CorsProperties(null));
    }
}
