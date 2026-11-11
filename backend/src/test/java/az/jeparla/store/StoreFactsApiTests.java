package az.jeparla.store;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Category;
import az.jeparla.product.Fineness;
import az.jeparla.product.Metal;
import az.jeparla.product.Product;
import az.jeparla.support.CatalogApiTest;
import az.jeparla.support.TestData;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Trust facts (#108) and link preview (#100) of a public store, on the demo seed. Every number is checked against
 * data the test made, so a fact can only come from the database.
 */
@CatalogApiTest
class StoreFactsApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private TestData data;

    @Autowired
    private EntityManager em;

    @Autowired
    private JdbcTemplate jdbc;

    /** Months between the approval of TestData.approvedStore (2026-09-01 Baku) and today. */
    private static long monthsSinceApproval() {
        return ChronoUnit.MONTHS.between(LocalDate.of(2026, 9, 1), LocalDate.now(ZoneId.of("Asia/Baku")));
    }

    @Test
    void factsAreCountedFromTheListedProducts() throws Exception {
        Store store = data.approvedStore(data.merchant());
        Category category = data.category();
        Fineness fineness = data.fineness(Metal.GOLD);
        Product certified = data.publicProduct(store, category, fineness, "300.00");
        Product metalLinked = data.publicProduct(store, category, fineness, "400.00");
        data.publicProduct(store, category, fineness, "500.00");
        Product draft = data.product(store, category, fineness, "600.00");
        em.flush();
        jdbc.update("UPDATE products SET expertise_status = 'VERIFIED' WHERE id IN (?, ?)", certified.getId(),
                draft.getId());
        jdbc.update("UPDATE product_variants SET pricing_mode = 'METAL_LINKED' WHERE product_id IN (?, ?)",
                metalLinked.getId(), draft.getId());
        jdbc.update("UPDATE products SET updated_at = TIMESTAMPTZ '2026-10-20 12:00:00+04' WHERE store_id = ?",
                store.getId());
        jdbc.update("UPDATE products SET updated_at = TIMESTAMPTZ '2026-11-05 09:30:00+04' WHERE id = ?",
                metalLinked.getId());
        jdbc.update("UPDATE products SET updated_at = TIMESTAMPTZ '2026-11-09 09:30:00+04' WHERE id = ?",
                draft.getId());

        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/facts"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", Matchers.containsString("s-maxage=300")))
                .andExpect(jsonPath("$.onJeparlaSince").value("2026-09-01T05:00:00Z"))
                .andExpect(jsonPath("$.monthsOnJeparla").value((int) monthsSinceApproval()))
                .andExpect(jsonPath("$.activeProducts").value(3))
                .andExpect(jsonPath("$.catalogUpdatedAt").value("2026-11-05T05:30:00Z"))
                .andExpect(jsonPath("$.verifiedExpertise.count").value(1))
                .andExpect(jsonPath("$.verifiedExpertise.percent").value(33))
                .andExpect(jsonPath("$.metalLinkedPrice.count").value(1))
                .andExpect(jsonPath("$.metalLinkedPrice.percent").value(33))
                .andExpect(jsonPath("$.hallmarkPhoto").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.documents.taxId").value(false))
                .andExpect(jsonPath("$.documents.tradeLicense").value(false))
                .andExpect(jsonPath("$.rating").doesNotExist())
                .andExpect(jsonPath("$.whatsappResponseTime").doesNotExist());
    }

    @Test
    void documentsAreVerifiedOnlyByAnApprovedDocumentOfThatKind() throws Exception {
        Store store = data.approvedStore(data.merchant());
        em.flush();
        String insert = """
                INSERT INTO verification_documents (store_id, check_kind, kind, storage_key, file_name, content_type,
                                                    size_bytes, status)
                VALUES (?, 'DOCUMENTS', ?, ?, 'doc.pdf', 'application/pdf', 1000, ?)
                """;
        jdbc.update(insert, store.getId(), "TAX_ID", "documents/t/" + TestData.next() + ".pdf", "VERIFIED");
        jdbc.update(insert, store.getId(), "TRADE_LICENSE", "documents/t/" + TestData.next() + ".pdf", "PENDING");
        jdbc.update(insert, store.getId(), "TRADE_LICENSE", "documents/t/" + TestData.next() + ".pdf", "REJECTED");

        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/facts"))
                .andExpect(jsonPath("$.documents.taxId").value(true))
                .andExpect(jsonPath("$.documents.tradeLicense").value(false));
    }

    @Test
    void aStoreWithoutProductsHasNoSharesAndNoUpdateDate() throws Exception {
        Store store = data.approvedStore(data.merchant());
        em.flush();

        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/facts"))
                .andExpect(jsonPath("$.activeProducts").value(0))
                .andExpect(jsonPath("$.catalogUpdatedAt").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.verifiedExpertise.count").value(0))
                .andExpect(jsonPath("$.verifiedExpertise.percent").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.metalLinkedPrice.percent").value(Matchers.nullValue()));
        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/preview"))
                .andExpect(jsonPath("$.productCount").value(0))
                .andExpect(jsonPath("$.coverImageUrl").value(Matchers.nullValue()));
    }

    @Test
    void anUnknownApprovalDateIsNullNotZero() throws Exception {
        Store store = data.approvedStore(data.merchant());
        em.flush();
        jdbc.update("UPDATE stores SET approved_at = NULL WHERE id = ?", store.getId());

        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/facts"))
                .andExpect(jsonPath("$.onJeparlaSince").value(Matchers.nullValue()))
                .andExpect(jsonPath("$.monthsOnJeparla").value(Matchers.nullValue()));
    }

    @Test
    void aFashionStoreHasNoDocumentsFact() throws Exception {
        Store store = data.approvedStore(data.merchant());
        em.flush();
        jdbc.update("UPDATE stores SET seller_kind = 'FASHION' WHERE id = ?", store.getId());

        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/facts"))
                .andExpect(jsonPath("$.documents").value(Matchers.nullValue()));
    }

    @Test
    void theDemoStoreFactsMatchItsStorePage() throws Exception {
        mvc.perform(get("/api/v1/stores/ayzer-zerger/facts"))
                .andExpect(jsonPath("$.activeProducts").value(10))
                .andExpect(jsonPath("$.onJeparlaSince").value("2026-09-01T05:00:00Z"));
        mvc.perform(get("/api/v1/stores/ayzer-zerger/preview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("ayzer-zerger"))
                .andExpect(jsonPath("$.name").value("Ayzər Zərgər"))
                .andExpect(jsonPath("$.city").value("Bakı"))
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.productCount").value(10))
                .andExpect(jsonPath("$.coverImageUrl").value(Matchers.startsWith("/demo/")))
                .andExpect(jsonPath("$.shareCode").doesNotExist());
    }

    @Test
    void theCoverIsTheFirstPhotoOfTheNewestListedProduct() throws Exception {
        Store store = data.approvedStore(data.merchant());
        Category category = data.category();
        Fineness fineness = data.fineness(Metal.GOLD);
        data.publicProduct(store, category, fineness, "300.00");
        Product newest = data.publicProduct(store, category, fineness, "400.00");
        em.flush();
        jdbc.update("UPDATE products SET published_at = published_at + INTERVAL '1 day' WHERE id = ?", newest.getId());
        String key = jdbc.queryForObject("SELECT storage_key FROM product_images WHERE product_id = ?", String.class,
                newest.getId());

        mvc.perform(get("/api/v1/stores/" + store.getSlug() + "/preview"))
                .andExpect(jsonPath("$.coverImageUrl").value("http://localhost:9000/jeparla-public/" + key))
                .andExpect(jsonPath("$.verified").value(false))
                .andExpect(jsonPath("$.verification.seller").value("NONE"))
                .andExpect(jsonPath("$.productCount").value(2));
    }

    @Test
    void hiddenStoresHaveNoFactsOrPreview() throws Exception {
        Store pending = data.store(data.merchant());
        em.flush();
        mvc.perform(get("/api/v1/stores/" + pending.getSlug() + "/facts")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/stores/" + pending.getSlug() + "/preview")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/share/" + pending.getShareCode())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/stores/no-such-store/facts")).andExpect(status().isNotFound());
    }

    @Test
    void demoStoresGetAShareCodeFromTheDatabase() throws Exception {
        String code = jdbc.queryForObject("SELECT share_code FROM stores WHERE slug = 'ayzer-zerger'", String.class);
        mvc.perform(get("/api/v1/share/" + code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("ayzer-zerger"));
    }
}
