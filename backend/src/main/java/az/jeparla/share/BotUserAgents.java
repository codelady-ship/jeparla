package az.jeparla.share;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * User agents that are not a person opening a link (#100): search and AI crawlers, link-preview fetchers of the
 * messengers the links are shared in (WhatsApp, Telegram, Facebook, Instagram, X, Slack, Discord ...), HTTP
 * libraries, headless browsers and uptime monitors. Their requests are not counted as visits. A missing or blank
 * user agent is a bot as well: every browser sends one.
 *
 * <p>Not a security control (a script can send any user agent; the per-address limits handle that), only a way to
 * keep the honest crawlers, which say who they are, out of the statistics.
 */
public final class BotUserAgents {

    private static final Pattern BOT = Pattern.compile(String.join("|",
            // Generic words used by crawlers and their libraries.
            // Not a bare "bot": phone models such as CUBOT have it in a browser's user agent.
            "bot/", "bot;", "-bot", "_bot", "duckduckbot", "adsbot", "mediapartners", "google-inspectiontool",
            "crawl", "spider", "slurp", "scrap", "fetch", "preview",
            "archiver", "monitor", "uptime", "pingdom", "checker", "validator", "lighthouse", "pagespeed",
            "headless", "phantomjs", "selenium", "puppeteer", "playwright", "httpclient", "okhttp",
            "python", "curl/", "wget/", "go-http-client", "java/", "axios", "node-fetch", "undici", "libwww",
            // Link previews of messengers and social networks (WhatsApp/2.x is the preview, not the app's browser).
            "^whatsapp/", "facebookexternalhit", "facebot", "meta-externalagent", "meta-externalfetcher",
            // In-app browsers (Instagram, TikTok, Pinterest, Viber) name the app too and are people: not listed.
            "telegrambot", "twitterbot", "linkedinbot", "slackbot", "discordbot", "skypeuripreview",
            "embedly", "quora link preview", "redditbot", "pinterestbot", "vkshare", "applebot",
            // AI search and training crawlers (PLAN 5.18 lets them read the site; they are still not visitors).
            "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-user", "claude-searchbot",
            "anthropic-ai", "perplexity", "google-extended", "bytespider", "ccbot", "amazonbot", "petalbot"));

    /** Longest user agent looked at; longer ones are cut (real browsers stay far below). */
    static final int MAX_LENGTH = 512;

    private BotUserAgents() {
    }

    /** Whether the request does not come from a person's browser. */
    public static boolean isBot(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return true;
        }
        String text = userAgent.length() > MAX_LENGTH ? userAgent.substring(0, MAX_LENGTH) : userAgent;
        return BOT.matcher(text.strip().toLowerCase(Locale.ROOT)).find();
    }
}
