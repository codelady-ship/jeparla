package az.jeparla.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import az.jeparla.support.CatalogApiTest;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Contract between this API and the frontend (#37, #41): for every case in
 * {@code contract/catalog-cases.json} the backend gets the exact request that
 * frontend/src/lib/api/http.ts sends, and must answer, on the demo seed, with the JSON the frontend
 * mock (frontend/src/lib/api/mock) returns for the same call: same keys, same JSON types, same
 * values (see {@link JsonContract}). Then #41 can switch from the mock to the API by changing only
 * the client.
 *
 * <p>The cases are generated from the frontend code by {@code contract/generate.mjs} (run it from
 * the repository root after changing frontend/src/types/api.ts, the mock or the demo data, and
 * commit the JSON).
 *
 * <p>Known, deliberate value differences (the shape is still compared):
 * <ul>
 *   <li>{@code verification.documents} of a product: the mock marks every fourth product PENDING on
 *       its own, but in the data model the documents check belongs to the store (PLAN 5.9), so the API
 *       reports the store's status. Store-level verification is compared.</li>
 *   <li>Metal price history: the demo seed stores only the latest day (the mock's 30-day wave uses
 *       {@code Math.sin}), so only the shape is compared.</li>
 * </ul>
 */
@CatalogApiTest
class CatalogContractTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Pattern STORE_ENDPOINT = Pattern.compile("^/api/v1/stores(/[^/?]+)?(\\?.*)?$");

    @Autowired
    private MockMvc mvc;

    static Stream<Arguments> cases() throws IOException {
        JsonNode root;
        try (InputStream in = new ClassPathResource("contract/catalog-cases.json").getInputStream()) {
            root = JSON.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
        List<Arguments> cases = new ArrayList<>();
        for (JsonNode c : root.get("cases")) {
            cases.add(Arguments.of(c.get("name").stringValue(), c.get("request").stringValue(), c.get("status").intValue(),
                    "values".equals(c.get("compare").stringValue()), c.get("mock")));
        }
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}: GET {1}")
    @MethodSource("cases")
    void backendAnswersLikeTheFrontendMock(String name, String request, int status, boolean values, JsonNode mock)
            throws Exception {
        MockHttpServletResponse response = mvc.perform(get(URI.create(request)).accept(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();

        assertThat(response.getStatus()).as("status of GET " + request).isEqualTo(status);
        if (status != 200) {
            return;
        }
        assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        JsonNode actual = JSON.readTree(response.getContentAsString(StandardCharsets.UTF_8));
        List<String> differences = JsonContract.differences(mock, actual, values, ignoredValues(request));
        assertThat(differences).as("differences from the frontend mock for GET " + request).isEmpty();
    }

    @org.junit.jupiter.api.Test
    void everyFrontendEndpointOfThisIssueHasACase() throws IOException {
        List<String> requests = cases().map(a -> (String) a.get()[1]).toList();
        assertThat(requests).anyMatch(r -> r.startsWith("/api/v1/products?"))
                .anyMatch(r -> r.startsWith("/api/v1/products?ids="))
                .anyMatch(r -> r.startsWith("/api/v1/variants?ids="))
                .anyMatch(r -> r.matches("/api/v1/products/[a-z0-9-]+"))
                .anyMatch(r -> r.equals("/api/v1/categories"))
                .anyMatch(r -> r.equals("/api/v1/finenesses"))
                .anyMatch(r -> r.startsWith("/api/v1/stores"))
                .anyMatch(r -> r.matches("/api/v1/stores/[a-z0-9-]+"))
                .anyMatch(r -> r.matches("/api/v1/stores/[a-z0-9-]+/products.*"))
                .anyMatch(r -> r.equals("/api/v1/metal-prices/latest"))
                .anyMatch(r -> r.startsWith("/api/v1/metal-prices/history"));
    }

    /** Product-level {@code verification.documents} differs on purpose (see the class comment). */
    private static Predicate<String> ignoredValues(String request) {
        if (STORE_ENDPOINT.matcher(request).matches()) {
            return path -> false;
        }
        return path -> path.endsWith(".verification.documents") && !path.endsWith(".store.verification.documents");
    }
}
