package az.jeparla.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CatalogApiTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Search by photo (#163) without an embedding model (the default): anonymous access, an honest 503 and the
 * table V43; the photo is never stored.
 */
@CatalogApiTest
class ImageSearchApiTests {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13, 'I', 'H',
            'D', 'R', 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, (byte) 0xc4, (byte) 0x89};

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void withoutAModelTheStatusSaysSoAndASearchIs503() throws Exception {
        mvc.perform(get("/api/v1/search/image/status")).andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.maxBytes").value(ImageSearchService.MAX_BYTES));
        mvc.perform(multipart("/api/v1/search/image").file(new MockMultipartFile("image", "a.png", "image/png", PNG)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("search.image_not_configured"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_image_embeddings", Long.class)).isZero();
    }
}
