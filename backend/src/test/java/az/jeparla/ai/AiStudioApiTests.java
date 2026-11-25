package az.jeparla.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.ai.provider.GenerationRequest;
import az.jeparla.ai.provider.GenerationResult;
import az.jeparla.ai.provider.ImageGenerationException;
import az.jeparla.ai.provider.ImageGenerationProvider;
import az.jeparla.merchant.MerchantApiTestBase;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * AI Studio end to end with a stand-in provider (#55): queue, worker, review, approval as a new photo marked
 * AI-generated after the original, rejection, retry limits, quota and the monthly cost limit. The stand-in exists
 * only in this test; production ships with no provider.
 */
@AuthIntegrationTest
@Import(AiStudioApiTests.StandInProvider.class)
@TestPropertySource(properties = {
        "jeparla.ai.image-provider=stand-in",
        "jeparla.ai.daily-jobs-per-store=" + AiStudioApiTests.DAILY_LIMIT,
        "jeparla.ai.monthly-cost-limit=1000",
        // The test runs the worker itself.
        "jeparla.ai.worker-delay=1h"})
class AiStudioApiTests extends MerchantApiTestBase {

    static final int DAILY_LIMIT = 4;

    @TestConfiguration
    static class StandInProvider {

        static final AtomicReference<RuntimeException> NEXT_FAILURE = new AtomicReference<>();

        @Bean
        ImageGenerationProvider standInImageProvider() {
            return new ImageGenerationProvider() {
                @Override
                public String id() {
                    return "stand-in";
                }

                @Override
                public boolean configured() {
                    return true;
                }

                @Override
                public BigDecimal estimatedCost(GenerationRequest request) {
                    return new BigDecimal("0.0500");
                }

                @Override
                public GenerationResult generate(GenerationRequest request) {
                    RuntimeException failure = NEXT_FAILURE.getAndSet(null);
                    if (failure != null) {
                        throw failure;
                    }
                    try {
                        return new GenerationResult(List.of(new GenerationResult.GeneratedImage(png(800, 1000))),
                                new BigDecimal("0.0400"));
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                }
            };
        }
    }

    @Autowired
    private AiJobWorker worker;

    private record Ready(Seller seller, long productId, long imageId) {
    }

    private Ready product() throws Exception {
        Seller seller = seller(SellerKind.FASHION, true);
        long productId = createProduct(seller, beadsProduct(category(), "Muncuqlu qolbaq"));
        return new Ready(seller, productId, attachPng(seller, productId));
    }

    private MvcResult queue(Ready ready, long sourceImageId) throws Exception {
        return mvc.perform(json(post("/api/v1/merchant/ai/jobs"),
                "{\"productId\": %d, \"sourceImageId\": %d, \"kind\": \"AI_PHOTOSHOOT\"}".formatted(ready.productId(),
                        sourceImageId)).with(ready.seller().token())).andReturn();
    }

    private long queued(Ready ready) throws Exception {
        MvcResult result = queue(ready, ready.imageId());
        assertThat(result.getResponse().getStatus()).isEqualTo(202);
        return id(result);
    }

    @Test
    void anApprovedResultBecomesASecondPhotoMarkedAiGenerated() throws Exception {
        Ready ready = product();
        long jobId = queued(ready);
        assertThat(worker.run()).isPositive();
        MvcResult job = mvc.perform(get("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_REQUIRED"))
                .andExpect(jsonPath("$.assets.length()").value(1))
                .andReturn();
        String preview = JsonPath.read(body(job), "$.assets[0].previewUrl");
        assertThat(preview).isNotBlank();
        long assetId = ((Number) JsonPath.read(body(job), "$.assets[0].id")).longValue();

        mvc.perform(json(post("/api/v1/merchant/ai/jobs/" + jobId + "/approve"), "{\"assetId\": " + assetId + "}")
                        .with(ready.seller().token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.assets[0].productImageId").isNumber());
        mvc.perform(get("/api/v1/merchant/products/" + ready.productId()).with(ready.seller().token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images.length()").value(2))
                .andExpect(jsonPath("$.images[0].id").value((int) ready.imageId()))
                .andExpect(jsonPath("$.images[0].aiGenerated").value(false))
                .andExpect(jsonPath("$.images[1].aiGenerated").value(true));
        // A photoshoot shows the product alone: AI-generated, but not an on-model image (V68).
        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_images WHERE product_id = ? AND on_model",
                Integer.class, ready.productId())).isZero();

        // An AI image is never the source of another job.
        MvcResult product = mvc.perform(get("/api/v1/merchant/products/" + ready.productId())
                .with(ready.seller().token())).andReturn();
        long aiImageId = ((Number) JsonPath.read(body(product), "$.images[1].id")).longValue();
        MvcResult refused = queue(ready, aiImageId);
        assertThat(refused.getResponse().getStatus()).isEqualTo(400);
        assertThat(body(refused)).contains("ai.source_ai_generated");
    }

    @Test
    void anApprovedTryOnIsAnOnModelPhotoOnTheProductPage() throws Exception {
        Ready ready = product();
        MvcResult created = mvc.perform(json(post("/api/v1/merchant/ai/jobs"),
                "{\"productId\": %d, \"sourceImageId\": %d, \"kind\": \"VIRTUAL_TRY_ON\"}".formatted(
                        ready.productId(), ready.imageId())).with(ready.seller().token())).andReturn();
        assertThat(created.getResponse().getStatus()).isEqualTo(202);
        long jobId = id(created);
        assertThat(worker.run()).isPositive();
        MvcResult job = mvc.perform(get("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token())).andReturn();
        long assetId = ((Number) JsonPath.read(body(job), "$.assets[0].id")).longValue();
        mvc.perform(json(post("/api/v1/merchant/ai/jobs/" + jobId + "/approve"), "{\"assetId\": " + assetId + "}")
                .with(ready.seller().token())).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT on_model FROM product_images WHERE product_id = ? AND ai_generated",
                Boolean.class, ready.productId())).isTrue();
        jdbc.update("UPDATE products SET status = 'APPROVED', submitted_at = now(), published_at = now() WHERE id = ?",
                ready.productId());
        String slug = jdbc.queryForObject("SELECT slug FROM products WHERE id = ?", String.class, ready.productId());
        mvc.perform(get("/api/v1/products/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images[0].onModel").doesNotExist())
                .andExpect(jsonPath("$.images[1].aiGenerated").value(true))
                .andExpect(jsonPath("$.images[1].onModel").value(true));
    }

    @Test
    void aRejectedResultIsCancelledAndNeverPublished() throws Exception {
        Ready ready = product();
        long jobId = queued(ready);
        worker.run();
        mvc.perform(post("/api/v1/merchant/ai/jobs/" + jobId + "/reject").with(ready.seller().token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.assets[0].previewUrl").doesNotExist());
        mvc.perform(get("/api/v1/merchant/products/" + ready.productId()).with(ready.seller().token()))
                .andExpect(jsonPath("$.images.length()").value(1));
        Integer files = jdbc.queryForObject("SELECT count(*) FROM ai_assets WHERE job_id = ? AND storage_key IS NOT"
                + " NULL", Integer.class, jobId);
        assertThat(files).isZero();
    }

    @Test
    void aFailedJobCanBeRetriedWithinItsAttempts() throws Exception {
        Ready ready = product();
        long jobId = queued(ready);
        StandInProvider.NEXT_FAILURE.set(new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR, "x"));
        worker.run();
        mvc.perform(get("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token()))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.errorCode").value("ai.provider_error"))
                .andExpect(jsonPath("$.canRetry").value(true));
        mvc.perform(post("/api/v1/merchant/ai/jobs/" + jobId + "/retry").with(ready.seller().token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("QUEUED"));
        worker.run();
        mvc.perform(get("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token()))
                .andExpect(jsonPath("$.status").value("REVIEW_REQUIRED"))
                .andExpect(jsonPath("$.attempts").value(2));
        mvc.perform(post("/api/v1/merchant/ai/jobs/" + jobId + "/retry").with(ready.seller().token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ai.job_state"));
        mvc.perform(delete("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token()))
                .andExpect(status().isNoContent());
    }

    @Test
    void theDailyQuotaOfAStoreIsEnforced() throws Exception {
        Ready ready = product();
        List<Long> jobs = new java.util.ArrayList<>();
        for (int i = 0; i < DAILY_LIMIT; i++) {
            jobs.add(queued(ready));
        }
        MvcResult over = queue(ready, ready.imageId());
        assertThat(over.getResponse().getStatus()).isEqualTo(429);
        assertThat(over.getResponse().getHeader("Retry-After")).isNotBlank();
        mvc.perform(get("/api/v1/merchant/ai/status").with(ready.seller().token()))
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.usedToday").value(DAILY_LIMIT));
        // Cancelled jobs leave the queue (other tests run the worker) but still count today.
        for (long jobId : jobs) {
            mvc.perform(delete("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token()))
                    .andExpect(status().isNoContent());
        }
        assertThat(queue(ready, ready.imageId()).getResponse().getStatus()).isEqualTo(429);
    }

    @Test
    void theMonthlyCostLimitStopsNewJobs() throws Exception {
        Ready ready = product();
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Baku"));
        jdbc.update("INSERT INTO ai_usage (store_id, usage_date, attempts, cost, currency) VALUES (?, ?, 0, 5000, 'USD')",
                ready.seller().storeId(), today);
        try {
            MvcResult refused = queue(ready, ready.imageId());
            assertThat(refused.getResponse().getStatus()).isEqualTo(503);
            assertThat(body(refused)).contains("ai.cost_limit");
        } finally {
            jdbc.update("DELETE FROM ai_usage WHERE store_id = ?", ready.seller().storeId());
        }
    }

    @Test
    void anotherSellerCannotSeeOrApprove() throws Exception {
        Ready ready = product();
        long jobId = queued(ready);
        Seller other = seller(SellerKind.FASHION, true);
        mvc.perform(get("/api/v1/merchant/ai/jobs/" + jobId).with(other.token())).andExpect(status().isForbidden());
        mvc.perform(json(post("/api/v1/merchant/ai/jobs/" + jobId + "/approve"), "{\"assetId\": 1}")
                .with(other.token())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/merchant/ai/jobs/" + jobId).with(other.token())).andExpect(status().isForbidden());
        // Out of the queue for the other tests, which run the worker.
        mvc.perform(delete("/api/v1/merchant/ai/jobs/" + jobId).with(ready.seller().token()))
                .andExpect(status().isNoContent());
    }
}
