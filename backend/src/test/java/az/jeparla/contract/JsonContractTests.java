package az.jeparla.contract;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The comparator of the contract test must catch every kind of difference. */
class JsonContractTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static JsonNode json(String text) {
        return JSON.readTree(text.replace('\'', '"'));
    }

    private static int differences(String mock, String backend) {
        return JsonContract.differences(json(mock), json(backend), true, path -> false).size();
    }

    @Test
    void equalDocumentsMatch() {
        assertThat(differences("{'a': [1, {'b': 'x'}], 'c': null}", "{'c': null, 'a': [1, {'b': 'x'}]}")).isZero();
    }

    @Test
    void decimalsAreComparedAsNumbersAndTimesAsInstants() {
        assertThat(differences("{'carat': '0.10', 'at': '2026-11-03T10:05:00+04:00'}",
                "{'carat': '0.100', 'at': '2026-11-03T06:05:00Z'}")).isZero();
        assertThat(differences("{'carat': '0.10'}", "{'carat': '0.11'}")).isOne();
        assertThat(differences("{'at': '2026-11-03T10:05:00+04:00'}", "{'at': '2026-11-03T10:05:00Z'}")).isOne();
    }

    @Test
    void missingAndExtraKeysAreReported() {
        assertThat(differences("{'a': 1, 'b': 2}", "{'a': 1}")).isOne();
        assertThat(differences("{'a': 1}", "{'a': 1, 'b': 2}")).isOne();
    }

    @Test
    void jsonTypesMustMatch() {
        assertThat(differences("{'amount': '12.50'}", "{'amount': 12.50}")).isOne();
        assertThat(differences("{'parentId': null}", "{'parentId': 1}")).isOne();
        assertThat(differences("{'x': []}", "{'x': {}}")).isOne();
    }

    @Test
    void arraysMustHaveTheSameLengthAndOrder() {
        assertThat(differences("[1, 2]", "[2, 1]")).isEqualTo(2);
        assertThat(differences("[1, 2]", "[1]")).isOne();
    }

    @Test
    void shapeOnlyIgnoresValuesAndLengthsButNotKeys() {
        assertThat(JsonContract.differences(json("[{'a': '1'}, {'a': '2'}]"), json("[{'a': '9'}]"), false,
                path -> false)).isEmpty();
        assertThat(JsonContract.differences(json("[{'a': '1'}]"), json("[{'b': '1'}]"), false, path -> false))
                .hasSize(1);
    }

    @Test
    void ignoredPathsSkipOnlyTheValue() {
        assertThat(JsonContract.differences(json("{'v': {'documents': 'PENDING'}}"),
                json("{'v': {'documents': 'VERIFIED'}}"), true, path -> path.equals("$.v.documents"))).isEmpty();
        assertThat(JsonContract.differences(json("{'v': {'documents': 'PENDING'}}"), json("{'v': {'documents': null}}"),
                true, path -> path.equals("$.v.documents"))).hasSize(1);
    }
}
