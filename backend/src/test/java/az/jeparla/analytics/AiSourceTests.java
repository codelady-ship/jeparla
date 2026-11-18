package az.jeparla.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Recognising AI assistants from a referrer or utm_source (#62), and the landing page kinds. */
class AiSourceTests {

    @Test
    void referrersOfTheAssistantsAreRecognised() {
        assertThat(AiSource.parse("https://chatgpt.com/")).isEqualTo(AiSource.CHATGPT);
        assertThat(AiSource.parse("https://chat.openai.com/c/123")).isEqualTo(AiSource.CHATGPT);
        assertThat(AiSource.parse("https://www.perplexity.ai/search?q=qizil")).isEqualTo(AiSource.PERPLEXITY);
        assertThat(AiSource.parse("https://gemini.google.com/app")).isEqualTo(AiSource.GEMINI);
        assertThat(AiSource.parse("https://copilot.microsoft.com/")).isEqualTo(AiSource.COPILOT);
        assertThat(AiSource.parse("https://claude.ai/chat/abc")).isEqualTo(AiSource.CLAUDE);
        assertThat(AiSource.parse("https://chat.deepseek.com/")).isEqualTo(AiSource.DEEPSEEK);
        assertThat(AiSource.parse("HTTPS://CHATGPT.COM:443/")).isEqualTo(AiSource.CHATGPT);
        assertThat(AiSource.parse("https://alice.yandex.ru/")).isEqualTo(AiSource.ALICE);
    }

    @Test
    void utmSourcesAndHostsAreRecognisedToo() {
        // ChatGPT adds utm_source=chatgpt.com to the links of its answers.
        assertThat(AiSource.parse("chatgpt.com")).isEqualTo(AiSource.CHATGPT);
        assertThat(AiSource.parse(" perplexity ")).isEqualTo(AiSource.PERPLEXITY);
        assertThat(AiSource.parse("copilot")).isEqualTo(AiSource.COPILOT);
        assertThat(AiSource.parse("claude.ai")).isEqualTo(AiSource.CLAUDE);
    }

    @Test
    void searchEnginesSocialNetworksAndLookalikesAreNotAiVisits() {
        assertThat(AiSource.parse("https://www.google.com/")).isNull();
        assertThat(AiSource.parse("https://www.bing.com/search?q=chatgpt.com")).isNull();
        assertThat(AiSource.parse("https://l.instagram.com/")).isNull();
        assertThat(AiSource.parse("https://notchatgpt.com/")).isNull();
        assertThat(AiSource.parse("https://chatgpt.com.evil.example/")).isNull();
        assertThat(AiSource.parse("instagram")).isNull();
        assertThat(AiSource.parse("")).isNull();
        assertThat(AiSource.parse(null)).isNull();
        assertThat(AiSource.parse("https://chatgpt.com/" + "a".repeat(AiSource.MAX_LENGTH))).isNull();
    }

    @Test
    void landingPagesFoldUnknownValuesIntoOther() {
        assertThat(LandingPage.parse("product")).isEqualTo(LandingPage.PRODUCT);
        assertThat(LandingPage.parse("PRICES")).isEqualTo(LandingPage.PRICES);
        assertThat(LandingPage.parse("admin")).isEqualTo(LandingPage.OTHER);
        assertThat(LandingPage.parse(null)).isEqualTo(LandingPage.OTHER);
    }
}
