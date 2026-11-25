package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import org.junit.jupiter.api.Test;

/** Same design in another metal (V70): the seller links two own products; the product page shows the switch. */
@AuthIntegrationTest
class MetalSiblingApiTests extends MerchantApiTestBase {

    private long gold(Seller seller) throws Exception {
        return createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "450.00"));
    }

    private long silver(Seller seller) throws Exception {
        String json = goldProduct(category(), fineness(Metal.SILVER), "90.00").replace("\"GOLD\"", "\"SILVER\"")
                .replace("Qızıl üzük", "Gümüş üzük");
        return createProduct(seller, json);
    }

    private static String link(long productId) {
        return "/api/v1/merchant/products/" + productId + "/metal-sibling";
    }

    private void publish(long productId) {
        jdbc.update("UPDATE products SET status = 'APPROVED', submitted_at = now(), published_at = now() WHERE id = ?",
                productId);
    }

    private String slug(long productId) {
        return jdbc.queryForObject("SELECT slug FROM products WHERE id = ?", String.class, productId);
    }

    @Test
    void linksBothWaysAndThePublicPageShowsTheOtherMetal() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long gold = gold(seller);
        long silver = silver(seller);

        mvc.perform(get(link(gold)).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siblingId").doesNotExist())
                .andExpect(jsonPath("$.options.length()").value(1))
                .andExpect(jsonPath("$.options[0].id").value(silver))
                .andExpect(jsonPath("$.options[0].metal").value("SILVER"));

        mvc.perform(json(put(link(gold)), "{\"siblingId\": " + silver + "}").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siblingId").value(silver));
        assertThat(jdbc.queryForObject("SELECT metal_sibling_id FROM products WHERE id = ?", Long.class, silver))
                .isEqualTo(gold);
        // Linking changes nothing that is sold: no new review.
        assertThat(jdbc.queryForObject("SELECT status FROM products WHERE id = ?", String.class, gold))
                .isEqualTo("DRAFT");

        publish(gold);
        // The other product is not public yet: no switch.
        mvc.perform(get("/api/v1/products/" + slug(gold)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metalSibling").doesNotExist());
        publish(silver);
        mvc.perform(get("/api/v1/products/" + slug(gold)))
                .andExpect(jsonPath("$.metalSibling.slug").value(slug(silver)))
                .andExpect(jsonPath("$.metalSibling.metal").value("SILVER"));
        mvc.perform(get("/api/v1/products/" + slug(silver)))
                .andExpect(jsonPath("$.metalSibling.slug").value(slug(gold)))
                .andExpect(jsonPath("$.metalSibling.metal").value("GOLD"));

        mvc.perform(json(put(link(silver)), "{\"siblingId\": null}").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siblingId").doesNotExist());
        assertThat(jdbc.queryForObject("SELECT metal_sibling_id FROM products WHERE id = ?", Long.class, gold))
                .isNull();
        mvc.perform(get("/api/v1/products/" + slug(gold))).andExpect(jsonPath("$.metalSibling").doesNotExist());
    }

    @Test
    void anotherLinkMovesThePartner() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long gold = gold(seller);
        long silver = silver(seller);
        long otherGold = gold(seller);
        mvc.perform(json(put(link(gold)), "{\"siblingId\": " + silver + "}").with(seller.token()))
                .andExpect(status().isOk());

        mvc.perform(json(put(link(otherGold)), "{\"siblingId\": " + silver + "}").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siblingId").value(silver));
        assertThat(jdbc.queryForObject("SELECT metal_sibling_id FROM products WHERE id = ?", Long.class, gold))
                .isNull();
        assertThat(jdbc.queryForObject("SELECT metal_sibling_id FROM products WHERE id = ?", Long.class, silver))
                .isEqualTo(otherGold);
    }

    @Test
    void refusesTheSameMetalItselfBijouterieAndAnotherStore() throws Exception {
        Seller seller = seller(SellerKind.MIXED, true);
        long gold = gold(seller);
        long otherGold = gold(seller);
        long beads = createProduct(seller, beadsProduct(category(), "Muncuq boyunbağı"));
        Seller stranger = seller(SellerKind.PRECIOUS, true);
        long strangerSilver = silver(stranger);

        for (long target : new long[] {otherGold, gold, beads, strangerSilver, 999_999_999L}) {
            mvc.perform(json(put(link(gold)), "{\"siblingId\": " + target + "}").with(seller.token()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("merchant.metal_sibling"));
        }
        // Another seller cannot read or change the link.
        mvc.perform(get(link(gold)).with(stranger.token())).andExpect(status().isForbidden());
        mvc.perform(json(put(link(gold)), "{\"siblingId\": null}").with(stranger.token()))
                .andExpect(status().isForbidden());
    }
}
