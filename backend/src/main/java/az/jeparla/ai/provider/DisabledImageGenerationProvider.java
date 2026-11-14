package az.jeparla.ai.provider;

import java.math.BigDecimal;

/**
 * The default provider ({@code jeparla.ai.image-provider=none}): not configured, never generates anything and
 * never returns sample images. AI Studio shows "not configured" and job requests answer 503.
 */
public final class DisabledImageGenerationProvider implements ImageGenerationProvider {

    public static final String ID = "none";

    @Override
    public String id() {
        return ID;
    }

    @Override
    public boolean configured() {
        return false;
    }

    @Override
    public BigDecimal estimatedCost(GenerationRequest request) {
        return BigDecimal.ZERO;
    }

    @Override
    public GenerationResult generate(GenerationRequest request) {
        throw new ImageGenerationException(ImageGenerationException.NOT_CONFIGURED,
                "No image generation provider is configured (jeparla.ai.image-provider=none)");
    }
}
