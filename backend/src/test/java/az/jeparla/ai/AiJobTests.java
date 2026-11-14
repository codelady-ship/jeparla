package az.jeparla.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.ai.provider.ImageGenerationException;
import az.jeparla.common.error.ApiException;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** The AI Studio state machine (#55, PLAN 5.12), without a database. */
class AiJobTests {

    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    private static AiJob job(int maxAttempts) {
        return new AiJob(1, 2, 3, AiJobKind.AI_PHOTOSHOOT, maxAttempts, null, 4L, NOW);
    }

    private static String code(Runnable action) {
        try {
            action.run();
        } catch (ApiException e) {
            return e.code();
        }
        return null;
    }

    @Test
    void happyPathEndsApproved() {
        AiJob job = job(3);
        assertThat(job.getStatus()).isEqualTo(AiJobStatus.QUEUED);
        job.start(NOW);
        assertThat(job.getStatus()).isEqualTo(AiJobStatus.PROCESSING);
        assertThat(job.getAttempts()).isEqualTo(1);
        job.resultReady(NOW);
        assertThat(job.getStatus()).isEqualTo(AiJobStatus.REVIEW_REQUIRED);
        job.approve(NOW);
        assertThat(job.getStatus()).isEqualTo(AiJobStatus.APPROVED);
        assertThat(job.getStatus().isFinal()).isTrue();
    }

    @Test
    void nothingIsApprovedWithoutAResult() {
        AiJob job = job(3);
        assertThat(code(() -> job.approve(NOW))).isEqualTo("ai.job_state");
        job.start(NOW);
        assertThat(code(() -> job.approve(NOW))).isEqualTo("ai.job_state");
    }

    @Test
    void retriesAreLimited() {
        AiJob job = job(2);
        job.start(NOW);
        job.fail(ImageGenerationException.PROVIDER_ERROR, NOW);
        assertThat(job.canRetry()).isTrue();
        job.retry(NOW);
        job.start(NOW);
        job.fail(ImageGenerationException.PROVIDER_ERROR, NOW);
        assertThat(job.canRetry()).isFalse();
        assertThat(code(() -> job.retry(NOW))).isEqualTo("ai.no_attempts_left");
        assertThat(job.getAttempts()).isEqualTo(2);
    }

    @Test
    void refusedOrMissingSourceIsNotRetried() {
        AiJob refused = job(3);
        refused.start(NOW);
        refused.fail(ImageGenerationException.REFUSED, NOW);
        assertThat(refused.canRetry()).isFalse();

        AiJob gone = job(3);
        gone.fail(ImageGenerationCodes.SOURCE_GONE, NOW);
        assertThat(gone.canRetry()).isFalse();
    }

    @Test
    void aRunningJobCannotBeCancelledAndAnApprovedOneStays() {
        AiJob job = job(3);
        job.start(NOW);
        assertThat(code(() -> job.cancel(NOW))).isEqualTo("ai.job_state");
        job.resultReady(NOW);
        job.approve(NOW);
        assertThat(code(() -> job.cancel(NOW))).isEqualTo("ai.job_state");
    }

    @Test
    void reviewAndFailedJobsCanBeCancelled() {
        AiJob review = job(3);
        review.start(NOW);
        review.resultReady(NOW);
        review.cancel(NOW);
        assertThat(review.getStatus()).isEqualTo(AiJobStatus.CANCELLED);

        AiJob failed = job(3);
        failed.start(NOW);
        failed.fail(ImageGenerationException.TIMEOUT, NOW);
        failed.cancel(NOW);
        assertThat(failed.getStatus()).isEqualTo(AiJobStatus.CANCELLED);
    }

    @Test
    void unknownProviderCodesBecomeProviderError() {
        assertThat(ImageGenerationCodes.known("quota exceeded at provider X")).isEqualTo("ai.provider_error");
        assertThat(ImageGenerationCodes.known(null)).isEqualTo("ai.provider_error");
        assertThat(ImageGenerationCodes.known("ai.timeout")).isEqualTo("ai.timeout");
    }

    @Test
    void startNeedsAQueuedJob() {
        AiJob job = job(1);
        job.start(NOW);
        assertThatThrownBy(() -> job.start(NOW)).isInstanceOf(ApiException.class);
    }
}
