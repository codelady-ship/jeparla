package az.jeparla.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.product.Metal;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Audit details JSON (#40) and the translations of the new error codes. No database. */
class AuditDetailsTests {

    @Test
    void valuesTypedByPeopleCannotBreakTheJson() {
        String json = AuditDetails.of("term", "a\"b\\c\nd\u0001", "value", 585, "active", true, "metal", Metal.GOLD,
                "parentId", null);
        JsonNode node = JsonMapper.builder().build().readTree(json);
        assertThat(node.get("term").asString()).isEqualTo("a\"b\\c\nd\u0001");
        assertThat(node.get("value").asInt()).isEqualTo(585);
        assertThat(node.get("active").asBoolean()).isTrue();
        assertThat(node.get("metal").asString()).isEqualTo("GOLD");
        assertThat(node.get("parentId").isNull()).isTrue();
        assertThat(AuditDetails.of()).isEqualTo("{}");
        assertThatThrownBy(() -> AuditDetails.of("lonely")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theNewErrorCodesAreTranslated() throws IOException {
        List<String> codes = List.of("admin.slug_taken", "admin.parent_missing", "admin.category_cycle",
                "admin.category_in_use", "admin.fineness_exists", "admin.fineness_in_use", "admin.synonym_invalid",
                "admin.synonym_exists", "admin.self", "admin.last_admin", "admin.role_not_assignable",
                "admin.user_owns_store", "admin.report_closed", "favorites.limit");
        for (String file : List.of("messages.properties", "messages_en.properties", "messages_ru.properties")) {
            Properties properties = new Properties();
            try (InputStream in = getClass().getClassLoader().getResourceAsStream(file)) {
                properties.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            }
            for (String code : codes) {
                assertThat(properties.getProperty("error." + code)).as(file + ": " + code).isNotBlank();
            }
        }
    }
}
