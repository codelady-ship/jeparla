package az.jeparla.store;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import az.jeparla.support.TestData;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/** {@code GET /api/v1/stores}, {@code /stores/{slug}} and {@code /stores/{slug}/products} on the demo seed. */
@CatalogApiTest
class StoreCatalogApiTests {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private TestData data;

    @Autowired
    private EntityManager em;

    @Test
    void listsApprovedStoresOldestFirstWithTheirProductCounts() throws Exception {
        Store pending = data.store(data.merchant());
        em.flush();

        mvc.perform(get("/api/v1/stores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[0].slug").value("ayzer-zerger"))
                .andExpect(jsonPath("$[*].productCount", everyItem(is(10))))
                .andExpect(jsonPath("$[5].verification.seller").value("PENDING"))
                .andExpect(jsonPath("$[5].verification.expertise").value("NONE"))
                .andExpect(jsonPath("$[0].logoUrl").isEmpty());
        mvc.perform(get("/api/v1/stores/" + pending.getSlug())).andExpect(status().isNotFound());
    }

    @Test
    void filtersByCityAndFoldedWords() throws Exception {
        mvc.perform(get("/api/v1/stores?city=Gəncə")).andExpect(jsonPath("$[*].slug").value("nergiz-gold"));
        mvc.perform(get("/api/v1/stores?q=NƏRGİZ")).andExpect(jsonPath("$[*].slug").value("nergiz-gold"));
        mvc.perform(get("/api/v1/stores?q=xezer inci")).andExpect(jsonPath("$[*].slug").value("xezer-inci"));
        mvc.perform(get("/api/v1/stores?q=zerger&city=Bakı")).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(get("/api/v1/stores?q=lənkəran")).andExpect(jsonPath("$[*].slug").value("yeni-ulduz"));
        mvc.perform(get("/api/v1/stores?q=nothing")).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/v1/stores?q=" + "a".repeat(101))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
    }

    @Test
    void storePageHasContactDetails() throws Exception {
        mvc.perform(get("/api/v1/stores/lale-atelye"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.whatsapp").value("+994500000002"))
                .andExpect(jsonPath("$.openingHours").value("Mo-Sa 10:00-20:00"))
                .andExpect(jsonPath("$.description.ru").value("Серебро ручной работы и минималистичный дизайн."))
                .andExpect(jsonPath("$.geo").isEmpty())
                .andExpect(jsonPath("$.productCount").value(10))
                .andExpect(jsonPath("$.createdAt").value("2026-09-01T05:00:00Z"));
        mvc.perform(get("/api/v1/stores/no-such-store")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"));
    }

    @Test
    void storeProductsUseTheCatalogFiltersInsideTheStore() throws Exception {
        mvc.perform(get("/api/v1/stores/lale-atelye/products?size=5&page=1&sort=newest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(10))
                .andExpect(jsonPath("$.content", hasSize(5)))
                .andExpect(jsonPath("$.content[*].store.slug", everyItem(is("lale-atelye"))));
        // The store of the path wins over a store parameter.
        mvc.perform(get("/api/v1/stores/lale-atelye/products?store=ayzer-zerger"))
                .andExpect(jsonPath("$.totalElements").value(10))
                .andExpect(jsonPath("$.content[*].store.slug", everyItem(is("lale-atelye"))));
        mvc.perform(get("/api/v1/stores/lale-atelye/products?metal=SILVER"))
                .andExpect(jsonPath("$.content[*].metal", everyItem(is("SILVER"))));
        mvc.perform(get("/api/v1/stores/lale-atelye/products?size=500")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/stores/no-such-store/products")).andExpect(status().isNotFound());
    }

    @Test
    void storeWithALogoGetsABucketUrl() throws Exception {
        Store store = data.approvedStore(data.merchant());
        store.setLogoKey("stores/" + TestData.next() + "/logo.webp");
        em.flush();
        mvc.perform(get("/api/v1/stores/" + store.getSlug()))
                .andExpect(jsonPath("$.logoUrl").value("http://localhost:9000/jeparla-public/" + store.getLogoKey()));
    }
}
