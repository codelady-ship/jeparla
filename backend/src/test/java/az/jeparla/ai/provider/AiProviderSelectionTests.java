package az.jeparla.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.ai.AiJobKind;
import az.jeparla.ai.AiPrompts;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Provider selection and the disabled default (#55): off unless configured, never fake results. */
class AiProviderSelectionTests {

    private static final GenerationRequest REQUEST = new GenerationRequest(1, "AI_PHOTOSHOOT",
            "https://img.example/p.jpg", "prompt", List.of(), 1, "4:5", Map.of());

    /** A provider bean as an owner would add one; it is never called here. */
    private static ImageGenerationProvider stub(String id, boolean configured) {
        return new ImageGenerationProvider() {
            @Override
            public String id() {
                return id;
            }

            @Override
            public boolean configured() {
                return configured;
            }

            @Override
            public BigDecimal estimatedCost(GenerationRequest request) {
                return new BigDecimal("0.05");
            }

            @Override
            public GenerationResult generate(GenerationRequest request) {
                throw new UnsupportedOperationException();
            }
        };
    }

    @Test
    void noneIsTheDisabledProvider() {
        ImageGenerationProvider provider = new ImageGenerationProviders(List.of(stub("x", true)), "none").active();
        assertThat(provider).isInstanceOf(DisabledImageGenerationProvider.class);
        assertThat(provider.configured()).isFalse();
        assertThat(new ImageGenerationProviders(List.of(), "").active().id()).isEqualTo("none");
    }

    @Test
    void theDisabledProviderNeverReturnsImages() {
        assertThatThrownBy(() -> new DisabledImageGenerationProvider().generate(REQUEST))
                .isInstanceOf(ImageGenerationException.class)
                .extracting(e -> ((ImageGenerationException) e).code()).isEqualTo("ai.not_configured");
    }

    @Test
    void aConfiguredIdPicksThatBean() {
        ImageGenerationProvider chosen = stub("higgsfield", true);
        assertThat(new ImageGenerationProviders(List.of(stub("gemini", true), chosen), " Higgsfield ").active())
                .isSameAs(chosen);
    }

    @Test
    void anUnknownIdStopsTheStartup() {
        assertThatThrownBy(() -> new ImageGenerationProviders(List.of(), "higgsfeld"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("higgsfeld");
    }

    @Test
    void everyKindHasAPromptAndPlaceholdersAreFilled() {
        AiPrompts prompts = new AiPrompts();
        for (AiJobKind kind : AiJobKind.values()) {
            assertThat(prompts.prompt(kind, Map.of())).isNotBlank().doesNotContain("{");
        }
        assertThat(prompts.prompt(AiJobKind.VIRTUAL_TRY_ON, Map.of("pose", "hand and fingers")))
                .contains("hand and fingers");
    }

    @Test
    void resultsNeedAnImageAndNoNegativeCost() {
        assertThatThrownBy(() -> new GenerationResult(List.of(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GenerationResult(List.of(new GenerationResult.GeneratedImage(new byte[] {1})),
                new BigDecimal("-1"))).isInstanceOf(IllegalArgumentException.class);
    }
}
