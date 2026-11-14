package az.jeparla.ai;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.product.Audience;
import az.jeparla.product.AudienceRules;
import az.jeparla.product.Category;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** On-model image rules (#121): audience, pose and the child-safe prompt, without a database. */
class OnModelTests {

    private static Category category(Category parent, String slug) {
        return new Category(parent, slug, LocalizedText.of(slug, slug, slug), 0);
    }

    @Test
    void theAudienceIsSuggestedFromTheRootCategory() {
        Category men = category(null, "kisi-zergerliyi");
        Category kids = category(null, "usaq-zergerliyi");
        assertThat(AudienceRules.suggest(category(men, "kisi-uzukleri"))).isEqualTo(Audience.MEN);
        assertThat(AudienceRules.suggest(category(kids, "usaq-sirgalari"))).isEqualTo(Audience.KIDS);
        assertThat(AudienceRules.suggest(category(null, "uzukler"))).isEqualTo(Audience.UNISEX);
        assertThat(AudienceRules.suggest(null)).isEqualTo(Audience.UNISEX);
    }

    @Test
    void aKidsPieceOnlyOnAChildModelAndAUnisexPieceOnAnyAdult() {
        assertThat(AudienceRules.fits(Audience.KIDS, Audience.KIDS)).isTrue();
        assertThat(AudienceRules.fits(Audience.KIDS, Audience.WOMEN)).isFalse();
        assertThat(AudienceRules.fits(Audience.UNISEX, Audience.KIDS)).isFalse();
        assertThat(AudienceRules.fits(Audience.UNISEX, Audience.MEN)).isTrue();
        assertThat(AudienceRules.fits(Audience.WOMEN, Audience.WOMEN)).isTrue();
        assertThat(AudienceRules.fits(Audience.WOMEN, Audience.MEN)).isFalse();
    }

    @Test
    void thePoseFollowsTheClosestKnownCategory() {
        Category rings = category(null, "uzukler");
        assertThat(CategoryPoses.of(category(rings, "nisan-uzukleri"))).isEqualTo(ModelPose.HAND);
        assertThat(CategoryPoses.of(category(rings, "yeni-alt-kateqoriya"))).isEqualTo(ModelPose.HAND);
        assertThat(CategoryPoses.of(category(null, "sirgalar"))).isEqualTo(ModelPose.EAR);
        assertThat(CategoryPoses.of(category(null, "qolbaqlar"))).isEqualTo(ModelPose.WRIST);
        Category men = category(null, "kisi-zergerliyi");
        assertThat(CategoryPoses.of(category(men, "x"))).isEqualTo(ModelPose.HALF_PORTRAIT);
    }

    @Test
    void aKidsPieceGetsTheChildSafePrompt() {
        AiPrompts prompts = new AiPrompts();
        String kids = prompts.prompt(AiJobKind.VIRTUAL_TRY_ON, Map.of(AiJobParameters.AUDIENCE_CODE, "KIDS",
                "audience", AiJobParameters.audienceText(Audience.KIDS), "pose", "wrist and forearm"));
        assertThat(kids).contains("child model").contains("no make-up").contains("wrist and forearm")
                .doesNotContain("{");
        String adult = prompts.prompt(AiJobKind.VIRTUAL_TRY_ON, Map.of(AiJobParameters.AUDIENCE_CODE, "WOMEN"));
        assertThat(adult).contains("adult model").doesNotContain("child");
        // The photoshoot has no model, so it has no child variant.
        assertThat(prompts.prompt(AiJobKind.AI_PHOTOSHOOT, Map.of(AiJobParameters.AUDIENCE_CODE, "KIDS")))
                .doesNotContain("child model");
    }
}
