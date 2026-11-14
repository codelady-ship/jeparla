package az.jeparla.ai.provider;

import java.math.BigDecimal;

/**
 * An external image generation service (AI Studio, #55). The API ships without one: the active provider is
 * chosen by {@code jeparla.ai.image-provider} ({@code JEPARLA_AI_IMAGE_PROVIDER}), {@code none} by default, and
 * then every AI Studio job request answers 503 {@code ai.not_configured}. docs/ai-providers.md explains how to
 * add a provider (e.g. Higgsfield or Gemini): a Spring bean implementing this interface whose {@link #id()} is
 * the configured value, with its keys in env variables only.
 *
 * <p>Contract:
 * <ul>
 *   <li>{@link #generate} is called by the worker, outside any transaction, at most once per attempt. It
 *       blocks until the provider is done (polling inside if the provider is asynchronous) and must give up
 *       within {@code jeparla.ai.attempt-timeout}.</li>
 *   <li>It never returns placeholder or sample images: on any failure it throws
 *       {@link ImageGenerationException}.</li>
 *   <li>It enforces the provider-side hard spending limit too (an account cap at the provider), in addition to
 *       the API's own monthly limit.</li>
 * </ul>
 */
public interface ImageGenerationProvider {

    /** Value of {@code jeparla.ai.image-provider} that selects this provider, e.g. {@code higgsfield}. */
    String id();

    /** Whether the provider has what it needs (keys, endpoint) to take jobs. */
    boolean configured();

    /**
     * Expected cost of one {@link #generate} call, in {@code jeparla.ai.cost-currency}; counted against the
     * monthly limit before the call. Zero is allowed only for a provider that is really free.
     */
    BigDecimal estimatedCost(GenerationRequest request);

    /**
     * Generates images for one attempt.
     *
     * @throws ImageGenerationException on any failure; the job becomes FAILED with its code
     */
    GenerationResult generate(GenerationRequest request);
}
