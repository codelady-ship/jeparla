package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.error.ApiException;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

/** Plain rules of the merchant API: forbidden claims of bijouterie (#128), slugs, Idempotency-Key. */
class MerchantHelpersTests {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Qızıl üzük                       | qizil",
            "QIZILI sırğa                     | qizili",
            "Brilyantlı boyunbağı             | brilyantli",
            "Gümüş bilərzik                   | gumus",
            "Üzük 585                         | 585",
            "Ring 14K gold                    | 14k",
            "Golden necklace                  | golden",
            "Diamond look ring                | diamond",
            "Кольцо из золота                 | золота",
            "Серебряный браслет               | серебряный",
            "Платиновое кольцо                | платиновое",
            "Колье с бриллиантами             | бриллиантами",
    })
    void preciousClaimsAreFound(String text, String claim) {
        assertThat(FashionClaims.find(text)).contains(claim);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Muncuqlu bilərzik", "Gümüş suyu ilə üzük", "Qızıl suyuna salınmış sırğa", "Gold plated hoops",
            "Silver tone chain", "Позолоченные серьги", "Посеребренный браслет", "Dəri bilərzik, əl işi",
            "Polad üzük 316L", "Ölçü 17", ""})
    void honestFashionTextsPass(String text) {
        assertThat(FashionClaims.find(text)).isEmpty();
    }

    @Test
    void slugsAreLatinLowercaseWords() {
        assertThat(Slugs.of("Ayzər Zərgər", 100, "store")).isEqualTo("ayzer-zerger");
        assertThat(Slugs.of("  Şəki — İpək & Gümüş!! ", 100, "store")).isEqualTo("seki-ipek-gumus");
        assertThat(Slugs.of("Жемчуг Хазара", 100, "store")).isEqualTo("zhemchug-khazara");
        assertThat(Slugs.of("!!!", 100, "store")).isEqualTo("store");
        assertThat(Slugs.of("abc def ghi", 6, "x")).isEqualTo("abc-de");
        assertThat(Slugs.of("abc def", 4, "x")).isEqualTo("abc");
        assertThat(Slugs.withSuffix("ring", 6)).matches("ring-[a-z2-9]{6}");
    }

    @Test
    void idempotencyKeyIsAnOptionalCanonicalUuid() {
        UUID key = UUID.randomUUID();
        assertThat(IdempotencyKeys.parse(key.toString())).isEqualTo(key);
        assertThat(IdempotencyKeys.parse(" " + key.toString().toUpperCase() + " ")).isEqualTo(key);
        assertThat(IdempotencyKeys.parse(null)).isNull();
        assertThat(IdempotencyKeys.parse("")).isNull();
        for (String bad : new String[] {"123", "1-1-1-1-1", "not-a-uuid", key + "x"}) {
            assertThatThrownBy(() -> IdempotencyKeys.parse(bad)).isInstanceOfSatisfying(ApiException.class,
                    e -> assertThat(e.code()).isEqualTo("merchant.idempotency_key"));
        }
    }
}
