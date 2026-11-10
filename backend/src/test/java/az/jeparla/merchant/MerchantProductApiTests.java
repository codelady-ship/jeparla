package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.pricing.PricingEngine;
import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Products of the seller's own store (#39) and the bijouterie rules (#128). */
@AuthIntegrationTest
class MerchantProductApiTests extends MerchantApiTestBase {

    private static final String PRODUCTS = "/api/v1/merchant/products";

    @Test
    void aPreciousProductIsCreatedAsADraftWithItsPriceHistory() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        MvcResult result = mvc.perform(json(post(PRODUCTS), goldProduct(category(), fineness(Metal.GOLD), "1250.00"))
                        .with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.materialKind").value("PRECIOUS"))
                .andExpect(jsonPath("$.metal").value("GOLD"))
                .andExpect(jsonPath("$.expertiseStatus").value("NONE"))
                .andExpect(jsonPath("$.variants[0].price.amount").value("1250.00"))
                .andExpect(jsonPath("$.variants[0].weightGrams").value("3.250"))
                .andExpect(jsonPath("$.variants[0].sku").value(Matchers.startsWith("JP")))
                .andExpect(jsonPath("$.stones[0].type").value("DIAMOND"))
                .andReturn();
        long productId = id(result);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM price_history h JOIN product_variants v ON v.id = h.variant_id
                WHERE v.product_id = ? AND h.reason = 'MERCHANT' AND h.price = 1250.00 AND h.changed_by = ?
                """, Integer.class, productId, seller.userId())).isEqualTo(1);

        mvc.perform(get(PRODUCTS).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", Matchers.contains((int) productId)));
    }

    @Test
    void aRepeatedIdempotencyKeyDoesNotCreateASecondProduct() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        String key = UUID.randomUUID().toString();
        String body = beadsProduct(category(), "Muncuqlu bilərzik");
        long first = id(mvc.perform(json(post(PRODUCTS), body).header("Idempotency-Key", key).with(seller.token()))
                .andExpect(status().isCreated()).andReturn());
        mvc.perform(json(post(PRODUCTS), body).header("Idempotency-Key", key).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM products WHERE store_id = ?", Integer.class,
                seller.storeId())).isEqualTo(1);
    }

    @Test
    void aMerchantWithoutAStoreCannotCreateProducts() throws Exception {
        mvc.perform(json(post(PRODUCTS), beadsProduct(category(), "Muncuq")).with(merchant(newMerchant())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("merchant.no_store"));
    }

    @Test
    void aMetalLinkedVariantIsPricedFromTheQuoteInUse() throws Exception {
        ensureQuote(Metal.GOLD);
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long finenessId = fineness(Metal.GOLD);
        String body = goldProduct(category(), finenessId, "1.00").replaceAll(
                "\"pricingMode\": \"FIXED\",\\s+\"price\": \"1\\.00\"",
                "\"pricingMode\": \"METAL_LINKED\", \"rule\": {\"laborPerGram\": \"10.00\", \"laborFixed\": \"5.00\","
                        + " \"stonePrice\": \"300.00\", \"markupPercent\": \"15.00\"}");
        assertThat(body).contains("METAL_LINKED");

        Map<String, Object> quote = jdbc.queryForMap("""
                SELECT id, price_per_gram FROM metal_price_snapshots WHERE metal = 'GOLD' AND status = 'APPLIED'
                ORDER BY quote_date DESC, id DESC LIMIT 1
                """);
        int finenessValue = jdbc.queryForObject("SELECT value FROM finenesses WHERE id = ?", Integer.class, finenessId);
        BigDecimal expected = PricingEngine.price(new BigDecimal("3.25"), finenessValue,
                (BigDecimal) quote.get("price_per_gram"), new PricingEngine.Rule(new BigDecimal("10.00"),
                        new BigDecimal("5.00"), new BigDecimal("300.00"), new BigDecimal("15.00"), null, null));

        MvcResult result = mvc.perform(json(post(PRODUCTS), body).with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.variants[0].pricingMode").value("METAL_LINKED"))
                .andExpect(jsonPath("$.variants[0].price.amount").value(expected.setScale(2).toPlainString()))
                .andExpect(jsonPath("$.variants[0].metalQuoteId").value(((Number) quote.get("id")).intValue()))
                .andExpect(jsonPath("$.variants[0].rule.markupPercent").value("15.00"))
                .andReturn();
        long variantId = ((Number) JsonPath.read(body(result), "$.variants[0].id")).longValue();
        assertThat(jdbc.queryForObject(
                "SELECT metal_snapshot_id FROM price_history WHERE variant_id = ? AND reason = 'MERCHANT'", Long.class,
                variantId)).isEqualTo(((Number) quote.get("id")).longValue());
    }

    @Test
    void moneyAndWeightKeepTheirScale() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long categoryId = category();
        long finenessId = fineness(Metal.GOLD);
        mvc.perform(json(post(PRODUCTS), goldProduct(categoryId, finenessId, "9.999")).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("variants[0].price")));
        mvc.perform(json(post(PRODUCTS), goldProduct(categoryId, finenessId, "100.00").replace("3.25", "1.2345"))
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("variants[0].weightGrams")));
        mvc.perform(json(post(PRODUCTS), goldProduct(categoryId, finenessId, "-5.00")).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", Matchers.contains("variants[0].price")));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM products WHERE store_id = ?", Integer.class,
                seller.storeId())).isZero();
    }

    @Test
    void preciousRulesNeedAMetalFinenessAndWeight() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long categoryId = category();
        long gold = fineness(Metal.GOLD);
        String product = goldProduct(categoryId, gold, "100.00");
        expectInvalid(seller, product.replace("\"metal\": \"GOLD\"", "\"metal\": null"), "merchant.metal_required",
                "metal");
        expectInvalid(seller, product.replace("\"finenessId\": " + gold, "\"finenessId\": " + fineness(Metal.SILVER)),
                "merchant.fineness_invalid", "variants[0].finenessId");
        expectInvalid(seller, product.replace("\"finenessId\": " + gold + ",", ""), "merchant.fineness_required",
                "variants[0].finenessId");
        expectInvalid(seller, product.replace("\"weightGrams\": \"3.25\",", ""), "merchant.weight_required",
                "variants[0].weightGrams");
        expectInvalid(seller, product.replace("\"metal\": \"GOLD\"", "\"metal\": \"GOLD\", \"material\": \"BEADS\""),
                "merchant.material_precious", "material");
        expectInvalid(seller, product.replace("\"pricingMode\": \"FIXED\"", "\"pricingMode\": \"METAL_LINKED\""),
                "merchant.rule_required", "variants[0].rule");
        expectInvalid(seller, product.replace("\"categoryId\": " + categoryId, "\"categoryId\": 999999999"),
                "merchant.category_invalid", "categoryId");
        expectInvalid(seller, product.replace("\"certificateLab\": \"GIA\",", ""), "merchant.certificate_lab_required",
                "stones[0].certificateLab");
        expectInvalid(seller, beadsProduct(categoryId, "Muncuq"), "merchant.material_not_allowed", "materialKind");
    }

    @Test
    void bijouterieIsNeverSoldAsPreciousMetal() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long categoryId = category();
        String beads = beadsProduct(categoryId, "Muncuqlu bilərzik");
        expectInvalid(seller, goldProduct(categoryId, fineness(Metal.GOLD), "100.00"), "merchant.material_not_allowed",
                "materialKind");
        expectInvalid(seller, beads.replace("\"material\": \"BEADS\"", "\"material\": \"BEADS\", \"metal\": \"GOLD\""),
                "merchant.fashion_metal", "metal");
        expectInvalid(seller, beads.replace("\"material\": \"BEADS\",", ""), "merchant.material_required", "material");
        expectInvalid(seller, beads.replace("\"notPreciousConfirmed\": true", "\"notPreciousConfirmed\": false"),
                "merchant.not_precious_confirmation", "notPreciousConfirmed");
        expectInvalid(seller, beadsProduct(categoryId, "Qızıl üzük"), "merchant.fashion_claim", "name");
        expectInvalid(seller, beadsProduct(categoryId, "Ring 14K gold"), "merchant.fashion_claim", "name");
        expectInvalid(seller, beads.replace("\"price\": \"25.00\"",
                        "\"price\": \"25.00\", \"finenessId\": " + fineness(Metal.SILVER)),
                "merchant.fashion_metal", "variants[0].finenessId");
        expectInvalid(seller, beads.replace("\"price\": \"25.00\"", "\"pricingMode\": \"METAL_LINKED\""),
                "merchant.fashion_fixed_price", "variants[0].pricingMode");
        expectInvalid(seller, beads.replace("\"variants\"",
                        "\"stones\": [{\"type\": \"DIAMOND\", \"count\": 1}], \"variants\""),
                "merchant.fashion_stone", "stones[0].type");
        expectInvalid(seller, beads.replace("\"variants\"",
                        "\"stones\": [{\"type\": \"CUBIC_ZIRCONIA\", \"count\": 3, \"certificateLab\": \"GIA\"}],"
                                + " \"variants\""),
                "merchant.fashion_stone", "stones[0].type");

        // Honest bijouterie: plated metal named as plated, zircons without a certificate.
        mvc.perform(json(post(PRODUCTS), beadsProduct(categoryId, "Gümüş suyu ilə üzük")
                                .replace("\"BEADS\"", "\"SILVER_PLATED\"")
                                .replace("\"variants\"", "\"stones\": [{\"type\": \"CUBIC_ZIRCONIA\", \"count\": 3}],"
                                        + " \"variants\""))
                        .with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.materialKind").value("FASHION"))
                .andExpect(jsonPath("$.material").value("SILVER_PLATED"))
                .andExpect(jsonPath("$.metal").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.notPreciousConfirmedAt").isNotEmpty())
                .andExpect(jsonPath("$.expertiseStatus").value("NONE"))
                .andExpect(jsonPath("$.variants[0].finenessId").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.variants[0].weightGrams").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.variants[0].pricingMode").value("FIXED"));
    }

    @Test
    void theDatabaseRefusesTrustBadgesForBijouterie() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu bilərzik"));
        assertThatThrownBy(() -> jdbc.update("UPDATE products SET expertise_status = 'VERIFIED' WHERE id = ?",
                productId)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE stores SET documents_status = 'VERIFIED' WHERE id = ?",
                seller.storeId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE products SET metal = 'GOLD' WHERE id = ?", productId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void approvedBijouterieStaysOutOfThePublicCatalogForNow() throws Exception {
        Seller mixed = seller(SellerKind.MIXED, true);
        long categoryId = category();
        long fashionId = createProduct(mixed, beadsProduct(categoryId, "Muncuqlu bilərzik"));
        long preciousId = createProduct(mixed, goldProduct(categoryId, fineness(Metal.GOLD), "900.00"));
        attachPng(mixed, fashionId);
        attachPng(mixed, preciousId);
        jdbc.update("UPDATE products SET status = 'APPROVED', published_at = now() WHERE id IN (?, ?)", fashionId,
                preciousId);
        String fashionSlug = jdbc.queryForObject("SELECT slug FROM products WHERE id = ?", String.class, fashionId);
        String preciousSlug = jdbc.queryForObject("SELECT slug FROM products WHERE id = ?", String.class, preciousId);
        mvc.perform(get("/api/v1/products/" + preciousSlug)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/products/" + fashionSlug)).andExpect(status().isNotFound());
    }

    @Test
    void anotherMerchantsProductIsForbiddenEverywhere() throws Exception {
        Seller owner = seller(SellerKind.PRECIOUS, true);
        Seller other = seller(SellerKind.PRECIOUS, true);
        long categoryId = category();
        long finenessId = fineness(Metal.GOLD);
        String product = goldProduct(categoryId, finenessId, "500.00");
        long productId = createProduct(owner, product);
        long imageId = attachPng(owner, productId);
        long variantId = jdbc.queryForObject("SELECT id FROM product_variants WHERE product_id = ?", Long.class,
                productId);
        String variant = """
                {"finenessId": %d, "weightGrams": "2.00", "pricingMode": "FIXED", "price": "1.00",
                 "stockStatus": "IN_STOCK"}
                """.formatted(finenessId);
        String base = PRODUCTS + "/" + productId;
        MockHttpServletRequestBuilder[] requests = {
                get(base),
                json(put(base), product),
                json(patch(base + "/status"), "{\"status\": \"IN_REVIEW\"}"),
                delete(base),
                json(post(base + "/variants"), variant),
                json(put(base + "/variants/" + variantId), variant),
                delete(base + "/variants/" + variantId),
                json(post(base + "/images/uploads"), "{\"contentType\": \"image/png\", \"sizeBytes\": 1000}"),
                json(post(base + "/images"), "{\"key\": \"products/1/1/x.png\"}"),
                json(put(base + "/images/order"), "{\"imageIds\": [" + imageId + "]}"),
                delete(base + "/images/" + imageId),
        };
        for (MockHttpServletRequestBuilder request : requests) {
            mvc.perform(request.with(other.token()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("auth.forbidden"));
        }
        // Nothing changed.
        mvc.perform(get(base).with(owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.images.length()").value(1))
                .andExpect(jsonPath("$.variants.length()").value(1))
                .andExpect(jsonPath("$.variants[0].price.amount").value("500.00"));
        mvc.perform(get(PRODUCTS).with(other.token())).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void variantsAndPhotosOfTheSellersOtherProductAreNotFound() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long finenessId = fineness(Metal.GOLD);
        long first = createProduct(seller, goldProduct(category(), finenessId, "500.00"));
        long second = createProduct(seller, goldProduct(category(), finenessId, "600.00"));
        long secondImage = attachPng(seller, second);
        long secondVariant = jdbc.queryForObject("SELECT id FROM product_variants WHERE product_id = ?", Long.class,
                second);
        String variant = """
                {"finenessId": %d, "weightGrams": "2.00", "pricingMode": "FIXED", "price": "1.00",
                 "stockStatus": "IN_STOCK"}
                """.formatted(finenessId);
        String base = PRODUCTS + "/" + first;
        MockHttpServletRequestBuilder[] requests = {
                json(put(base + "/variants/" + secondVariant), variant),
                delete(base + "/variants/" + secondVariant),
                delete(base + "/images/" + secondImage),
        };
        for (MockHttpServletRequestBuilder request : requests) {
            mvc.perform(request.with(seller.token()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("not_found"));
        }
        // The first product has no photo, so another product's photo is not a valid order either.
        mvc.perform(json(put(base + "/images/order"), "{\"imageIds\": [" + secondImage + "]}").with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.image_order"));
        // Nothing changed on the second product.
        mvc.perform(get(PRODUCTS + "/" + second).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images.length()").value(1))
                .andExpect(jsonPath("$.images[0].id").value((int) secondImage))
                .andExpect(jsonPath("$.variants.length()").value(1))
                .andExpect(jsonPath("$.variants[0].id").value((int) secondVariant))
                .andExpect(jsonPath("$.variants[0].price.amount").value("600.00"));
    }

    @Test
    void missingAndDeletedProductsAreNotFound() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        mvc.perform(get(PRODUCTS + "/999999999").with(seller.token()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"));
        String beads = beadsProduct(category(), "Muncuqlu bilərzik");
        long productId = createProduct(seller, beads);
        mvc.perform(delete(PRODUCTS + "/" + productId).with(seller.token())).andExpect(status().isNoContent());
        mvc.perform(get(PRODUCTS + "/" + productId).with(seller.token())).andExpect(status().isNotFound());
        mvc.perform(json(put(PRODUCTS + "/" + productId), beads).with(seller.token())).andExpect(status().isNotFound());
        mvc.perform(delete(PRODUCTS + "/" + productId).with(seller.token())).andExpect(status().isNotFound());
        mvc.perform(json(patch(PRODUCTS + "/" + productId + "/status"), "{\"status\": \"IN_REVIEW\"}")
                .with(seller.token())).andExpect(status().isNotFound());
        mvc.perform(get(PRODUCTS).with(seller.token())).andExpect(jsonPath("$.length()").value(0));
        assertThat(jdbc.queryForObject("SELECT status FROM products WHERE id = ? AND deleted_at IS NOT NULL",
                String.class, productId)).isEqualTo("INACTIVE");
    }

    @Test
    void theSellerMovesAProductThroughItsStatuses() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long productId = createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "700.00"));
        String status = PRODUCTS + "/" + productId + "/status";

        expectStatus(seller, status, "IN_REVIEW", 409, "merchant.images_required");
        attachPng(seller, productId);
        expectStatus(seller, status, "APPROVED", 409, "merchant.status_transition");
        expectStatus(seller, status, "INACTIVE", 409, "merchant.status_transition");
        expectStatus(seller, status, "IN_REVIEW", 200, null);
        expectStatus(seller, status, "DRAFT", 200, null);
        expectStatus(seller, status, "IN_REVIEW", 200, null);

        // The admin approves (#40); the seller hides it and shows it again.
        jdbc.update("UPDATE products SET status = 'APPROVED', published_at = now() WHERE id = ?", productId);
        expectStatus(seller, status, "INACTIVE", 200, null);
        mvc.perform(get(PRODUCTS + "/" + productId).with(seller.token()))
                .andExpect(jsonPath("$.hiddenBySeller").value(true));
        expectStatus(seller, status, "APPROVED", 200, null);
        mvc.perform(get(PRODUCTS + "/" + productId).with(seller.token()))
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.hiddenBySeller").value(false));
        expectStatus(seller, status, "RETURNED", 409, "merchant.status_transition");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM audit_logs WHERE action = 'PRODUCT_STATUS_CHANGED' AND target_id = ?
                """, Integer.class, String.valueOf(productId))).isEqualTo(5);
    }

    @Test
    void anUnverifiedSellerCannotSendProductsToReview() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long productId = createProduct(seller, goldProduct(category(), fineness(Metal.GOLD), "700.00"));
        attachPng(seller, productId);
        expectStatus(seller, PRODUCTS + "/" + productId + "/status", "IN_REVIEW", 409, "merchant.seller_not_verified");
    }

    @Test
    void changingWhatIsSoldSendsAnApprovedProductBackToReview() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        long categoryId = category();
        long finenessId = fineness(Metal.GOLD);
        String product = goldProduct(categoryId, finenessId, "800.00");
        long productId = createProduct(seller, product);
        attachPng(seller, productId);
        long variantId = jdbc.queryForObject("SELECT id FROM product_variants WHERE product_id = ?", Long.class,
                productId);
        jdbc.update("UPDATE products SET status = 'APPROVED', published_at = now() WHERE id = ?", productId);

        // Price and stock only: still listed, the new price is in the history.
        mvc.perform(json(put(PRODUCTS + "/" + productId + "/variants/" + variantId), """
                        {"finenessId": %d, "weightGrams": "3.25", "size": "17", "pricingMode": "FIXED",
                         "price": "850.00", "stockStatus": "OUT_OF_STOCK"}
                        """.formatted(finenessId)).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.price.amount").value("850.00"));
        mvc.perform(get(PRODUCTS + "/" + productId).with(seller.token()))
                .andExpect(jsonPath("$.status").value("APPROVED"));
        assertThat(jdbc.queryForObject(
                "SELECT previous_price FROM price_history WHERE variant_id = ? AND price = 850.00", BigDecimal.class,
                variantId)).isEqualByComparingTo("800.00");

        // A new name: back to review.
        String renamed = product.replace("Qızıl üzük", "Qızıl nişan üzüyü")
                .replace("\"variants\": [{", "\"variants\": [{\"id\": " + variantId + ", ");
        mvc.perform(json(put(PRODUCTS + "/" + productId), renamed).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_REVIEW"))
                .andExpect(jsonPath("$.name.az").value("Qızıl nişan üzüyü"))
                .andExpect(jsonPath("$.variants[0].id").value((int) variantId));

        // The material kind is fixed at creation.
        mvc.perform(json(put(PRODUCTS + "/" + productId), beadsProduct(categoryId, "Muncuq")).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.material_kind_locked"));
        // A listed product keeps its last variant.
        mvc.perform(delete(PRODUCTS + "/" + productId + "/variants/" + variantId).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.last_variant"));
    }

    @Test
    void skusAreUniqueWithinTheStore() throws Exception {
        Seller seller = seller(SellerKind.FASHION, false);
        long categoryId = category();
        String withSku = beadsProduct(categoryId, "Muncuq").replace("\"price\"", "\"sku\": \"BEAD-1\", \"price\"");
        long productId = createProduct(seller, withSku);
        mvc.perform(json(post(PRODUCTS), withSku).with(seller.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("merchant.sku_taken"))
                .andExpect(jsonPath("$.errors[0].field").value("variants[0].sku"));
        String twice = withSku.replace("\"variants\": [", "\"variants\": [{\"sku\": \"BEAD-1\", \"price\": \"5.00\","
                + " \"stockStatus\": \"IN_STOCK\"}, ");
        expectInvalid(seller, twice.replace("BEAD-1", "BEAD-2"), "merchant.duplicate_sku", "variants[1].sku");
        mvc.perform(json(post(PRODUCTS + "/" + productId + "/variants"),
                        "{\"sku\": \"BEAD-2\", \"price\": \"30.00\", \"stockStatus\": \"IN_STOCK\"}")
                        .with(seller.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sku").value("BEAD-2"));
        // Another store may use the same SKU.
        createProduct(seller(SellerKind.FASHION, false), withSku);
    }

    private void expectInvalid(Seller seller, String body, String code, String field) throws Exception {
        mvc.perform(json(post(PRODUCTS), body).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.errors[0].field").value(field));
    }

    private void expectStatus(Seller seller, String url, String target, int httpStatus, String code) throws Exception {
        var result = mvc.perform(json(patch(url), "{\"status\": \"" + target + "\"}").with(seller.token()))
                .andExpect(status().is(httpStatus));
        if (code != null) {
            result.andExpect(jsonPath("$.code").value(code));
        } else {
            result.andExpect(jsonPath("$.status").value(target));
        }
    }
}
