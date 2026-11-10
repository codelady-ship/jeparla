package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.error.ApiException;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** #141: the comma-separated ids of /products?ids= and /variants?ids=. */
class IdsParameterTests {

    @Test
    void emptyElementsAreIgnored() {
        assertThat(IdsParameter.parse(Arrays.asList(null, "", " "), 2)).isEmpty();
        assertThat(IdsParameter.parse(null, 2)).isEmpty();
        assertThat(IdsParameter.parse(List.of("1", "", " 2 ", "1"), 3)).containsExactly(1L, 2L, 1L);
        assertThat(IdsParameter.parse(List.of("9223372036854775807"), 1)).containsExactly(Long.MAX_VALUE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "+1", "01", "1.0", "abc", "1e3", "9223372036854775808", "99999999999999999999"})
    void anythingButAPositiveIdIsRefused(String value) {
        assertThatThrownBy(() -> IdsParameter.parse(List.of("1", value), 5))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo("catalog.invalid_ids");
                    assertThat(e.field()).isEqualTo("ids");
                });
    }

    @Test
    void tooManyIdsAreRefused() {
        assertThat(IdsParameter.parse(List.of("1", "2", "", "3"), 3)).hasSize(3);
        assertThatThrownBy(() -> IdsParameter.parse(List.of("1", "2", "3", "4"), 3))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("catalog.too_many_ids"));
    }
}
