package az.jeparla.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.product.Audience;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** AI model library rules (#130), without a database. */
class AiModelTests {

    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    private static AiModel model() {
        return new AiModel("Aysel", Audience.WOMEN, SkinTone.MEDIUM, ModelStyle.CLASSIC, "AI, 2026-11-20", 0, NOW);
    }

    @Test
    void aModelIsNeverUnisex() {
        assertThatThrownBy(() -> new AiModel("X", Audience.UNISEX, SkinTone.LIGHT, ModelStyle.CASUAL, "AI", 0, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aModelWithoutPhotosIsNotOffered() {
        AiModel model = model();
        assertThat(model.isActive()).isTrue();
        assertThat(model.isSelectable()).isFalse();
        model.addImage(new AiModelImage("ai-models/1/a.png", ModelPose.HAND, "image/png", 800, 1000, 10, 0));
        assertThat(model.isSelectable()).isTrue();
    }

    @Test
    void deactivatingRemovesTheDefaultAndTheOffer() {
        AiModel model = model();
        model.addImage(new AiModelImage("ai-models/1/a.png", ModelPose.NECK, "image/png", 800, 1000, 10, 0));
        model.setDefault(true, NOW);
        assertThat(model.isDefault()).isTrue();
        model.change("Aysel", Audience.WOMEN, SkinTone.MEDIUM, ModelStyle.CLASSIC, "AI", 0, false, NOW);
        assertThat(model.isDefault()).isFalse();
        assertThat(model.isSelectable()).isFalse();
        model.setDefault(true, NOW);
        assertThat(model.isDefault()).isFalse();
    }
}
