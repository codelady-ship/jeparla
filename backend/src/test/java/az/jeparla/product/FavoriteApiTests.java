package az.jeparla.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.store.Store;
import az.jeparla.support.AuthIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;

/**
 * Saved products of a signed-in buyer (#41, PLAN 5.11): own list only, idempotent add and remove, listed products
 * only, today's price next to the saved one (#112), and the guest list merged after sign-in.
 */
@AuthIntegrationTest
class FavoriteApiTests extends MerchantApiTestBase {

    private static final String FAVORITES = "/api/v1/favorites";

    private long listedProduct(String price) {
        return tx.execute(status -> {
            Store store = data.approvedStore(data.merchant());
            return data.publicProduct(store, data.category(), data.fineness(Metal.GOLD), price).getId();
        });
    }

    @Test
    void guestsHaveNoServerList() throws Exception {
        mvc.perform(get(FAVORITES)).andExpect(status().isUnauthorized());
        mvc.perform(put(FAVORITES + "/1")).andExpect(status().isUnauthorized());
        mvc.perform(delete(FAVORITES + "/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void addingAndRemovingIsIdempotentAndPrivate() throws Exception {
        long buyer = newBuyer();
        long other = newBuyer();
        long product = listedProduct("640.00");

        mvc.perform(put(FAVORITES + "/" + product).with(buyer(buyer))).andExpect(status().isNoContent());
        mvc.perform(put(FAVORITES + "/" + product).with(buyer(buyer))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM favorites WHERE user_id = ?", Long.class, buyer)).isOne();

        mvc.perform(get(FAVORITES).with(buyer(buyer)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].product.id").value(product))
                .andExpect(jsonPath("$[0].product.priceFrom.amount").value("640.00"))
                .andExpect(jsonPath("$[0].savedPrice.amount").value("640.00"))
                .andExpect(jsonPath("$[0].savedPrice.currency").value("AZN"))
                .andExpect(jsonPath("$[0].savedAt").isNotEmpty());
        // Another account sees its own (empty) list and cannot remove the first one's.
        mvc.perform(get(FAVORITES).with(buyer(other))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete(FAVORITES + "/" + product).with(buyer(other))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM favorites WHERE user_id = ?", Long.class, buyer)).isOne();

        // Today's price changes; the saved price stays, so the page can show the difference.
        jdbc.update("UPDATE product_variants SET price = 600.00 WHERE product_id = ?", product);
        mvc.perform(put(FAVORITES + "/" + product).with(buyer(buyer))).andExpect(status().isNoContent());
        mvc.perform(get(FAVORITES).with(buyer(buyer)))
                .andExpect(jsonPath("$[0].product.priceFrom.amount").value("600.00"))
                .andExpect(jsonPath("$[0].savedPrice.amount").value("640.00"));

        mvc.perform(delete(FAVORITES + "/" + product).with(buyer(buyer))).andExpect(status().isNoContent());
        mvc.perform(delete(FAVORITES + "/" + product).with(buyer(buyer))).andExpect(status().isNoContent());
        mvc.perform(get(FAVORITES).with(buyer(buyer))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void onlyListedProductsAreSavedAndHiddenOnesAreLeftOut() throws Exception {
        long buyer = newBuyer();
        mvc.perform(put(FAVORITES + "/999999999").with(buyer(buyer))).andExpect(status().isNotFound());
        long draft = tx.execute(status -> data.product(data.approvedStore(data.merchant()), data.category(),
                data.fineness(Metal.GOLD), "10.00").getId());
        mvc.perform(put(FAVORITES + "/" + draft).with(buyer(buyer))).andExpect(status().isNotFound());

        long product = listedProduct("90.00");
        mvc.perform(put(FAVORITES + "/" + product).with(buyer(buyer))).andExpect(status().isNoContent());
        jdbc.update("UPDATE products SET deleted_at = now() WHERE id = ?", product);
        mvc.perform(get(FAVORITES).with(buyer(buyer))).andExpect(jsonPath("$.length()").value(0));
        // A row saved before V17 has no saved price: null, not zero.
        long old = listedProduct("75.00");
        jdbc.update("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", buyer, old);
        mvc.perform(get(FAVORITES).with(buyer(buyer)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].savedPrice").value(Matchers.nullValue()));
    }

    @Test
    void theGuestListIsMergedAfterSignIn() throws Exception {
        long buyer = newBuyer();
        long first = listedProduct("100.00");
        long second = listedProduct("200.00");
        mvc.perform(put(FAVORITES + "/" + first).with(buyer(buyer))).andExpect(status().isNoContent());
        String body = "{\"productIds\": [%d, %d, %d, 999999999]}".formatted(first, second, second);
        mvc.perform(json(post(FAVORITES + "/import"), body).with(buyer(buyer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        // Repeating it changes nothing.
        mvc.perform(json(post(FAVORITES + "/import"), body).with(buyer(buyer)))
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(json(post(FAVORITES + "/import"), "{\"productIds\": [0]}").with(buyer(buyer)))
                .andExpect(status().isBadRequest());
    }
}
