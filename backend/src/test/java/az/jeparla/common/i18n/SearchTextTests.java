package az.jeparla.common.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Same folding as jeparla_fold (V1) and frontend/src/lib/search/normalize.ts. */
class SearchTextTests {

    @Test
    void foldsAzerbaijaniLettersAndCase() {
        assertThat(SearchText.fold("Qızıl Üzük")).isEqualTo("qizil uzuk");
        assertThat(SearchText.fold("Sırğa, Şəbəkə; ÇÖĞ İnci")).isEqualTo("sirga sebeke cog inci");
        assertThat(SearchText.fold("Ёлка  — Кольцо")).isEqualTo("елка кольцо");
    }

    @Test
    void splitsAQueryIntoDistinctWords() {
        assertThat(SearchText.words("  Qızıl, qizil üzük! ", 8)).containsExactly("qizil", "uzuk");
        assertThat(SearchText.words("a b c d", 2)).containsExactly("a", "b");
        assertThat(SearchText.words(" ,;- ", 8)).isEmpty();
        assertThat(SearchText.words(null, 8)).isEmpty();
    }

    @Test
    void everyWordMustStartAWordOfTheText() {
        String text = SearchText.fold("Ayzər Zərgər Bakı");
        assertThat(SearchText.matches(text, List.of("zer"))).isTrue();
        assertThat(SearchText.matches(text, List.of("ayzer", "bak"))).isTrue();
        assertThat(SearchText.matches(text, List.of("erger"))).isFalse();
        assertThat(SearchText.matches(text, List.of())).isTrue();
    }
}
