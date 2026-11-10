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
            // Fineness with a metal code or "proba" in one word (#128 review).
            "S925 sırğa                       | s925",
            "Ag925 üzük                       | ag925",
            "AU750 boyunbağı                  | au750",
            "PT950 üzük                       | pt950",
            "Pd500 sırğa                      | pd500",
            "925proba üzük                    | 925proba",
            "Ring 925s                        | 925s",
            "Кольцо 585 пробы                 | 585",
            "585-ci əyar                      | 585",
            // Karats in one word or as a number and a karat word.
            "Ring 18kt                        | 18kt",
            "Серьги 14к                       | 14к",
            "14 karat üzük                    | 14 karat",
            "18 əyar                          | 18 eyar",
            "22-ayar bilezik                  | 22 ayar",
            "18 carat ring                    | 18 carat",
            "Кольцо 24 карата                 | 24 карата",
            // Metal and stone words in more languages.
            "Sterling sırğa                   | sterling",
            "altın yüzük                      | altin",
            "Pırlanta yüzük                   | pirlanta",
            "Elmas küpe                       | elmas",
            "Zoloto kolco                     | zoloto",
            "Serebro 925                      | serebro",
            "Brillant Ohrring                 | brillant",
            "Золотое кольцо                   | золотое",
            "925 gümüş                        | 925",
            "Gümüş 925 sırğa                  | gumus",
    })
    void preciousClaimsAreFound(String text, String claim) {        assertThat(FashionClaims.find(text)).contains(claim);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Muncuqlu bilərzik", "Gümüş suyu ilə üzük", "Qızıl suyuna salınmış sırğa", "Gold plated hoops",
            "Silver tone chain", "Позолоченные серьги", "Посеребренный браслет", "Dəri bilərzik, əl işi",
            "Polad üzük 316L", "Ölçü 17", "",
            // Plating and colour phrases stay allowed in every language (#128 review).
            "Qızıl suyu çəkilmiş sırğa", "Qızıl örtüklü bilərzik", "gold-plated ring", "Gold tone hoops",
            "Silver coloured chain", "Altın kaplama küpe", "Gümüş kaplamalı yüzük", "Позолоченное кольцо",
            "Позолота, бижутерия", "Золотое покрытие", "Серьги золотистого цвета", "Серебристый браслет",
            "Zolotistyi braslet",
            // Numbers that are not hallmarks or karats, and words that only start like "altın".
            "1 carat zirkon", "Uzunluq 45 sm", "Ölçü 18", "Daşın altında naxış", "Model 2025", "Çəki 3 qram"})
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
