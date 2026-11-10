package az.jeparla.pricing.cbar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.pricing.MetalPriceProperties;
import az.jeparla.product.Metal;
import az.jeparla.support.CbarStub;
import az.jeparla.support.CbarStub.Answer;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The CBAR HTTP client (#43) against a local stub: URL, User-Agent, retries, timeouts, no redirects. */
class CbarClientTests {

    private static final CbarStub STUB = new CbarStub();
    private static final LocalDate FRIDAY = LocalDate.of(2026, 11, 6);

    private CbarClient client = client(3, Duration.ofSeconds(2));

    @AfterEach
    void reset() {
        STUB.reset();
        client.close();
    }

    @AfterAll
    static void stop() {
        STUB.close();
    }

    private static CbarClient client(int attempts, Duration readTimeout) {
        return new CbarClient(new MetalPriceProperties(STUB.sourceUrl(), "Jeparla/1.0 (test)", ZoneId.of("Asia/Baku"),
                "-", Duration.ofSeconds(2), readTimeout, attempts, Duration.ZERO, BigDecimal.TEN, 200,
                Duration.ofMinutes(30), Duration.ofMinutes(1)));
    }

    @Test
    void asksForTheDayInTheCbarUrlFormatAndNamesItself() {
        STUB.always(Answer.fixture("cbar-2026-11-06.xml"));
        CbarBulletin bulletin = client.fetch(FRIDAY);
        assertThat(bulletin.ouncePrices().get(Metal.GOLD)).isEqualByComparingTo("6877.435");
        assertThat(STUB.requests()).singleElement().satisfies(request -> {
            assertThat(request.path()).isEqualTo("/currencies/06.11.2026.xml");
            assertThat(request.userAgent()).isEqualTo("Jeparla/1.0 (test)");
            assertThat(request.accept()).contains("application/xml");
        });
        assertThat(client.urlOf(LocalDate.of(2026, 1, 2)).toString()).endsWith("/currencies/02.01.2026.xml");
    }

    @Test
    void defaultUserAgentHasNoPersonalContact() {
        String userAgent = "Jeparla/1.0 (metal price service; +https://jeparla.az)";
        assertThat(userAgent).doesNotContain("@");
        assertThat(new MetalPriceProperties("https://www.cbar.az/currencies/{date}.xml", userAgent,
                ZoneId.of("Asia/Baku"), "-", Duration.ofSeconds(5), Duration.ofSeconds(20), 3, Duration.ofSeconds(30),
                BigDecimal.TEN, 200, Duration.ofMinutes(30), Duration.ofMinutes(1)).userAgent()).isEqualTo(userAgent);
    }

    @Test
    void retriesServerErrorsThenSucceeds() {
        AtomicInteger calls = new AtomicInteger();
        STUB.answer(path -> calls.incrementAndGet() < 3 ? Answer.status(503) : Answer.fixture("cbar-2026-11-06.xml"));
        assertThat(client.fetch(FRIDAY).date()).isEqualTo(FRIDAY);
        assertThat(STUB.requests()).hasSize(3);
    }

    @Test
    void givesUpAfterTheLastAttempt() {
        STUB.always(Answer.status(500));
        assertThatThrownBy(() -> client.fetch(FRIDAY)).isInstanceOf(CbarFeedException.class)
                .hasMessageContaining("CBAR answered 500");
        assertThat(STUB.requests()).hasSize(3);
    }

    @Test
    void doesNotRetryWhatAnotherTryCannotFix() {
        STUB.always(Answer.status(404));
        assertThatThrownBy(() -> client.fetch(FRIDAY)).hasMessageContaining("CBAR answered 404");
        assertThat(STUB.requests()).hasSize(1);

        STUB.reset();
        STUB.always(Answer.xml("<ValCurs Date=\"06.11.2026\"></ValCurs>".getBytes()));
        assertThatThrownBy(() -> client.fetch(FRIDAY)).hasMessageContaining("is missing");
        assertThat(STUB.requests()).hasSize(1);
    }

    @Test
    void doesNotFollowTheRedirectOfAnUnknownDate() {
        // CBAR answers an impossible date with 302 to its home page (HTML).
        STUB.always(Answer.status(302));
        assertThatThrownBy(() -> client.fetch(FRIDAY)).hasMessageContaining("CBAR answered 302");
        assertThat(STUB.requests()).hasSize(1);
    }

    @Test
    void refusesHtmlWithStatus200() {
        STUB.always(new Answer(200, "text/html; charset=UTF-8", "<html></html>".getBytes(), null));
        assertThatThrownBy(() -> client.fetch(FRIDAY)).hasMessageContaining("Content-Type 'text/html");
    }

    @Test
    void timesOutAndRetries() {
        client.close();
        client = client(2, Duration.ofMillis(300));
        CountDownLatch never = new CountDownLatch(1);
        STUB.always(Answer.fixture("cbar-2026-11-06.xml").heldBy(never));
        try {
            assertThatThrownBy(() -> client.fetch(FRIDAY)).isInstanceOf(CbarFeedException.class)
                    .hasMessageContaining("no complete answer");
            assertThat(STUB.requests()).hasSize(2);
        } finally {
            never.countDown();
        }
    }

    @Test
    void networkErrorsAreRetried() {
        CbarClient closedPort = new CbarClient(new MetalPriceProperties("http://127.0.0.1:9/currencies/{date}.xml",
                "Jeparla/1.0 (test)", ZoneId.of("Asia/Baku"), "-", Duration.ofSeconds(1), Duration.ofSeconds(2), 2,
                Duration.ZERO, BigDecimal.TEN, 200, Duration.ofMinutes(30), Duration.ofMinutes(1)));
        try {
            assertThatThrownBy(() -> closedPort.fetch(FRIDAY)).isInstanceOf(CbarFeedException.class)
                    .satisfies(e -> assertThat(((CbarFeedException) e).isRetryable()).isTrue());
        } finally {
            closedPort.close();
        }
    }
}
