package az.jeparla.store;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.store.dto.MadeToOrderDto;
import org.junit.jupiter.api.Test;

/** Made to order as the store declares it (#108): the days only go with "yes", null is "not declared". */
class MadeToOrderTests {

    @Test
    void theDaysOnlyGoWithYes() {
        Store store = new Store();
        assertThat(MadeToOrderDto.of(store)).isNull();

        store.declareMadeToOrder(true, 10);
        assertThat(MadeToOrderDto.of(store)).isEqualTo(new MadeToOrderDto(true, 10));

        store.declareMadeToOrder(false, 10);
        assertThat(MadeToOrderDto.of(store)).isEqualTo(new MadeToOrderDto(false, null));

        store.declareMadeToOrder(null, 10);
        assertThat(MadeToOrderDto.of(store)).isNull();
        assertThat(store.getMadeToOrderDays()).isNull();
    }
}
