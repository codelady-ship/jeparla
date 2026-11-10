package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.error.ApiException;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

/** Plain rules of the merchant API: forbidden claims of bijouterie (#128, #157), slugs, Idempotency-Key. */
class MerchantHelpersTests {

    /** Text and the phrase the error names, as the seller wrote it. */
    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Qızıl üzük                       | Qızıl",
            "qızıl sırğa                      | qızıl",
            "Brilyantlı boyunbağı             | Brilyantlı",
            "Gümüş bilərzik                   | Gümüş",
            "Ring 14K gold                    | 14K",
            "Gold sırğa                       | Gold",
            "White gold ring                  | gold",
            "Diamond look ring                | Diamond",
            "Кольцо из золота                 | золота",
            "Серебряный браслет               | Серебряный",
            "Платиновое кольцо                | Платиновое",
            "Колье с бриллиантами             | бриллиантами",
            // Fineness with a metal code or "proba" in one word (#128 review).
            "S925 sırğa                       | S925",
            "Ag925 üzük                       | Ag925",
            "AU750 boyunbağı                  | AU750",
            "PT950 üzük                       | PT950",
            "Pd500 sırğa                      | Pd500",
            "925proba üzük                    | 925proba",
            "Ring 925s                        | 925s",
            // A separate fineness number next to a metal word, a fineness word or a metal code (#157).
            "Кольцо 585 пробы                 | 585 пробы",
            "585-ci əyar                      | 585-ci əyar",
            "Üzük, 925-lik gümüş              | 925-lik gümüş",
            "Əyar: 585                        | Əyar: 585",
            "Proba 750, üzük                  | Proba 750",
            "Au 585 sırğa                     | Au 585",
            "S 925 üzük                       | S 925",
            "925 gümüş                        | 925 gümüş",
            "Sırğa 750 qızıl                  | 750 qızıl",
            "Rose gold 585                    | gold 585",
            // ... or next to a jewellery word, without a unit after it or a size label before it.
            "Üzük 585                         | Üzük 585",
            "585 sırğa                        | 585 sırğa",
            "кольцо 585                       | кольцо 585",
            "Boyunbağı 925, əl işi            | Boyunbağı 925",
            "Dəst 750                         | Dəst 750",
            "Qolbaq 333                       | Qolbaq 333",
            "Серьги 625                       | Серьги 625",
            "Цепь 500                         | Цепь 500",
            "Earrings 925                     | Earrings 925",
            "Kulon 958, broş                  | Kulon 958",
            // Karats in one word or as a number and a karat word.
            "Ring 18kt                        | 18kt",
            "Серьги 14к                       | 14к",
            "14 karat üzük                    | 14 karat",
            "18 əyar                          | 18 əyar",
            "22-ayar bilezik                  | 22-ayar",
            "18 carat ring                    | 18 carat",
            "Кольцо 24 карата                 | 24 карата",
            // Metal and stone words in more languages.
            "Sterling sırğa                   | Sterling",
            "altın yüzük                      | altın",
            "altın kolye                      | altın",
            "Altınlı bilezik                  | Altınlı",
            "Pırlanta yüzük                   | Pırlanta",
            "Zoloto kolco                     | Zoloto",
            "Serebro 925                      | Serebro",
            "Brillant Ohrring                 | Brillant",
            "Золотое кольцо                   | Золотое",
            "Gümüş 925 sırğa                  | Gümüş",
            "Qızıl balıqlı qızıl üzük         | qızıl",
            // Names and plain words in a material context (#157): a jewellery or stone word after them, or a
            // karat word near them; their inflected forms always.
            "Elmas küpe                       | Elmas",
            "Almaz üzük                       | Almaz",
            "Almaz daşlı sırğa                | Almaz",
            "Sırğa, 0.5 karat almaz           | almaz",
            "Brilliant ring                   | Brilliant",
            "Almazlı üzük                     | Almazlı",
            "Elmaslı kolye                    | Elmaslı",
            "Кольцо с алмазом                 | алмазом",
            "Kolco s brilliantom              | brilliantom",
            // #162: karats written with "ct", fine gold, "diamond cut" of anything but a zircon or a chain.
            "18ct                             | 18ct",
            "18 ct                            | 18 ct",
            "Üzük 18ct                        | 18ct",
            "Ring 14K gold                    | 14K",
            "999.9                            | 999.9",
            "Külçə 999,9                      | 999,9",
            "Diamond cut                      | Diamond",
            "Diamond cut ring                 | Diamond",
            // #162: the quoted phrase keeps its brackets balanced.
            "Üzük (585)                       | Üzük (585)",
            "(Üzük) 585                       | (Üzük) 585",
            "Sırğa [925]                      | Sırğa [925]",
            "«Üzük 585»                       | Üzük 585",
    })
    void preciousClaimsAreFound(String text, String claim) {
        assertThat(FashionClaims.find(text)).contains(claim.strip());
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
            "Zolotistyi braslet", "zolotistıy braslet", "serebristıy üzük", "Qızılı rəngli sırğa",
            "rose gold rəngli",
            // Numbers that are not hallmarks or karats, and words that only start like "altın".
            "1 carat zirkon", "Uzunluq 45 sm", "Ölçü 18", "Daşın altında naxış", "Model 2025", "Çəki 3 qram",
            "Boyunbağının altında qıfıl var",
            // Colour names, compound words and plain words (#157).
            "Rose gold sırğa", "rose gold üzük, paslanmayan polad", "Golden sırğa", "Qızılgül formalı sırğa",
            "Qızıl gül formalı broş", "Qızıl balıq kulonu", "Qızılbaş naxışı", "Qızılı sırğa", "QIZILI sırğa",
            "Gümüşü sırğa", "Gümüşü-boz rəng", "goldfish kulon", "Platinum blond rəngli", "Brilliant parıltı",
            "Golden necklace",
            // Names: "Almaz" and "Elmas" are women's names and collection names; "altın" is "the lower part of".
            "Almaz xanım kolleksiyası", "Elmas kolleksiyası", "Almaz kolleksiyasından sırğa", "Kulonun altın hissəsi",
            // Sizes and model numbers.
            "Zəncir uzunluğu 500 mm", "Uzunluq 375 mm", "750 ml", "Model 800", "Çəkisi 925 qram deyil, 9 qram",
            "Zəncir 500 mm", "Sırğa, model 750", "Üzük art. 585", "Boyunbağı 500 sm", "Dəst, 750 q",
            "Цепь длина 500 мм", "Серьги, 750 шт в наличии", "Ring 500 g",
            // Plain sentences from bijouterie listings.
            "Paslanmayan poladdan sırğa, allergiya yaratmır, uzunluğu 3 sm",
            "Əl işi muncuqlu boyunbağı, zəncir uzunluğu 500 mm, qızılı rəngdə",
            "Sirkon daşlı üzük, gümüşü rəng, ölçüsü tənzimlənir",
            "Tibbi poladdan bilərzik, rəngi solmur, suya davamlıdır",
            "Серьги из медицинской стали с позолотой, длина 4 см",
            "Колье с фианитами, длина цепочки 45 см, цвет золотистый",
            "Браслет из натуральных камней ручной работы",
            "Кольцо безразмерное, серебристого цвета",
            // Prices (#162): a number followed by a currency is never a fineness.
            "Sırğa 900 manat", "Kolye 750 AZN", "Üzük 500 ₼", "Üzük 585₼", "Qolbaq: 800 AZN endirimlə",
            "Серьги 500 руб", "Кольцо 750 рублей", "Bracelet 925 USD", "Kolye 750 $",
            // A stone weight and a karat mark of a plating (#162).
            "0.5 ct zirkon", "18ct gold plated", "14K gold plated hoops", "18 ct gold plated",
            // "Diamond cut" of a zircon or a chain (#162, decision in FashionClaims).
            "Diamond cut zirkon", "Diamond-cut zəncir", "diamond cut chain", "Diamond cut CZ sırğa",
            "Diamond cut цепочка"})
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
