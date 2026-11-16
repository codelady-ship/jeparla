package az.jeparla.store;

import az.jeparla.auth.User;
import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.persistence.Decimals;
import az.jeparla.common.persistence.TimestampedEntity;
import az.jeparla.verification.CheckStatus;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * A jewelry store (PLAN 5.6). Owned by one merchant; the owner never changes through the API.
 * Ownership checks (#34, #39) compare {@code owner.id} with the signed-in user.
 */
@Entity
@Table(name = "stores")
public class Store extends TimestampedEntity {

    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false, updatable = false)
    private User owner;

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    /** A proper name: the same in every language. */
    @Column(name = "name", nullable = false)
    private String name;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "az", column = @Column(name = "description_az")),
            @AttributeOverride(name = "en", column = @Column(name = "description_en")),
            @AttributeOverride(name = "ru", column = @Column(name = "description_ru"))
    })
    private LocalizedText description;

    @Column(name = "city", nullable = false)
    private String city;

    @Column(name = "address", nullable = false)
    private String address;

    /** E.164, used for wa.me links. */
    @Column(name = "whatsapp", nullable = false)
    private String whatsapp;

    @Column(name = "phone")
    private String phone;

    @Column(name = "social")
    private String social;

    /** schema.org openingHours, e.g. "Mo-Fr 10:00-19:00; Sa 11:00-17:00". */
    @Column(name = "opening_hours")
    private String openingHours;

    /** Services the store says it offers (#174, V46); its own statement, not a Jeparla guarantee. */
    @Column(name = "service_resize", nullable = false)
    private boolean serviceResize;

    @Column(name = "service_engraving", nullable = false)
    private boolean serviceEngraving;

    @Column(name = "service_gift_wrap", nullable = false)
    private boolean serviceGiftWrap;

    @Column(name = "service_delivery", nullable = false)
    private boolean serviceDelivery;

    @Column(name = "service_returns", nullable = false)
    private boolean serviceReturns;

    /** The store's return terms in its own words (#174), at most 500 characters; null when none. */
    @Column(name = "return_policy")
    private String returnPolicy;

    /** Whether the store says it makes pieces to order (#108, V55); null when not declared. */
    @Column(name = "made_to_order")
    private Boolean madeToOrder;

    /** Usual days to make a piece; only with {@code madeToOrder = true}. */
    @Column(name = "made_to_order_days")
    private Integer madeToOrderDays;

    /** Product page price breakdown (#104, V45): labor and markup as two lines instead of one. */
    @Column(name = "split_labor_markup", nullable = false)
    private boolean splitLaborMarkup;

    @Column(name = "latitude", precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 9, scale = 6)
    private BigDecimal longitude;

    /** Object key in the public bucket, never a full URL. */
    @Column(name = "logo_key")
    private String logoKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "legal_type", nullable = false)
    private LegalType legalType;

    /** VOEN: 10 digits. */
    @Column(name = "tax_id", nullable = false)
    private String taxId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private StoreStatus status = StoreStatus.PENDING;

    @Column(name = "status_note")
    private String statusNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "seller_status", nullable = false)
    private CheckStatus sellerStatus = CheckStatus.NONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "documents_status", nullable = false)
    private CheckStatus documentsStatus = CheckStatus.NONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "identity_status", nullable = false)
    private CheckStatus identityStatus = CheckStatus.NONE;

    @Column(name = "approved_at")
    private Instant approvedAt;

    /** What the store sells (#128); FASHION stores have no documents check (CHECK, V13). */
    @Enumerated(EnumType.STRING)
    @Column(name = "seller_kind", nullable = false)
    private SellerKind sellerKind = SellerKind.PRECIOUS;

    /** Idempotency-Key of the request that created the store (#39), or null. */
    @Column(name = "idempotency_key", updatable = false)
    private UUID idempotencyKey;

    /**
     * Code of the shareable catalog link {@code /s/<code>} (#100, V20): random and independent of the slug. Only
     * the owner replaces it ({@link #replaceShareCode}).
     */
    @Column(name = "share_code", nullable = false, unique = true)
    private String shareCode;

    /** Version of the seller code of conduct last accepted (#107, V51), or null. See {@link SellerCode}. */
    @Column(name = "code_version")
    private Integer codeVersion;

    /** When {@link #codeVersion} was accepted, or null. */
    @Column(name = "code_accepted_at")
    private Instant codeAcceptedAt;

    /** Generated by PostgreSQL: {@code jeparla_fold(name || ' ' || city)}. */
    @Column(name = "search_text", insertable = false, updatable = false)
    private String searchText;

    protected Store() {
    }

    public Store(User owner, String slug, String name, String city, String address, String whatsapp,
            LegalType legalType, String taxId) {
        this.owner = owner;
        this.slug = slug;
        this.name = name;
        this.city = city;
        this.address = address;
        this.whatsapp = whatsapp;
        this.legalType = legalType;
        this.taxId = taxId;
        this.shareCode = ShareCodes.random();
    }

    public Integer getCodeVersion() {
        return codeVersion;
    }

    public Instant getCodeAcceptedAt() {
        return codeAcceptedAt;
    }

    /** The seller accepted the code of conduct (#107); the history row is written by the caller. */
    public void acceptCode(int version, Instant now) {
        this.codeVersion = version;
        this.codeAcceptedAt = now;
    }

    /** Admin decision: the store becomes public. */
    public void approve(Instant now) {
        this.status = StoreStatus.APPROVED;
        this.statusNote = null;
        if (approvedAt == null) {
            this.approvedAt = now;
        }
    }

    public boolean isOwnedBy(Long userId) {
        return userId != null && userId.equals(owner.getId());
    }

    public User getOwner() {
        return owner;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalizedText getDescription() {
        return description;
    }

    public void setDescription(LocalizedText description) {
        this.description = description;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public void setWhatsapp(String whatsapp) {
        this.whatsapp = whatsapp;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getSocial() {
        return social;
    }

    public void setSocial(String social) {
        this.social = social;
    }

    public String getOpeningHours() {
        return openingHours;
    }

    public void setOpeningHours(String openingHours) {
        this.openingHours = openingHours;
    }

    /** The services in a fixed order (#174). */
    public List<StoreServiceKind> getServices() {
        List<StoreServiceKind> services = new ArrayList<>();
        if (serviceResize) {
            services.add(StoreServiceKind.RESIZE);
        }
        if (serviceEngraving) {
            services.add(StoreServiceKind.ENGRAVING);
        }
        if (serviceGiftWrap) {
            services.add(StoreServiceKind.GIFT_WRAP);
        }
        if (serviceDelivery) {
            services.add(StoreServiceKind.DELIVERY);
        }
        if (serviceReturns) {
            services.add(StoreServiceKind.RETURNS);
        }
        return services;
    }

    public void setServices(Collection<StoreServiceKind> services) {
        this.serviceResize = services.contains(StoreServiceKind.RESIZE);
        this.serviceEngraving = services.contains(StoreServiceKind.ENGRAVING);
        this.serviceGiftWrap = services.contains(StoreServiceKind.GIFT_WRAP);
        this.serviceDelivery = services.contains(StoreServiceKind.DELIVERY);
        this.serviceReturns = services.contains(StoreServiceKind.RETURNS);
    }

    public String getReturnPolicy() {
        return returnPolicy;
    }

    public Boolean getMadeToOrder() {
        return madeToOrder;
    }

    public Integer getMadeToOrderDays() {
        return madeToOrderDays;
    }

    /**
     * Made to order as the store declares it (#108): null clears the answer; the days are kept only with
     * {@code true}, so the stored answer is always consistent.
     */
    public void declareMadeToOrder(Boolean offered, Integer days) {
        this.madeToOrder = offered;
        this.madeToOrderDays = Boolean.TRUE.equals(offered) ? days : null;
    }

    public void setReturnPolicy(String returnPolicy) {
        this.returnPolicy = returnPolicy == null || returnPolicy.isBlank() ? null : returnPolicy.strip();
    }

    public boolean isSplitLaborMarkup() {
        return splitLaborMarkup;
    }

    public void setSplitLaborMarkup(boolean splitLaborMarkup) {
        this.splitLaborMarkup = splitLaborMarkup;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    /**
     * Both or neither (CHECK {@code stores_geo_pair}), within -90..90 and -180..180 (CHECK
     * {@code stores_latitude}, {@code stores_longitude}). Brought to the column scale through
     * {@link Decimals#coordinate}: {@code 40.4} is stored as {@code 40.400000}, and more than six
     * decimals throws {@link ArithmeticException} instead of being rounded by PostgreSQL (#126).
     */
    public void setGeo(BigDecimal latitude, BigDecimal longitude) {
        if ((latitude == null) != (longitude == null)) {
            throw new IllegalArgumentException("Latitude and longitude are set together");
        }
        BigDecimal lat = Decimals.coordinate(latitude);
        BigDecimal lon = Decimals.coordinate(longitude);
        if (lat != null && (lat.abs().compareTo(MAX_LATITUDE) > 0 || lon.abs().compareTo(MAX_LONGITUDE) > 0)) {
            throw new IllegalArgumentException("Coordinates out of range: " + lat + ", " + lon);
        }
        this.latitude = lat;
        this.longitude = lon;
    }

    public String getLogoKey() {
        return logoKey;
    }

    public void setLogoKey(String logoKey) {
        this.logoKey = logoKey;
    }

    public LegalType getLegalType() {
        return legalType;
    }

    public void setLegalType(LegalType legalType) {
        this.legalType = legalType;
    }

    public String getTaxId() {
        return taxId;
    }

    public void setTaxId(String taxId) {
        this.taxId = taxId;
    }

    public StoreStatus getStatus() {
        return status;
    }

    public void setStatus(StoreStatus status) {
        this.status = status;
    }

    public String getStatusNote() {
        return statusNote;
    }

    public void setStatusNote(String statusNote) {
        this.statusNote = statusNote;
    }

    public CheckStatus getSellerStatus() {
        return sellerStatus;
    }

    public void setSellerStatus(CheckStatus sellerStatus) {
        this.sellerStatus = sellerStatus;
    }

    public CheckStatus getDocumentsStatus() {
        return documentsStatus;
    }

    /** Refused for a FASHION store (#128): it has no documents to check, so it never shows that badge. */
    public void setDocumentsStatus(CheckStatus documentsStatus) {
        if (sellerKind == SellerKind.FASHION && documentsStatus != CheckStatus.NONE) {
            throw new IllegalStateException("A FASHION store has no documents check: store " + getId());
        }
        this.documentsStatus = documentsStatus;
    }

    public CheckStatus getIdentityStatus() {
        return identityStatus;
    }

    public void setIdentityStatus(CheckStatus identityStatus) {
        this.identityStatus = identityStatus;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public SellerKind getSellerKind() {
        return sellerKind;
    }

    /**
     * A FASHION store never has a documents check (#128; CHECK {@code stores_fashion_without_documents}):
     * the caller makes sure {@code documentsStatus} is NONE first.
     */
    public void setSellerKind(SellerKind sellerKind) {
        if (sellerKind == SellerKind.FASHION && documentsStatus != CheckStatus.NONE) {
            throw new IllegalStateException("A FASHION store has no documents check, store " + getId() + " has "
                    + documentsStatus);
        }
        this.sellerKind = sellerKind;
    }

    public UUID getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(UUID idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getShareCode() {
        return shareCode;
    }

    /** A new share link (#100): the old code stops working at once. */
    public void replaceShareCode(String shareCode) {
        if (!ShareCodes.isValid(shareCode)) {
            throw new IllegalArgumentException("Not a share code: " + shareCode);
        }
        this.shareCode = shareCode;
    }

    public String getSearchText() {
        return searchText;
    }
}
