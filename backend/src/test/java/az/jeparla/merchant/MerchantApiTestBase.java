package az.jeparla.merchant;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.FakeObjectStorage;
import az.jeparla.support.TestData;
import com.jayway.jsonpath.JsonPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Fixtures of the merchant API tests (#39): sellers with a store made through the API, catalog data
 * through JPA, and JSON bodies as the frontend sends them. Subclasses carry {@code @AuthIntegrationTest}.
 */
public abstract class MerchantApiTestBase {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected TestData data;

    @Autowired
    protected TransactionTemplate tx;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected FakeObjectStorage storage;

    /** A seller account and its store. */
    protected record Seller(long userId, long storeId) {

        public JwtRequestPostProcessor token() {
            return merchant(userId);
        }
    }

    protected static JwtRequestPostProcessor merchant(long userId) {
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_MERCHANT"));
    }

    protected static JwtRequestPostProcessor buyer(long userId) {
        return jwt().jwt(token -> token.subject(String.valueOf(userId)))
                .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }

    protected long newMerchant() {
        return tx.execute(status -> data.merchant().getId());
    }

    protected long newBuyer() {
        return tx.execute(status -> data.buyer().getId());
    }

    /** A seller whose store application went through the API; optionally approved with a verified seller. */
    protected Seller seller(SellerKind kind, boolean approved) throws Exception {
        long userId = newMerchant();
        MvcResult result = mvc.perform(json(post("/api/v1/merchant/stores"), storeJson("Test Zərgər", kind))
                .with(merchant(userId))).andExpect(status().isCreated()).andReturn();
        long storeId = id(result);
        if (approved) {
            jdbc.update("UPDATE stores SET status = 'APPROVED', approved_at = now(), seller_status = 'VERIFIED'"
                    + " WHERE id = ?", storeId);
        }
        return new Seller(userId, storeId);
    }

    protected long category() {
        return tx.execute(status -> data.category().getId());
    }

    protected long fineness(Metal metal) {
        return tx.execute(status -> data.fineness(metal).getId());
    }

    /** Makes sure the metal has an APPLIED quote (this context has no metal price job). */
    protected void ensureQuote(Metal metal) {
        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM metal_price_snapshots WHERE metal = ? AND status = 'APPLIED'", Integer.class,
                metal.name());
        if (applied == null || applied == 0) {
            jdbc.update("""
                    INSERT INTO metal_price_snapshots (metal, quote_date, price_per_ounce, price_per_gram, source)
                    VALUES (?, DATE '2026-11-02', 4500.0000, 144.6782, 'CBAR')
                    ON CONFLICT DO NOTHING
                    """, metal.name());
        }
    }

    protected static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    protected static long id(MvcResult result) throws Exception {
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    protected static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    protected static String storeJson(String name, SellerKind kind) {
        return """
                {"name": "%s", "whatsapp": "050 123 45 67", "city": "Bakı", "address": "Nizami küçəsi 10",
                 "social": "@test.zerger", "description": "Əl işi zərgərlik.", "openingHours": "Mo-Sa 10:00-19:00",
                 "legalType": "SOLE_TRADER", "taxId": "1234567890", "sellerKind": "%s", "codeAccepted": true}
                """.formatted(name, kind);
    }

    /** A PRECIOUS gold product with one FIXED variant. */
    protected static String goldProduct(long categoryId, long finenessId, String price) {
        return """
                {"materialKind": "PRECIOUS", "categoryId": %d, "name": {"az": "Qızıl üzük"},
                 "description": {"az": "Klassik üzük."}, "metal": "GOLD",
                 "variants": [{"finenessId": %d, "weightGrams": "3.25", "size": "17", "pricingMode": "FIXED",
                               "price": "%s", "stockStatus": "IN_STOCK"}],
                 "stones": [{"type": "DIAMOND", "origin": "NATURAL", "carat": "0.25", "count": 1,
                             "certificateLab": "GIA", "certificateNumber": "123"}]}
                """.formatted(categoryId, finenessId, price);
    }

    /** A FASHION product (beads) with one FIXED variant and the seller's confirmation. */
    protected static String beadsProduct(long categoryId, String name) {
        return """
                {"materialKind": "FASHION", "categoryId": %d, "name": {"az": "%s"}, "material": "BEADS",
                 "notPreciousConfirmed": true,
                 "variants": [{"price": "25.00", "stockStatus": "MADE_TO_ORDER"}]}
                """.formatted(categoryId, name);
    }

    protected long createProduct(Seller seller, String json) throws Exception {
        return id(mvc.perform(json(post("/api/v1/merchant/products"), json).with(seller.token()))
                .andExpect(status().isCreated()).andReturn());
    }

    /** Asks for an upload URL; returns the key the API chose. */
    protected String uploadKey(Seller seller, long productId, String contentType, long sizeBytes) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/images/uploads"),
                "{\"contentType\": \"%s\", \"sizeBytes\": %d}".formatted(contentType, sizeBytes))
                .with(seller.token())).andExpect(status().isOk()).andReturn();
        return JsonPath.read(body(result), "$.key");
    }

    /** The whole photo flow: upload URL, the browser's PUT (into the fake bucket), attach. Returns the image id. */
    protected long attachPng(Seller seller, long productId) throws Exception {
        byte[] png = png(800, 1000);
        String key = uploadKey(seller, productId, "image/png", png.length);
        storage.put(key, png, "image/png");
        return id(mvc.perform(json(post("/api/v1/merchant/products/" + productId + "/images"),
                "{\"key\": \"%s\"}".formatted(key)).with(seller.token())).andExpect(status().isCreated()).andReturn());
    }

    protected static byte[] png(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
