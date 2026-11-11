package az.jeparla.merchant;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.ratelimit.RateLimitPolicy;
import az.jeparla.common.ratelimit.RateLimitService;
import az.jeparla.merchant.dto.ReferralStatsDto;
import az.jeparla.merchant.dto.ShareLinkDto;
import az.jeparla.share.QrSvg;
import az.jeparla.share.ReferralCounts;
import az.jeparla.share.ReferralSource;
import az.jeparla.notification.SupportProperties;
import az.jeparla.store.ShareCodes;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.store.StoreStatus;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The seller's shareable catalog link and its statistics (#100). Always the store of the signed-in merchant
 * ({@link MerchantStores}): no store id is ever taken from the request, so nobody reads another store's numbers.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantShareService {

    static final ZoneId BAKU = ZoneId.of("Asia/Baku");
    /** Statistics windows the cabinet offers. */
    static final Set<Integer> WINDOWS = Set.of(30, 90);
    private static final int NEW_CODE_ATTEMPTS = 5;

    private final MerchantStores merchantStores;
    private final StoreRepository stores;
    private final ReferralCounts referrals;
    /** Its {@code siteUrl} ({@code JEPARLA_PUBLIC_SITE_URL}, a checked http(s) origin) is the base of the link. */
    private final SupportProperties site;
    private final RateLimitService rateLimits;
    private final AuditService audit;
    private final Clock clock;

    public MerchantShareService(MerchantStores merchantStores, StoreRepository stores, ReferralCounts referrals,
            SupportProperties site, RateLimitService rateLimits, AuditService audit, Clock clock) {
        this.merchantStores = merchantStores;
        this.stores = stores;
        this.referrals = referrals;
        this.site = site;
        this.rateLimits = rateLimits;
        this.audit = audit;
        this.clock = clock;
    }

    /** {@code GET /merchant/store/share}. */
    @Transactional(readOnly = true)
    public ShareLinkDto link() {
        return linkOf(merchantStores.own());
    }

    /** {@code GET /merchant/store/share/qr.svg}: the QR code of the link with {@code ref=qr}. */
    @Transactional(readOnly = true)
    public String qrSvg() {
        return QrSvg.of(linkOf(merchantStores.own()).qrUrl());
    }

    /**
     * {@code POST /merchant/store/share/regenerate}: a new code; the old link and every printed QR code stop working
     * at once. Audited with both codes. A BLOCKED store cannot; {@code share-regenerate-account} limits how often.
     */
    @Transactional
    public ShareLinkDto regenerate() {
        rateLimits.check(RateLimitPolicy.SHARE_REGENERATE_ACCOUNT, "user:" + CurrentUser.id());
        Store store = merchantStores.ownWritable();
        String old = store.getShareCode();
        String code = newCode();
        store.replaceShareCode(code);
        stores.flush();
        audit.record("STORE_SHARE_LINK_REPLACED", AuditTargetType.STORE, store.getId(), store.getName(), null,
                "{\"oldCode\":\"" + old + "\",\"newCode\":\"" + code + "\"}");
        return linkOf(store);
    }

    /**
     * {@code GET /merchant/referrals?days=30|90}: the store's referral counters of the last {@code days} days.
     * Other windows are 400 {@code merchant.referral_days}.
     */
    @Transactional(readOnly = true)
    public ReferralStatsDto stats(int days) {
        if (!WINDOWS.contains(days)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.referral_days", "days");
        }
        Store store = merchantStores.own();
        LocalDate to = LocalDate.now(clock.withZone(BAKU));
        LocalDate windowStart = to.minusDays(days - 1L);
        LocalDate created = store.getCreatedAt().atZone(BAKU).toLocalDate();
        LocalDate from = created.isAfter(windowStart) ? (created.isAfter(to) ? to : created) : windowStart;

        Map<ReferralSource, long[]> bySource = new EnumMap<>(ReferralSource.class);
        Map<LocalDate, long[]> byDay = new TreeMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            byDay.put(day, new long[2]);
        }
        long visits = 0;
        long clicks = 0;
        for (ReferralCounts.Row row : referrals.of(store.getId(), from, to)) {
            add(bySource.computeIfAbsent(row.source(), s -> new long[2]), row);
            add(byDay.computeIfAbsent(row.day(), d -> new long[2]), row);
            visits += row.visits();
            clicks += row.whatsappClicks();
        }
        List<ReferralStatsDto.BySource> sources = new ArrayList<>();
        bySource.forEach((source, sum) -> sources.add(new ReferralStatsDto.BySource(source, sum[0], sum[1])));
        sources.sort(Comparator.comparingLong(ReferralStatsDto.BySource::visits).reversed()
                .thenComparing(Comparator.comparingLong(ReferralStatsDto.BySource::whatsappClicks).reversed())
                .thenComparing(ReferralStatsDto.BySource::source));
        List<ReferralStatsDto.ByDay> daily = new ArrayList<>(byDay.size());
        byDay.forEach((day, sum) -> daily.add(new ReferralStatsDto.ByDay(day.toString(), sum[0], sum[1])));
        return new ReferralStatsDto(days, from.toString(), to.toString(), visits, clicks, sources, daily);
    }

    private static void add(long[] sum, ReferralCounts.Row row) {
        sum[0] += row.visits();
        sum[1] += row.whatsappClicks();
    }

    private ShareLinkDto linkOf(Store store) {
        String url = site.siteUrl() + "/s/" + store.getShareCode();
        return new ShareLinkDto(store.getShareCode(), url, url + "?ref=qr", store.getStatus() == StoreStatus.APPROVED);
    }

    /** A code no store has (a clash is about one in 10^12; the unique index is the final guard). */
    private String newCode() {
        for (int attempt = 0; attempt < NEW_CODE_ATTEMPTS; attempt++) {
            String code = ShareCodes.random();
            if (!stores.existsByShareCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("No free share code after " + NEW_CODE_ATTEMPTS + " attempts");
    }
}
