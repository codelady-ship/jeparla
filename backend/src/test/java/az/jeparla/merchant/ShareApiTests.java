package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.support.AuthIntegrationTest;
import az.jeparla.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Shareable catalog link (#100) over HTTP on PostgreSQL and Redis: the merchant's link, QR code and replacement,
 * the public resolution of a code, visit counting (bots, reloads, sources) and the merchant statistics, which only
 * ever show the signed-in seller's own store.
 */
@AuthIntegrationTest
class ShareApiTests extends MerchantApiTestBase {

    private static final String CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
    private static final String LINK = "/api/v1/merchant/store/share";

    @Autowired
    private StoreRepository stores;

    /** A fresh client address, so rate-limit counters of other tests do not interfere. */
    private static String newIp() {
        int n = TestData.next();
        return "10.100." + (n / 250 % 250) + "." + (n % 250 + 1);
    }

    private static MockHttpServletRequestBuilder from(MockHttpServletRequestBuilder request, String ip, String agent) {
        MockHttpServletRequestBuilder withAgent = agent == null ? request : request.header(HttpHeaders.USER_AGENT, agent);
        return withAgent.with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private Store store(long id) {
        return stores.findById(id).orElseThrow();
    }

    private String slug(Seller seller) {
        return tx.execute(status -> store(seller.storeId()).getSlug());
    }

    /** One listed product, so the store page has something to show. */
    private void listedProduct(Seller seller) {
        tx.executeWithoutResult(status -> data.publicProduct(store(seller.storeId()), data.category(),
                data.fineness(Metal.GOLD), "250.00"));
    }

    private String code(Seller seller) throws Exception {
        return JsonPath.read(body(mvc.perform(get(LINK).with(seller.token())).andExpect(status().isOk()).andReturn()),
                "$.code");
    }

    private void visit(String slug, String query, String ip, String agent) throws Exception {
        mvc.perform(from(post("/api/v1/stores/" + slug + "/visits" + query), ip, agent))
                .andExpect(status().isNoContent());
    }

    @Test
    void theSellerGetsALinkAndAQrCodeThatOpenTheStore() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        listedProduct(seller);
        String code = code(seller);
        assertThat(code).matches("^[a-km-np-z2-9]{8}$");

        mvc.perform(get(LINK).with(seller.token()))
                .andExpect(jsonPath("$.url").value("http://localhost:3000/s/" + code))
                .andExpect(jsonPath("$.qrUrl").value("http://localhost:3000/s/" + code + "?ref=qr"))
                .andExpect(jsonPath("$.active").value(true));
        String svg = body(mvc.perform(get(LINK + "/qr.svg").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("image/svg+xml"))
                .andReturn());
        assertThat(svg).startsWith("<svg").contains("aria-label=\"http://localhost:3000/s/" + code + "?ref=qr\"");

        mvc.perform(get("/api/v1/share/" + code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(slug(seller)))
                .andExpect(jsonPath("$.name").value("Test Zərgər"))
                .andExpect(jsonPath("$.city").value("Bakı"))
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.productCount").value(1))
                .andExpect(jsonPath("$.coverImageUrl").value(Matchers.startsWith("http://localhost:9000/jeparla-public/test/")));
        mvc.perform(get("/api/v1/share/notacode")).andExpect(status().isNotFound());
    }

    @Test
    void aPendingStoresLinkIsInactiveAndDoesNotResolve() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        String code = code(seller);
        mvc.perform(get(LINK).with(seller.token())).andExpect(jsonPath("$.active").value(false));
        mvc.perform(get("/api/v1/share/" + code)).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/stores/" + slug(seller) + "/visits?ref=instagram"))
                .andExpect(status().isNotFound());
    }

    @Test
    void replacingTheLinkBreaksTheOldOneAndIsAudited() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        String old = code(seller);
        String fresh = JsonPath.read(body(mvc.perform(post(LINK + "/regenerate").with(seller.token()))
                .andExpect(status().isOk()).andReturn()), "$.code");

        assertThat(fresh).isNotEqualTo(old).isEqualTo(code(seller));
        mvc.perform(get("/api/v1/share/" + old)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/share/" + fresh)).andExpect(status().isOk());
        String details = jdbc.queryForObject("SELECT details::text FROM audit_logs WHERE action = 'STORE_SHARE_LINK_REPLACED'"
                + " AND target_id = ? AND actor_id = ?", String.class, String.valueOf(seller.storeId()), seller.userId());
        assertThat(details).contains(old, fresh);
    }

    @Test
    void aBlockedStoreCannotReplaceItsLink() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        jdbc.update("UPDATE stores SET status = 'BLOCKED' WHERE id = ?", seller.storeId());
        mvc.perform(post(LINK + "/regenerate").with(seller.token()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("merchant.store_blocked"));
    }

    @Test
    void onlyMerchantsReachTheirLinkAndStatistics() throws Exception {
        long buyer = newBuyer();
        for (String path : List.of(LINK, LINK + "/qr.svg", "/api/v1/merchant/referrals")) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(buyer(buyer))).andExpect(status().isForbidden());
        }
        mvc.perform(post(LINK + "/regenerate").with(buyer(buyer))).andExpect(status().isForbidden());
        mvc.perform(get(LINK).with(merchant(newMerchant())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("merchant.no_store"));
    }

    @Test
    void visitsAreCountedPerSourceWithoutBotsOrReloads() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        String slug = slug(seller);
        String ip = newIp();

        visit(slug, "?ref=instagram", ip, CHROME);
        visit(slug, "?ref=IG", ip, CHROME); // the same visitor again: not counted
        visit(slug, "?ref=instagram", newIp(), CHROME);
        visit(slug, "?utm_source=tiktok", newIp(), CHROME);
        visit(slug, "?ref=qr", newIp(), CHROME);
        visit(slug, "?ref=instagram", newIp(), "WhatsApp/2.23.20.0 A"); // link preview
        visit(slug, "?ref=instagram", newIp(), "Mozilla/5.0 (compatible; Googlebot/2.1)");
        visit(slug, "?ref=instagram", newIp(), null);
        visit(slug, "", newIp(), CHROME); // no source: an ordinary visit, not counted
        mvc.perform(from(post("/api/v1/stores/" + slug + "/visits?ref=tiktok"), newIp(), CHROME)
                .header("Sec-Purpose", "prefetch")).andExpect(status().isNoContent());

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Baku"));
        assertThat(jdbc.queryForList("SELECT source || '=' || visits FROM store_referral_counts WHERE store_id = ?"
                + " AND day = ? ORDER BY source", String.class, seller.storeId(), today))
                .containsExactly("INSTAGRAM=2", "QR=1", "TIKTOK=1");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.columns"
                + " WHERE table_name = 'store_referral_counts'", Integer.class))
                .as("store, day, source and two counters: nothing about the visitor").isEqualTo(5);
    }

    @Test
    void whatsappClicksOfReferredVisitorsAreCountedForTheirSource() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        listedProduct(seller);
        long productId = jdbc.queryForObject("SELECT id FROM products WHERE store_id = ?", Long.class, seller.storeId());

        mvc.perform(from(post("/api/v1/products/" + productId + "/contact-click?ref=tiktok"), newIp(), CHROME))
                .andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/" + productId + "/contact-click"), newIp(), CHROME))
                .andExpect(status().isNoContent());
        mvc.perform(from(post("/api/v1/products/" + productId + "/contact-click?ref=tiktok"), newIp(),
                "facebookexternalhit/1.1")).andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT sum(clicks) FROM product_contact_clicks WHERE product_id = ?", Long.class,
                productId)).as("every click still counts for the product").isEqualTo(3);
        assertThat(jdbc.queryForList("SELECT source || '=' || whatsapp_clicks FROM store_referral_counts"
                + " WHERE store_id = ?", String.class, seller.storeId())).containsExactly("TIKTOK=1");
    }

    @Test
    void theStatisticsShowOnlyTheSellersOwnStoreByDayAndSource() throws Exception {
        Seller first = seller(SellerKind.PRECIOUS, true);
        Seller second = seller(SellerKind.PRECIOUS, true);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Baku"));
        // Counters of earlier days (the store row says it exists since then).
        jdbc.update("UPDATE stores SET created_at = now() - INTERVAL '120 days' WHERE id = ?", first.storeId());
        jdbc.update("""
                INSERT INTO store_referral_counts (store_id, day, source, visits, whatsapp_clicks) VALUES
                    (?, ?, 'INSTAGRAM', 5, 2), (?, ?, 'TIKTOK', 7, 0), (?, ?, 'INSTAGRAM', 3, 1),
                    (?, ?, 'QR', 100, 50), (?, ?, 'INSTAGRAM', 40, 4)
                """,
                first.storeId(), today, first.storeId(), today.minusDays(3), first.storeId(), today.minusDays(29),
                second.storeId(), today, first.storeId(), today.minusDays(60));

        mvc.perform(get("/api/v1/merchant/referrals").with(first.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.from").value(today.minusDays(29).toString()))
                .andExpect(jsonPath("$.to").value(today.toString()))
                .andExpect(jsonPath("$.visits").value(15))
                .andExpect(jsonPath("$.whatsappClicks").value(3))
                .andExpect(jsonPath("$.sources[*].source", Matchers.contains("INSTAGRAM", "TIKTOK")))
                .andExpect(jsonPath("$.sources[0].visits").value(8))
                .andExpect(jsonPath("$.sources[0].whatsappClicks").value(3))
                .andExpect(jsonPath("$.daily.length()").value(30))
                .andExpect(jsonPath("$.daily[0].day").value(today.minusDays(29).toString()))
                .andExpect(jsonPath("$.daily[0].visits").value(3))
                .andExpect(jsonPath("$.daily[29].visits").value(5));
        mvc.perform(get("/api/v1/merchant/referrals?days=90").with(first.token()))
                .andExpect(jsonPath("$.visits").value(55))
                .andExpect(jsonPath("$.daily.length()").value(90));

        // The other seller sees only its own QR visits, whatever it asks for.
        mvc.perform(get("/api/v1/merchant/referrals?days=90").with(second.token()))
                .andExpect(jsonPath("$.visits").value(100))
                .andExpect(jsonPath("$.sources[*].source", Matchers.contains("QR")))
                .andExpect(jsonPath("$.from").value(today.toString()))
                .andExpect(jsonPath("$.daily.length()").value(1));
        mvc.perform(get("/api/v1/merchant/referrals?days=7").with(first.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.referral_days"));
    }
}
