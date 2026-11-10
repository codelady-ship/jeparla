package az.jeparla.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/** The search cache itself (#151); the API tests run with it off (test application.yml). */
class SearchCacheTests {

    private final AtomicInteger loads = new AtomicInteger();

    private String load() {
        return "result " + loads.incrementAndGet();
    }

    @Test
    void aQueryAskedAgainIsServedFromTheCacheUntilEvicted() {
        SearchCache cache = new SearchCache(new SearchCacheProperties(Duration.ofSeconds(60), 100));
        Object key = List.of("uzuk");
        assertThat(cache.<String>get(key, this::load)).isEqualTo("result 1");
        assertThat(cache.<String>get(key, this::load)).isEqualTo("result 1");
        assertThat(cache.<String>get(List.of("qizil"), this::load)).isEqualTo("result 2");

        cache.evictAll();
        assertThat(cache.<String>get(key, this::load)).isEqualTo("result 3");
        assertThat(cache.evictions()).isOne();
    }

    @Test
    void aZeroTtlTurnsTheCacheOff() {
        SearchCache cache = new SearchCache(new SearchCacheProperties(Duration.ZERO, 100));
        Object key = List.of("uzuk");
        assertThat(cache.<String>get(key, this::load)).isEqualTo("result 1");
        assertThat(cache.<String>get(key, this::load)).isEqualTo("result 2");
        cache.evictAll();
        assertThat(cache.evictions()).isOne();
    }

    @Test
    void settingsAreChecked() {
        assertThatIllegalArgumentException().isThrownBy(() -> new SearchCacheProperties(Duration.ofSeconds(-1), 10));
        assertThatIllegalArgumentException().isThrownBy(() -> new SearchCacheProperties(Duration.ofHours(1), 10));
        assertThatIllegalArgumentException().isThrownBy(() -> new SearchCacheProperties(Duration.ofSeconds(60), 0));
    }
}
