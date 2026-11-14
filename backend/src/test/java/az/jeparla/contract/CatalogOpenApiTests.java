package az.jeparla.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Swagger documents the public catalog with the frontend type names (frontend/src/types/api.ts). */
@CatalogApiTest
class CatalogOpenApiTests {

    @Autowired
    private MockMvc mvc;

    @Test
    void theCatalogIsDocumented() throws Exception {
        JsonNode doc = JsonMapper.builder().build().readTree(mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));

        assertThat(doc.get("paths").propertyNames()).contains(
                "/api/v1/products", "/api/v1/products/{slug}", "/api/v1/variants", "/api/v1/products/{id}/reports",
                "/api/v1/products/{id}/contact-click", "/api/v1/categories", "/api/v1/finenesses", "/api/v1/stores",
                "/api/v1/stores/{slug}", "/api/v1/stores/{slug}/products", "/api/v1/metal-prices/latest",
                "/api/v1/metal-prices/history", "/api/v1/search", "/api/v1/search/suggest");
        assertThat(doc.get("components").get("schemas").propertyNames()).contains(
                "ProductSummary", "Product", "Variant", "Stone", "ProductImage", "PricingRule", "Fineness",
                "Category", "StoreSummary", "Store", "Verification", "CompareItem", "MetalPrice", "LocalizedText",
                "Money", "SearchResult", "Suggestions", "StoreSuggestion", "CategorySuggestion", "ProductSuggestion");

        JsonNode list = doc.get("paths").get("/api/v1/products").get("get");
        assertThat(list.get("parameters").findValuesAsString("name")).contains("q", "category", "store", "kind",
                "metal",
                "fineness", "minWeight", "maxWeight", "minPrice", "maxPrice", "verified", "inStock", "city", "shape",
                "minCarat", "maxCarat", "color", "clarity", "sort", "page", "size");
        JsonNode search = doc.get("paths").get("/api/v1/search").get("get");
        assertThat(search.get("parameters").findValuesAsString("name")).containsExactlyInAnyOrder("q", "type", "page",
                "size");
        assertThat(search.get("responses").propertyNames()).contains("200", "400", "429");
        JsonNode money =doc.get("components").get("schemas").get("Money").get("properties");
        assertThat(money.get("amount").get("type").stringValue()).isEqualTo("string");
    }
}
