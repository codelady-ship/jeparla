package az.jeparla.merchant;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.PhoneNumbers;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.merchant.dto.MerchantDashboardDto;
import az.jeparla.merchant.dto.MerchantStoreDto;
import az.jeparla.merchant.dto.StoreProfileRequest;
import az.jeparla.merchant.dto.StoreRequest;
import az.jeparla.product.ContactQuestion;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.ProductContactClickRepository;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductStatus;
import az.jeparla.store.GeoPoint;
import az.jeparla.store.SellerCode;
import az.jeparla.store.SellerKind;
import az.jeparla.store.Store;
import az.jeparla.store.StoreRepository;
import az.jeparla.verification.CheckStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The seller's own store (#39): application, profile and dashboard. One store per merchant account; it is
 * always resolved through the signed-in user.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantStoreService {

    static final ZoneId BAKU = ZoneId.of("Asia/Baku");
    /** Dashboard window. */
    static final int DASHBOARD_DAYS = 30;

    private final StoreRepository stores;
    private final MerchantStores merchantStores;
    private final UserRepository users;
    private final ProductRepository products;
    private final ProductContactClickRepository clicks;
    private final AuditService audit;
    private final Clock clock;

    public MerchantStoreService(StoreRepository stores, MerchantStores merchantStores, UserRepository users,
            ProductRepository products, ProductContactClickRepository clicks, AuditService audit, Clock clock) {
        this.stores = stores;
        this.merchantStores = merchantStores;
        this.users = users;
        this.products = products;
        this.clicks = clicks;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * The store application of the /sell wizard: a PENDING store whose seller check is PENDING. A second
     * application is 409 {@code merchant.store_exists}, unless it repeats the Idempotency-Key of the first
     * (a double submit): then the existing store is returned.
     */
    @Transactional
    public Created<MerchantStoreDto> create(StoreRequest request, UUID idempotencyKey) {
        long userId = CurrentUser.id();
        Optional<Store> existing = stores.findByOwnerId(userId);
        if (existing.isPresent()) {
            Store store = existing.get();
            if (idempotencyKey != null && idempotencyKey.equals(store.getIdempotencyKey())) {
                return new Created<>(MerchantStoreDto.of(store), false);
            }
            throw new ApiException(HttpStatus.CONFLICT, "merchant.store_exists");
        }
        Store store = new Store(users.getReferenceById(userId), uniqueSlug(request.name()), request.name().strip(),
                request.city().strip(), request.address().strip(), PhoneNumbers.normalize(request.whatsapp()),
                request.legalType(), request.taxId());
        store.setSellerKind(request.sellerKind());
        applyProfile(store, request.phone(), request.social(), request.description(), request.openingHours());
        store.setSellerStatus(CheckStatus.PENDING);
        store.setIdempotencyKey(idempotencyKey);
        stores.saveAndFlush(store);
        audit.record("STORE_CREATED", AuditTargetType.STORE, store.getId(), store.getName(), null,
                "{\"sellerKind\":\"" + store.getSellerKind() + "\"}");
        if (Boolean.TRUE.equals(request.codeAccepted())) {
            recordCodeAcceptance(store, userId);
        }
        return new Created<>(MerchantStoreDto.of(store), true);
    }

    /**
     * The seller accepts the current code of conduct (#107): the wizard checkbox or the yearly confirmation in
     * the cabinet. Each acceptance is kept in store_code_acceptances and in the audit log.
     */
    @Transactional
    public MerchantStoreDto acceptCode() {
        Store store = merchantStores.own();
        recordCodeAcceptance(store, CurrentUser.id());
        return MerchantStoreDto.of(store);
    }

    private void recordCodeAcceptance(Store store, long userId) {
        Instant now = clock.instant();
        store.acceptCode(SellerCode.CURRENT_VERSION, SellerCode.CURRENT_TERMS_VERSION, now);
        stores.recordCodeAcceptance(store.getId(), SellerCode.CURRENT_VERSION, SellerCode.CURRENT_TERMS_VERSION,
                now, userId);
        audit.record("SELLER_CODE_ACCEPTED", AuditTargetType.STORE, store.getId(), store.getName(), null,
                "{\"version\":" + SellerCode.CURRENT_VERSION + ",\"termsVersion\":"
                        + SellerCode.CURRENT_TERMS_VERSION + "}");
    }

    /** The seller closed the cabinet's first-visit guide (#301): not shown again on any device. */
    @Transactional
    public MerchantStoreDto dismissGuide() {
        Store store = merchantStores.own();
        store.dismissGuide(clock.instant());
        return MerchantStoreDto.of(store);
    }

    @Transactional(readOnly = true)
    public MerchantStoreDto get() {
        return MerchantStoreDto.of(merchantStores.own());
    }

    /**
     * Profile changes. A seller kind change must keep every listed product allowed (a FASHION store has no
     * PRECIOUS product and the other way round) and a store whose documents were checked stays PRECIOUS or
     * MIXED: 409 {@code merchant.seller_kind_conflict}.
     */
    @Transactional
    public MerchantStoreDto update(StoreProfileRequest request) {
        Store store = merchantStores.ownWritable();
        SellerKind kind = request.sellerKind();
        if (kind != store.getSellerKind()) {
            for (MaterialKind material : MaterialKind.values()) {
                if (!kind.allows(material) && products.countLiveByStoreIdAndMaterialKind(store.getId(), material) > 0) {
                    throw new ApiException(HttpStatus.CONFLICT, "merchant.seller_kind_conflict", "sellerKind");
                }
            }
            if (!kind.sellsPrecious() && store.getDocumentsStatus() != CheckStatus.NONE) {
                throw new ApiException(HttpStatus.CONFLICT, "merchant.seller_kind_conflict", "sellerKind");
            }
            store.setSellerKind(kind);
        }
        store.setName(request.name().strip());
        store.setWhatsapp(PhoneNumbers.normalize(request.whatsapp()));
        store.setCity(request.city().strip());
        store.setAddress(request.address().strip());
        applyProfile(store, request.phone(), request.social(), request.description(), request.openingHours());
        if (request.splitLaborMarkup() != null) {
            store.setSplitLaborMarkup(request.splitLaborMarkup());
        }
        if (request.services() != null) {
            store.setServices(request.services());
        }
        if (request.returnPolicy() != null) {
            store.setReturnPolicy(request.returnPolicy());
        }
        if (request.legalName() != null) {
            store.setLegalName(request.legalName());
        }
        if (request.madeToOrder() != null) {
            store.declareMadeToOrder(request.madeToOrder().offered(), request.madeToOrder().days());
        }
        GeoPoint location = location(request);
        if (location != null) {
            store.setGeo(location.latitude(), location.longitude());
        }
        stores.flush();
        audit.record("STORE_UPDATED", AuditTargetType.STORE, store.getId(), store.getName(), null, null);
        return MerchantStoreDto.of(store);
    }

    /**
     * The location the seller gave (#116): a map link first, else both coordinates; null keeps the saved one.
     * A link without coordinates (a short link) is 400 {@code merchant.map_link}.
     */
    private static GeoPoint location(StoreProfileRequest request) {
        if (request.mapLink() != null && !request.mapLink().isBlank()) {
            return GeoPoint.fromMapLink(request.mapLink())
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "merchant.map_link", "mapLink"));
        }
        if (request.latitude() == null && request.longitude() == null) {
            return null;
        }
        if (request.latitude() == null || request.longitude() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.coordinates", "latitude");
        }
        return new GeoPoint(request.latitude(), request.longitude());
    }

    /** Product counts per status and WhatsApp clicks of the last 30 days. */
    @Transactional(readOnly = true)
    public MerchantDashboardDto dashboard() {
        Store store = merchantStores.own();
        Map<ProductStatus, Long> counts = new EnumMap<>(ProductStatus.class);
        for (ProductStatus status : ProductStatus.values()) {
            counts.put(status, 0L);
        }
        for (Object[] row : products.countByStatusForStore(store.getId())) {
            counts.put((ProductStatus) row[0], (Long) row[1]);
        }
        LocalDate from = LocalDate.now(clock.withZone(BAKU)).minusDays(DASHBOARD_DAYS - 1L);
        Map<ContactQuestion, Long> byQuestion = new EnumMap<>(ContactQuestion.class);
        for (ContactQuestion question : ContactQuestion.values()) {
            byQuestion.put(question, 0L);
        }
        for (Object[] row : clicks.sumByQuestionForStoreSince(store.getId(), from)) {
            byQuestion.put(ContactQuestion.valueOf((String) row[0]), ((Number) row[1]).longValue());
        }
        return new MerchantDashboardDto(null, clicks.sumByStoreSince(store.getId(), from), byQuestion, counts);
    }

    private static void applyProfile(Store store, String phone, String social, String description,
            String openingHours) {
        store.setPhone(phone == null || phone.isBlank() ? null : PhoneNumbers.normalize(phone));
        store.setSocial(blankToNull(social));
        String text = blankToNull(description);
        store.setDescription(text == null ? null : LocalizedText.of(text, null, null));
        store.setOpeningHours(blankToNull(openingHours));
    }

    /** The name's slug, or the slug with a random suffix when another store has it. */
    private String uniqueSlug(String name) {
        String base = Slugs.of(name, 100, "store");
        return stores.existsBySlug(base) ? Slugs.withSuffix(base, 6) : base;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
