package az.jeparla.share;

import az.jeparla.common.error.RateLimitExceededException;
import az.jeparla.common.net.IpAddresses;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Counts visitors who came to a store through a shared link (#100), and the WhatsApp clicks they make. A request
 * is counted only when it names a source ({@code ref} or {@code utm_source}), comes from a browser (not a crawler
 * or link-preview fetcher, {@link BotUserAgents}), is not a prefetch, and is within the per-address limits:
 * {@code referral-ip} over all stores and one visit per address, store and source in {@code referral-visit}'s
 * window. Requests that are not counted are not refused either (the caller answers 204 in every case), so the
 * rules cannot be probed.
 */
@Service
public class ReferralService {

    /** Statistics are counted per business day in Azerbaijan, as the WhatsApp clicks. */
    static final ZoneId BAKU = ZoneId.of("Asia/Baku");

    private final ReferralCounts counts;
    private final RateLimitService rateLimits;
    private final Clock clock;

    public ReferralService(ReferralCounts counts, RateLimitService rateLimits, Clock clock) {
        this.counts = counts;
        this.rateLimits = rateLimits;
        this.clock = clock;
    }

    /** Request details that decide whether a hit is counted. */
    public record Hit(String ref, String utmSource, String userAgent, String purpose, String clientIp) {

        ReferralSource source() {
            return ReferralSource.parse(ref, utmSource);
        }

        /** {@code Sec-Purpose} / {@code Purpose: prefetch}: the browser loads ahead, nobody has looked yet. */
        boolean isPrefetch() {
            return purpose != null && purpose.toLowerCase(Locale.ROOT).contains("prefetch");
        }
    }

    /**
     * Counts one visit of the store's page through a shared link.
     *
     * @return whether the visit was counted
     */
    public boolean visit(long storeId, Hit hit) {
        ReferralSource source = hit.source();
        if (source == null || hit.isPrefetch() || BotUserAgents.isBot(hit.userAgent())) {
            return false;
        }
        String address = IpAddresses.rateLimitKey(hit.clientIp());
        try {
            rateLimits.check(RateLimitPolicy.REFERRAL_IP, address);
            rateLimits.check(RateLimitPolicy.REFERRAL_VISIT, address + "|" + storeId + "|" + source);
        } catch (RateLimitExceededException overLimit) {
            return false;
        }
        counts.addVisit(storeId, today(), source);
        return true;
    }

    /**
     * Attributes a WhatsApp click (already counted and rate limited by the contact-click endpoint) to the source the
     * visitor came from. The frontend sends the source it saw on arrival.
     *
     * @return whether the click was attributed
     */
    public boolean whatsappClick(long storeId, Hit hit) {
        ReferralSource source = hit.source();
        if (source == null || BotUserAgents.isBot(hit.userAgent())) {
            return false;
        }
        counts.addWhatsappClick(storeId, today(), source);
        return true;
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(BAKU));
    }
}
