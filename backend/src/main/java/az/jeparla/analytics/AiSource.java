package az.jeparla.analytics;

import java.util.List;
import java.util.Locale;

/**
 * AI assistants and answer engines whose users open Jeparla from an answer (#62, PLAN 5.18: "AI referrers counted
 * separately"). Recognised from the referrer's host or the {@code utm_source} the assistant adds to its links
 * (ChatGPT adds {@code utm_source=chatgpt.com}). Anything else is not an AI visit and is not counted here.
 * CHECK {@code ai_referral_counts_source} (V62) lists the same names; the frontend keeps the same host list
 * ({@code src/lib/ai-referrer.ts}) only to decide whether to report a visit at all.
 */
public enum AiSource {
    CHATGPT(List.of("chatgpt.com", "chat.openai.com", "openai.com"), List.of("chatgpt", "openai")),
    PERPLEXITY(List.of("perplexity.ai"), List.of("perplexity")),
    GEMINI(List.of("gemini.google.com", "bard.google.com"), List.of("gemini", "bard")),
    COPILOT(List.of("copilot.microsoft.com", "copilot.cloud.microsoft"), List.of("copilot")),
    CLAUDE(List.of("claude.ai"), List.of("claude")),
    DEEPSEEK(List.of("chat.deepseek.com", "deepseek.com"), List.of("deepseek")),
    GROK(List.of("grok.com"), List.of("grok")),
    META_AI(List.of("meta.ai"), List.of("meta.ai", "metaai")),
    MISTRAL(List.of("chat.mistral.ai"), List.of("mistral", "lechat")),
    ALICE(List.of("alice.yandex.ru"), List.of("alice", "yandexgpt"));

    /** Longest value looked at; a longer one is not recognised. */
    static final int MAX_LENGTH = 256;

    private final List<String> hosts;
    private final List<String> names;

    AiSource(List<String> hosts, List<String> names) {
        this.hosts = hosts;
        this.names = names;
    }

    /**
     * The assistant behind a referrer URL ({@code https://chatgpt.com/}), a host ({@code www.perplexity.ai}) or a
     * {@code utm_source} value ({@code chatgpt.com}, {@code perplexity}). Case does not matter; a subdomain of a
     * listed host counts ({@code www.}, {@code m.}).
     *
     * @return the assistant, or null when the value names none
     */
    public static AiSource parse(String value) {
        if (value == null || value.isBlank() || value.length() > MAX_LENGTH) {
            return null;
        }
        String host = hostOf(value.strip().toLowerCase(Locale.ROOT));
        if (host.isEmpty()) {
            return null;
        }
        for (AiSource source : values()) {
            for (String listed : source.hosts) {
                if (host.equals(listed) || host.endsWith("." + listed)) {
                    return source;
                }
            }
        }
        for (AiSource source : values()) {
            if (source.names.contains(host)) {
                return source;
            }
        }
        return null;
    }

    /** The host part of a URL or host, without scheme, user, port, path and trailing dot. */
    private static String hostOf(String value) {
        String rest = value;
        int scheme = rest.indexOf("://");
        if (scheme >= 0) {
            rest = rest.substring(scheme + 3);
        }
        int end = rest.length();
        for (char stop : new char[] {'/', '?', '#'}) {
            int at = rest.indexOf(stop);
            if (at >= 0 && at < end) {
                end = at;
            }
        }
        rest = rest.substring(0, end);
        int user = rest.lastIndexOf('@');
        if (user >= 0) {
            rest = rest.substring(user + 1);
        }
        int port = rest.indexOf(':');
        if (port >= 0) {
            rest = rest.substring(0, port);
        }
        while (rest.endsWith(".")) {
            rest = rest.substring(0, rest.length() - 1);
        }
        return rest;
    }
}
