package az.jeparla.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.support.CbarStub.Answer;
import az.jeparla.support.MetalPriceJobTest;
import az.jeparla.support.MetalPriceJobTest.MutableClock;
import az.jeparla.support.MetalPriceJobTestSupport;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.SimpleLock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/** {@code POST /internal/jobs/metal-prices} (#44): shared secret, idempotent, under the job lock. */
@MetalPriceJobTest
class InternalJobApiTests {

    private static final String URL = "/internal/jobs/metal-prices";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private MetalPriceJobTestSupport db;

    @Autowired
    private MutableClock clock;

    @Autowired
    private LockProvider locks;

    @BeforeEach
    void setUp() {
        db.clean();
        clock.setBaku("2026-11-06", "10:15");
        MetalPriceJobTest.STUB.always(Answer.fixture("cbar-2026-11-06.xml"));
    }

    @Test
    void runsTheJobWithTheRightToken() throws Exception {
        mvc.perform(post(URL).header(InternalJobController.TOKEN_HEADER, MetalPriceJobTest.JOB_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trigger").value("INTERNAL"))
                .andExpect(jsonPath("$.requestedDate").value("2026-11-06"))
                .andExpect(jsonPath("$.bulletinDate").value("2026-11-06"))
                .andExpect(jsonPath("$.fetchError").isEmpty())
                .andExpect(jsonPath("$.quotes.length()").value(4))
                .andExpect(jsonPath("$.quotes[0].metal").value("GOLD"))
                .andExpect(jsonPath("$.quotes[0].outcome").value("APPLIED"))
                .andExpect(jsonPath("$.quotes[0].pricePerOunce").value("6877.435"))
                .andExpect(jsonPath("$.heldMetals").isEmpty());
        // Idempotent: a second call stores nothing new.
        mvc.perform(post(URL).header(InternalJobController.TOKEN_HEADER, MetalPriceJobTest.JOB_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quotes[0].outcome").value("EXISTS"));
        assertThat(db.count("SELECT count(*) FROM metal_price_snapshots")).isEqualTo(4);
    }

    @Test
    void refusesAMissingOrWrongToken() throws Exception {
        mvc.perform(post(URL)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("jobs.invalid_token"));
        mvc.perform(post(URL).header(InternalJobController.TOKEN_HEADER, "wrong"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(URL).header(InternalJobController.TOKEN_HEADER, MetalPriceJobTest.JOB_TOKEN + "x"))
                .andExpect(status().isUnauthorized());
        // A user token is not the job token.
        mvc.perform(post(URL).header("Authorization", "Bearer " + MetalPriceJobTest.JOB_TOKEN))
                .andExpect(status().isUnauthorized());
        assertThat(MetalPriceJobTest.STUB.requests()).isEmpty();
    }

    @Test
    void answersConflictWhileARunHoldsTheLock() throws Exception {
        Optional<SimpleLock> other = locks.lock(new LockConfiguration(Instant.now(), MetalPriceJob.LOCK_NAME,
                Duration.ofMinutes(5), Duration.ZERO));
        assertThat(other).isPresent();
        try {
            mvc.perform(post(URL).header(InternalJobController.TOKEN_HEADER, MetalPriceJobTest.JOB_TOKEN))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("jobs.already_running"));
        } finally {
            other.get().unlock();
        }
    }
}
