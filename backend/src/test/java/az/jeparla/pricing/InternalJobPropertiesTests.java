package az.jeparla.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.error.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** The internal job token: off when empty, refused when short. */
class InternalJobPropertiesTests {

    @Test
    void emptyTokenTurnsTheEndpointOff() {
        assertThat(new InternalJobProperties(null).enabled()).isFalse();
        assertThat(new InternalJobProperties("  ").enabled()).isFalse();
        InternalJobController controller = new InternalJobController(new InternalJobProperties(""), null);
        assertThatThrownBy(() -> controller.runMetalPrices("anything")).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void shortTokenStopsTheStart() {
        assertThatThrownBy(() -> new InternalJobProperties("too-short-token"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JEPARLA_INTERNAL_JOB_TOKEN");
        assertThat(new InternalJobProperties("0123456789abcdef0123456789abcdef").enabled()).isTrue();
    }
}
