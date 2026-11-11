package az.jeparla.share;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.common.ratelimit.InMemoryRateLimitCounter;
import az.jeparla.common.ratelimit.RateLimitProperties;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.store.ShareCodes;
import az.jeparla.store.dto.StoreFactsDto.ShareOfProducts;
import io.nayuki.qrcodegen.QrCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Share links without a database (#100, #108): codes, sources, bot filter, counting rules, QR SVG, facts shares. */
class ShareUnitTests {

    private static final String CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

    // ------------------------------------------------------------------ share codes

    @Test
    void shareCodesHaveTheFormatOfTheDatabaseCheck() {
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 2000; i++) {
            String code = ShareCodes.random();
            assertThat(code).matches("^[a-km-np-z2-9]{8}$");
            assertThat(ShareCodes.isValid(code)).isTrue();
            codes.add(code);
        }
        assertThat(codes).as("random, not repeating").hasSize(2000);
        assertThat(ShareCodes.isValid("abcdefgl")).as("no l").isFalse();
        assertThat(ShareCodes.isValid("abcdefg0")).as("no 0").isFalse();
        assertThat(ShareCodes.isValid("ABCDEFGH")).isFalse();
        assertThat(ShareCodes.isValid("abcdefg")).isFalse();
        assertThat(ShareCodes.isValid(null)).isFalse();
    }

    // ------------------------------------------------------------------ sources

    @Test
    void sourcesAreFoldedIntoTheFixedList() {
        assertThat(ReferralSource.parse("instagram", null)).isEqualTo(ReferralSource.INSTAGRAM);
        assertThat(ReferralSource.parse(" IG ", null)).isEqualTo(ReferralSource.INSTAGRAM);
        assertThat(ReferralSource.parse("Instagram_Bio", null)).isEqualTo(ReferralSource.INSTAGRAM);
        assertThat(ReferralSource.parse("tiktok-profile", null)).isEqualTo(ReferralSource.TIKTOK);
        assertThat(ReferralSource.parse("tap.az", null)).isEqualTo(ReferralSource.TAPAZ);
        assertThat(ReferralSource.parse("wa", null)).isEqualTo(ReferralSource.WHATSAPP);
        assertThat(ReferralSource.parse("qr", null)).isEqualTo(ReferralSource.QR);
        assertThat(ReferralSource.parse("link", null)).isEqualTo(ReferralSource.LINK);
        assertThat(ReferralSource.parse("my-newsletter", null)).isEqualTo(ReferralSource.OTHER);
        assertThat(ReferralSource.parse("x".repeat(500), null)).isEqualTo(ReferralSource.OTHER);
    }

    @Test
    void refWinsOverUtmSourceAndNoSourceCountsNothing() {
        assertThat(ReferralSource.parse("tiktok", "instagram")).isEqualTo(ReferralSource.TIKTOK);
        assertThat(ReferralSource.parse(" ", "facebook")).isEqualTo(ReferralSource.FACEBOOK);
        assertThat(ReferralSource.parse(null, null)).isNull();
        assertThat(ReferralSource.parse("", " ")).isNull();
    }

    // ------------------------------------------------------------------ bots

    @ParameterizedTest
    @ValueSource(strings = {
        "WhatsApp/2.23.20.0 A",
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "TelegramBot (like TwitterBot)",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
        "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
        "Twitterbot/1.0",
        "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
        "curl/8.4.0",
        "python-requests/2.31.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 Chrome-Lighthouse",
        "",
        "   "})
    void crawlersAndPreviewsAreBots(String userAgent) {
        assertThat(BotUserAgents.isBot(userAgent)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        CHROME,
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
                + "Mobile/15E148 Instagram 345.0.0.34.84 (iPhone14,5; iOS 17_5; az_AZ; az; scale=3.00)",
        "Mozilla/5.0 (Linux; Android 13; CUBOT X70) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 "
                + "Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile "
                + "Safari/537.36 trill_340000 BytedanceWebview/d8a21c6 musical_ly",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"})
    void peoplesBrowsersAreNotBots(String userAgent) {
        assertThat(BotUserAgents.isBot(userAgent)).isFalse();
    }

    @Test
    void aMissingUserAgentIsABot() {
        assertThat(BotUserAgents.isBot(null)).isTrue();
    }

    // ------------------------------------------------------------------ counting rules

    /** Records what would be written, instead of the database. */
    private static final class RecordingCounts extends ReferralCounts {

        final List<String> visits = new ArrayList<>();
        final List<String> clicks = new ArrayList<>();

        RecordingCounts() {
            super(null);
        }

        @Override
        public void addVisit(long storeId, LocalDate day, ReferralSource source) {
            visits.add(storeId + "/" + day + "/" + source);
        }

        @Override
        public void addWhatsappClick(long storeId, LocalDate day, ReferralSource source) {
            clicks.add(storeId + "/" + day + "/" + source);
        }
    }

    /** 2026-11-10 21:30 UTC is already 2026-11-11 in Baku (UTC+4). */
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-10T21:30:00Z"), ZoneOffset.UTC);

    private static ReferralService service(RecordingCounts counts, int ipLimit) {
        RateLimitProperties properties = new RateLimitProperties(RateLimitProperties.Store.MEMORY,
                Map.of("referral-ip", new RateLimitProperties.Limit(ipLimit, Duration.ofHours(1))));
        return new ReferralService(counts,
                new RateLimitService(properties, null, new InMemoryRateLimitCounter(CLOCK), CLOCK), CLOCK);
    }

    private static ReferralService.Hit hit(String ref, String userAgent, String ip) {
        return new ReferralService.Hit(ref, null, userAgent, null, ip);
    }

    @Test
    void aVisitIsCountedOncePerAddressStoreAndSourceOnTheBakuDay() {
        RecordingCounts counts = new RecordingCounts();
        ReferralService referrals = service(counts, 100);

        assertThat(referrals.visit(1, hit("instagram", CHROME, "10.0.0.1"))).isTrue();
        assertThat(referrals.visit(1, hit("ig", CHROME, "10.0.0.1"))).as("a reload is the same visit").isFalse();
        assertThat(referrals.visit(1, hit("tiktok", CHROME, "10.0.0.1"))).as("another source").isTrue();
        assertThat(referrals.visit(2, hit("instagram", CHROME, "10.0.0.1"))).as("another store").isTrue();
        assertThat(referrals.visit(1, hit("instagram", CHROME, "10.0.0.2"))).as("another address").isTrue();

        assertThat(counts.visits).containsExactly("1/2026-11-11/INSTAGRAM", "1/2026-11-11/TIKTOK",
                "2/2026-11-11/INSTAGRAM", "1/2026-11-11/INSTAGRAM");
    }

    @Test
    void botsPrefetchesAndVisitsWithoutASourceAreNotCounted() {
        RecordingCounts counts = new RecordingCounts();
        ReferralService referrals = service(counts, 100);

        assertThat(referrals.visit(1, hit("instagram", "WhatsApp/2.23.20.0 A", "10.0.1.1"))).isFalse();
        assertThat(referrals.visit(1, hit("instagram", null, "10.0.1.2"))).isFalse();
        assertThat(referrals.visit(1, hit(null, CHROME, "10.0.1.3"))).isFalse();
        assertThat(referrals.visit(1, new ReferralService.Hit("qr", null, CHROME, "prefetch;prerender", "10.0.1.4")))
                .isFalse();
        assertThat(referrals.whatsappClick(1, hit("instagram", "facebookexternalhit/1.1", "10.0.1.5"))).isFalse();
        assertThat(referrals.whatsappClick(1, hit(null, CHROME, "10.0.1.6"))).isFalse();

        assertThat(counts.visits).isEmpty();
        assertThat(counts.clicks).isEmpty();
    }

    @Test
    void visitsOverThePerAddressLimitAreNotCounted() {
        RecordingCounts counts = new RecordingCounts();
        ReferralService referrals = service(counts, 3);
        for (long store = 1; store <= 5; store++) {
            referrals.visit(store, hit("instagram", CHROME, "10.0.2.1"));
        }
        assertThat(counts.visits).hasSize(3);
        assertThat(referrals.visit(9, hit("instagram", CHROME, "10.0.2.2"))).as("other addresses go on").isTrue();
    }

    @Test
    void whatsappClicksAreAttributedToTheirSource() {
        RecordingCounts counts = new RecordingCounts();
        ReferralService referrals = service(counts, 100);
        assertThat(referrals.whatsappClick(4, new ReferralService.Hit(null, "TikTok", CHROME, null, "10.0.3.1")))
                .isTrue();
        assertThat(counts.clicks).containsExactly("4/2026-11-11/TIKTOK");
    }

    // ------------------------------------------------------------------ site URL

    @Test
    void theShareLinkIsBuiltFromTheSiteOrigin() {
        assertThat(new ShareProperties("https://jeparla.az/").linkOf("k7m2q9xa")).isEqualTo("https://jeparla.az/s/k7m2q9xa");
        assertThat(new ShareProperties("http://localhost:3000").linkOf("k7m2q9xa"))
                .isEqualTo("http://localhost:3000/s/k7m2q9xa");
        for (String bad : List.of("jeparla.az", "ftp://jeparla.az", "https://jeparla.az/az", "https://jeparla.az?x=1",
                "https://user@jeparla.az", "")) {
            assertThatThrownBy(() -> new ShareProperties(bad)).as(bad).isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ------------------------------------------------------------------ QR code

    @Test
    void theQrCodeIsTheSymbolOfTheLinkWithAQuietZone() {
        String url = "https://jeparla.az/s/k7m2q9xa?ref=qr";
        String svg = QrSvg.of(url);
        QrCode expected = QrCode.encodeText(url, QrCode.Ecc.MEDIUM);
        int size = expected.size + 2 * QrSvg.BORDER;

        assertThat(svg).startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + size + " " + size + "\"")
                .contains("fill=\"#16251F\"", "fill=\"#FFFFFF\"", "aria-label=\"" + url + "\"")
                .endsWith("</svg>")
                .doesNotContain("<script", "href");

        Set<String> dark = new HashSet<>();
        Matcher module = Pattern.compile("M(\\d+),(\\d+)h1v1h-1z").matcher(svg);
        while (module.find()) {
            dark.add(module.group(1) + "," + module.group(2));
        }
        for (int y = 0; y < expected.size; y++) {
            for (int x = 0; x < expected.size; x++) {
                assertThat(dark.contains((x + QrSvg.BORDER) + "," + (y + QrSvg.BORDER)))
                        .as("module %d,%d", x, y).isEqualTo(expected.getModule(x, y));
            }
        }
        assertThat(dark).noneMatch(m -> m.startsWith("0,") || m.endsWith(",0"));
    }

    @Test
    void attributeTextIsEscaped() {
        assertThat(QrSvg.of("https://a.az/?x=\"<&>")).contains("aria-label=\"https://a.az/?x=&quot;&lt;&amp;&gt;\"");
    }

    // ------------------------------------------------------------------ fact shares

    @Test
    void sharesAreRoundedDownAndNullWithoutProducts() {
        assertThat(ShareOfProducts.of(1, 3)).isEqualTo(new ShareOfProducts(1, 33));
        assertThat(ShareOfProducts.of(199, 200)).as("never rounded up to 100").isEqualTo(new ShareOfProducts(199, 99));
        assertThat(ShareOfProducts.of(5, 5)).isEqualTo(new ShareOfProducts(5, 100));
        assertThat(ShareOfProducts.of(0, 7)).isEqualTo(new ShareOfProducts(0, 0));
        assertThat(ShareOfProducts.of(0, 0)).as("no products: no share, not 0 %").isEqualTo(new ShareOfProducts(0, null));
    }
}
