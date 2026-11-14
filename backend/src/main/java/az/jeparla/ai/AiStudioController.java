package az.jeparla.ai;

import az.jeparla.ai.dto.AiApproveRequest;
import az.jeparla.ai.dto.AiJobDto;
import az.jeparla.ai.dto.AiJobRequest;
import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.ai.dto.AiStatusDto;
import az.jeparla.auth.CurrentUser;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.merchant.Created;
import az.jeparla.merchant.IdempotencyKeys;
import az.jeparla.product.Audience;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI Studio (#55, PLAN 5.12): asynchronous image jobs of the seller's own products. Another seller's job or
 * product is 403, a missing one 404 (docs/RBAC.md). Without a configured provider {@code GET /status} says so
 * and every job request answers 503 {@code ai.not_configured}.
 */
@RestController
@RequestMapping("/api/v1/merchant/ai")
@PreAuthorize("hasRole('MERCHANT')")
@Tag(name = "Merchant: AI Studio", description = "AI images from a product photo, published only after approval")
public class AiStudioController {

    private final AiStudioService studio;
    private final RateLimitService rateLimits;

    public AiStudioController(AiStudioService studio, RateLimitService rateLimits) {
        this.studio = studio;
        this.rateLimits = rateLimits;
    }

    @GetMapping("/status")
    @Operation(summary = "Whether a provider is configured, and the store's quota today")
    public AiStatusDto status() {
        return studio.status();
    }

    @GetMapping("/models")
    @Operation(summary = "AI models a seller can pick for VIRTUAL_TRY_ON (#130), the default of each audience first")
    public List<AiModelDto> models(@RequestParam(required = false) Audience audience) {
        return studio.models(audience);
    }

    @GetMapping("/jobs")
    @Operation(summary = "Jobs of one own product, newest first")
    public List<AiJobDto> list(@RequestParam long productId) {
        return studio.list(productId);
    }

    @PostMapping("/jobs")
    @Operation(summary = "Queue a job (202); 200 when the Idempotency-Key repeats an earlier request",
            description = "503 ai.not_configured without a provider, 503 ai.cost_limit when the monthly budget is"
                    + " spent, 429 over the daily quota of the store or the ai-job-account rate limit.")
    public ResponseEntity<AiJobDto> create(@Valid @RequestBody AiJobRequest request,
            @RequestHeader(name = IdempotencyKeys.HEADER, required = false) String idempotencyKey) {
        rateLimits.check(RateLimitPolicy.AI_JOB_ACCOUNT, "user:" + CurrentUser.id());
        Created<AiJobDto> result = studio.create(request, IdempotencyKeys.parse(idempotencyKey));
        return ResponseEntity.status(result.created() ? HttpStatus.ACCEPTED : HttpStatus.OK).body(result.body());
    }

    @GetMapping("/jobs/{id}")
    @Operation(summary = "Status and results (private preview URLs while the job waits for review)")
    public AiJobDto get(@PathVariable long id) {
        return studio.get(id);
    }

    @PostMapping("/jobs/{id}/approve")
    @Operation(summary = "Publish one result as a new product photo marked AI-generated",
            description = "The original photos stay first and unchanged; an approved product goes back to review.")
    public AiJobDto approve(@PathVariable long id, @Valid @RequestBody AiApproveRequest request) {
        return studio.approve(id, request.assetId());
    }

    @PostMapping("/jobs/{id}/reject")
    @Operation(summary = "Reject all results: the job is cancelled and its files deleted")
    public AiJobDto reject(@PathVariable long id) {
        return studio.reject(id);
    }

    @PostMapping("/jobs/{id}/retry")
    @Operation(summary = "Queue a failed job again (limited attempts, counts against the daily quota)")
    public AiJobDto retry(@PathVariable long id) {
        rateLimits.check(RateLimitPolicy.AI_JOB_ACCOUNT, "user:" + CurrentUser.id());
        return studio.retry(id);
    }

    @DeleteMapping("/jobs/{id}")
    @Operation(summary = "Cancel a job that is not running and delete its unapproved results")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        studio.delete(id);
        return ResponseEntity.noContent().build();
    }
}
