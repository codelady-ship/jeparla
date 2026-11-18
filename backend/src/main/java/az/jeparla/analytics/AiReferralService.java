package az.jeparla.analytics;

import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.share.BotUserAgents;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Counts visits that came from an AI assistant's answer (#62). The site server reports a page load whose referrer
 * or {@code utm_source} names an assistant ({@link AiSource}); it is counted per Baku day, assistant and kind of
 * landing page, only for a browser (not a crawler, {@link BotUserAgents}), not a prefetch, and within the
 * per-address limits of the shared-link visits: {@code referral-ip} over everything, and one visit per address,
 * assistant and page kind in {@code referral-visit}'s window. Requests that are not counted are not refused.
 */
@Service
public class AiReferralService {

    static final ZoneId BAKU = ZoneId.of("Asia/Baku");

    /** Longest period the statistics are read for at once. */
    static final int MAX_DAYS = 366;

    private final AiReferralCounts counts;
    private final RateLimitService rateLimits;
    private final Clock clock;

    public AiReferralService(AiReferralCounts counts, RateLimitService rateLimits, Clock clock) {
        this.counts = counts;
        this.rateLimits = rateLimits;
        this.clock = clock;
    }

    /** Request details that decide whether a visit is counted. */
    public record Hit(String source, String page, String userAgent, String purpose, String clientIp) {

        boolean isPrefetch() {
            return purpose != null && purpose.toLowerCase(Locale.ROOT).contains("prefetch");
        }
    }

    /** @return whether the visit was counted */
    public boolean visit(Hit hit) {
        AiSource source = AiSource.parse(hit.source());
        if (source == null || hit.isPrefetch() || BotUserAgents.isBot(hit.userAgent())) {
            return false;
        }
        LandingPage page = LandingPage.parse(hit.page());
        String address = IpAddresses.rateLimitKey(hit.clientIp());
        try {
            rateLimits.check(RateLimitPolicy.REFERRAL_IP, address);
            rateLimits.check(RateLimitPolicy.REFERRAL_VISIT, address + "|ai|" + source + "|" + page);
        } catch (RateLimitExceededException overLimit) {
            return false;
        }
        counts.addVisit(today(), source, page);
        return true;
    }

    /** Counters of the last {@code days} days, today included. */
    public List<AiReferralCounts.Row> lastDays(int days) {
        int span = Math.clamp(days, 1, MAX_DAYS);
        LocalDate to = today();
        return counts.between(to.minusDays(span - 1L), to);
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(BAKU));
    }
}
