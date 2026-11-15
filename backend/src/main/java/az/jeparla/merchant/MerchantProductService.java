package az.jeparla.merchant;

import static az.jeparla.merchant.ProductRequestChecks.invalid;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.auth.CurrentUser;
import az.jeparla.auth.UserRepository;
import az.jeparla.common.Currencies;
import az.jeparla.common.error.ApiException;
import az.jeparla.merchant.ProductRequestChecks.Checked;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.merchant.dto.MerchantProductRowDto;
import az.jeparla.merchant.dto.MerchantVariantDto;
import az.jeparla.merchant.dto.ProductRequest;
import az.jeparla.merchant.dto.StoneRequest;
import az.jeparla.merchant.dto.VariantRequest;
import az.jeparla.pricing.MetalPriceSnapshot;
import az.jeparla.pricing.MetalPriceSnapshotRepository;
import az.jeparla.pricing.PriceChangeReason;
import az.jeparla.pricing.PriceHistory;
import az.jeparla.pricing.PriceHistoryRepository;
import az.jeparla.pricing.PricingEngine;
import az.jeparla.pricing.QuoteStatus;
import az.jeparla.product.AudienceRules;
import az.jeparla.product.Fineness;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.PricingMode;
import az.jeparla.product.Product;
import az.jeparla.product.ProductAccess;
import az.jeparla.product.ProductRepository;
import az.jeparla.product.ProductStatus;
import az.jeparla.product.ProductStone;
import az.jeparla.product.ProductVariant;
import az.jeparla.product.ProductVariantRepository;
import az.jeparla.product.StoneOrigin;
import az.jeparla.store.Store;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Products, variants and stones of the seller's own store (#39, PLAN 5.7).
 *
 * <ul>
 *   <li><b>Ownership:</b> every product comes from {@link ProductAccess#requireOwner} (403 another seller's,
 *       404 missing); a deleted product is 404 too.</li>
 *   <li><b>Moderation:</b> a product is created as DRAFT. Changing what is sold (name, description,
 *       category, metal, material, stones, a fineness or weight, a new variant or photo) sends an APPROVED
 *       product back to review and makes a hidden one a DRAFT; price, stock, size and SKU do not.</li>
 *   <li><b>Prices:</b> a METAL_LINKED variant is priced at once with {@link PricingEngine} from the quote in
 *       use, the same arithmetic and quote as the daily job (#44), so the job skips it until the next
 *       quote. Every price a variant gets is written to {@code price_history} (reason MERCHANT).</li>
 *   <li><b>Kinds (#128):</b> see {@link ProductRequestChecks}.</li>
 * </ul>
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantProductService {

    private final MerchantStores merchantStores;
    private final MerchantProducts merchantProducts;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final MetalPriceSnapshotRepository snapshots;
    private final PriceHistoryRepository history;
    private final UserRepository users;
    private final ProductRequestChecks checks;
    private final MerchantViews views;
    private final AuditService audit;
    private final Clock clock;

    public MerchantProductService(MerchantStores merchantStores, MerchantProducts merchantProducts,
            ProductRepository products, ProductVariantRepository variants, MetalPriceSnapshotRepository snapshots,
            PriceHistoryRepository history, UserRepository users, ProductRequestChecks checks, MerchantViews views,
            AuditService audit, Clock clock) {
        this.merchantStores = merchantStores;
        this.merchantProducts = merchantProducts;
        this.products = products;
        this.variants = variants;
        this.snapshots = snapshots;
        this.history = history;
        this.users = users;
        this.checks = checks;
        this.views = views;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ reads

    @Transactional(readOnly = true)
    public List<MerchantProductRowDto> list() {
        Store store = merchantStores.own();
        return products.findLiveByStoreId(store.getId()).stream().map(views::row).toList();
    }

    @Transactional(readOnly = true)
    public MerchantProductDto get(long productId) {
        return views.product(owned(productId));
    }

    // ------------------------------------------------------------------ products

    /**
     * A new DRAFT product. A repeated Idempotency-Key returns the product it created ({@code created} false)
     * instead of a second one.
     */
    @Transactional
    public Created<MerchantProductDto> create(ProductRequest request, UUID idempotencyKey) {
        Store store = merchantStores.ownWritable();
        if (idempotencyKey != null) {
            Optional<Product> earlier = products.findByStoreIdAndIdempotencyKey(store.getId(), idempotencyKey);
            if (earlier.isPresent()) {
                return new Created<>(views.product(earlier.get()), false);
            }
        }
        Checked checked = checks.check(store, request);
        Instant now = clock.instant();
        String slug = Slugs.withSuffix(Slugs.of(request.name().az(), 120, "product"), 6);
        Product product = request.materialKind() == MaterialKind.FASHION
                ? Product.fashion(store, checked.category(), slug, request.name().toText(), request.material(), now)
                : new Product(store, checked.category(), slug, request.name().toText(), request.metal());
        product.setDescription(request.description() == null ? null : request.description().toText());
        product.setIdempotencyKey(idempotencyKey);
        product.setAudience(request.audience() != null ? request.audience()
                : AudienceRules.suggest(checked.category()));
        replaceStones(product, request.stonesOrEmpty());
        products.saveAndFlush(product);
        for (int i = 0; i < request.variants().size(); i++) {
            addVariant(product, request.variants().get(i), checked.finenesses().get(i), now, "variants[" + i + "].");
        }
        products.flush();
        audit.record("PRODUCT_CREATED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"materialKind\":\"" + product.getMaterialKind() + "\"}");
        return new Created<>(views.product(product), true);
    }

    /**
     * Replaces the product's fields, stones and variants (the edit form). Variants with an {@code id} are
     * changed, those without are added, live ones missing from the request are removed (kept for the price
     * history). The material kind cannot change: 409 {@code merchant.material_kind_locked}.
     */
    @Transactional
    public MerchantProductDto update(long productId, ProductRequest request) {
        Product product = ownedWritable(productId);
        if (request.materialKind() != product.getMaterialKind()) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.material_kind_locked", "materialKind");
        }
        Store store = product.getStore();
        Checked checked = checks.check(store, request);
        Instant now = clock.instant();

        Map<Long, ProductVariant> live = new HashMap<>();
        product.getVariants().forEach(variant -> live.put(variant.getId(), variant));
        for (int i = 0; i < request.variants().size(); i++) {
            Long id = request.variants().get(i).id();
            if (id != null && !live.containsKey(id)) {
                throw invalid("merchant.variant_unknown", "variants[" + i + "].id");
            }
        }

        boolean content = !Objects.equals(product.getCategory().getId(), checked.category().getId())
                || !Objects.equals(product.getName(), request.name().toText())
                || !Objects.equals(product.getDescription(),
                        request.description() == null ? null : request.description().toText())
                || product.getMetal() != request.metal()
                || product.getMaterial() != request.material();
        product.setCategory(checked.category());
        product.setName(request.name().toText());
        product.setDescription(request.description() == null ? null : request.description().toText());
        if (request.audience() != null) {
            product.setAudience(request.audience());
        }
        if (product.getMaterialKind() == MaterialKind.PRECIOUS) {
            // The variants move to finenesses of the new metal below; the database checks the pair at commit.
            product.setMetal(request.metal());
        } else {
            product.setMaterial(request.material());
        }
        String stonesBefore = stonesSignature(product);
        replaceStones(product, request.stonesOrEmpty());
        content |= !stonesBefore.equals(stonesSignature(product));

        // Removed first, so their SKUs are free for the variants of this request.
        List<Long> kept = request.variants().stream().map(VariantRequest::id).filter(Objects::nonNull).toList();
        for (ProductVariant variant : List.copyOf(product.getVariants())) {
            if (!kept.contains(variant.getId())) {
                product.removeVariant(variant, now);
            }
        }
        variants.flush();
        for (int i = 0; i < request.variants().size(); i++) {
            VariantRequest variant = request.variants().get(i);
            Fineness fineness = checked.finenesses().get(i);
            String field = "variants[" + i + "].";
            content |= variant.id() == null
                    ? addVariant(product, variant, fineness, now, field)
                    : changeVariant(product, live.get(variant.id()), variant, fineness, now, field);
        }
        afterChange(product, content, now);
        products.flush();
        audit.record("PRODUCT_UPDATED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null, null);
        return views.product(product);
    }

    /** Seller status changes, see {@link az.jeparla.merchant.dto.StatusChangeRequest}. The same status is a no-op. */
    @Transactional
    public MerchantProductDto changeStatus(long productId, ProductStatus target) {
        Product product = ownedWritable(productId);
        ProductStatus current = product.getStatus();
        if (target == current) {
            return views.product(product);
        }
        Instant now = clock.instant();
        switch (target) {
            case IN_REVIEW -> {
                if (current != ProductStatus.DRAFT && current != ProductStatus.RETURNED
                        && current != ProductStatus.INACTIVE) {
                    throw transition();
                }
                requireSubmittable(product, now);
                product.submitForReview(now);
            }
            case DRAFT -> {
                if (current != ProductStatus.IN_REVIEW) {
                    throw transition();
                }
                product.backToDraft();
            }
            case INACTIVE -> {
                if (current != ProductStatus.APPROVED) {
                    throw transition();
                }
                product.hideBySeller();
            }
            case APPROVED -> {
                if (current != ProductStatus.INACTIVE || !product.isHiddenBySeller()) {
                    throw transition();
                }
                MerchantProducts.requireCanSubmit(product.getStore(), now);
                product.showAgain();
            }
            default -> throw transition();
        }
        products.flush();
        audit.record("PRODUCT_STATUS_CHANGED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"from\":\"" + current + "\",\"to\":\"" + target + "\"}");
        return views.product(product);
    }

    /** "Deletes" the product: INACTIVE + {@code deleted_at}; afterwards it is 404 everywhere. */
    @Transactional
    public void delete(long productId) {
        Product product = ownedWritable(productId);
        product.softDelete(clock.instant());
        products.flush();
        audit.record("PRODUCT_DELETED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null, null);
    }

    // ------------------------------------------------------------------ variants

    @Transactional
    public MerchantVariantDto addVariant(long productId, VariantRequest request) {
        Product product = ownedWritable(productId);
        if (request.id() != null) {
            throw invalid("merchant.variant_unknown", "id");
        }
        if (product.getVariants().size() >= ProductRequest.MAX_VARIANTS) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.variant_limit");
        }
        Fineness fineness = checks.variant(product.getMaterialKind(), product.getMetal(), request, "");
        Instant now = clock.instant();
        ProductVariant variant = newVariant(product, request, fineness, now, "");
        afterChange(product, true, now);
        products.flush();
        audit.record("VARIANT_ADDED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"variantId\":" + variant.getId() + "}");
        return MerchantVariantDto.of(variant);
    }

    @Transactional
    public MerchantVariantDto updateVariant(long productId, long variantId, VariantRequest request) {
        Product product = ownedWritable(productId);
        ProductVariant variant = liveVariant(product, variantId);
        Fineness fineness = checks.variant(product.getMaterialKind(), product.getMetal(), request, "");
        Instant now = clock.instant();
        boolean content = changeVariant(product, variant, request, fineness, now, "");
        afterChange(product, content, now);
        products.flush();
        audit.record("VARIANT_UPDATED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"variantId\":" + variant.getId() + "}");
        return MerchantVariantDto.of(variant);
    }

    /** Removes a variant (its row stays for the price history). A listed product keeps at least one. */
    @Transactional
    public void removeVariant(long productId, long variantId) {
        Product product = ownedWritable(productId);
        ProductVariant variant = liveVariant(product, variantId);
        boolean listed = product.getStatus() == ProductStatus.APPROVED || product.getStatus() == ProductStatus.IN_REVIEW;
        if (listed && product.getVariants().size() == 1) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.last_variant");
        }
        product.removeVariant(variant, clock.instant());
        products.flush();
        audit.record("VARIANT_REMOVED", AuditTargetType.PRODUCT, product.getId(), product.getName().az(), null,
                "{\"variantId\":" + variantId + "}");
    }

    // ------------------------------------------------------------------ helpers

    private Product owned(long productId) {
        return merchantProducts.owned(productId);
    }

    private Product ownedWritable(long productId) {
        return merchantProducts.ownedWritable(productId);
    }

    private void afterChange(Product product, boolean content, Instant now) {
        merchantProducts.afterChange(product, content, now);
    }

    private static void requireSubmittable(Product product, Instant now) {
        MerchantProducts.requireCanSubmit(product.getStore(), now);
        if (product.getImages().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.images_required");
        }
        if (product.getVariants().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.variants_required");
        }
    }

    private static ApiException transition() {
        return new ApiException(HttpStatus.CONFLICT, "merchant.status_transition", "status");
    }

    private static ProductVariant liveVariant(Product product, long variantId) {
        return product.getVariants().stream().filter(variant -> variant.getId() == variantId).findFirst()
                .orElseThrow(ApiException::notFound);
    }

    /** Adds a variant; always a change of what is sold. */
    private boolean addVariant(Product product, VariantRequest request, Fineness fineness, Instant now, String field) {
        newVariant(product, request, fineness, now, field);
        return true;
    }

    private ProductVariant newVariant(Product product, VariantRequest request, Fineness fineness, Instant now,
            String field) {
        String sku = request.sku() == null || request.sku().isBlank() ? generatedSku(product) : request.sku().strip();
        requireFreeSku(product, sku, field);
        Price price = price(request, fineness, field);
        ProductVariant variant = new ProductVariant(sku, fineness, request.weightGrams(), price.amount(),
                Currencies.AZN, now);
        variant.setSize(blankToNull(request.size()));
        variant.setStockStatus(request.stockStatus());
        if (request.mode() == PricingMode.METAL_LINKED) {
            var rule = request.rule();
            variant.setMetalLinkedRule(rule.laborPerGram(), rule.laborFixed(), rule.stonePrice(), rule.markupPercent(),
                    rule.minPrice(), rule.maxPrice());
            variant.applyMetalPrice(price.amount(), price.quote(), now);
        }
        product.addVariant(variant);
        variants.save(variant);
        recordPrice(variant, null, price.quote());
        return variant;
    }

    /** Changes a live variant; true when what is sold changed (fineness or weight). */
    private boolean changeVariant(Product product, ProductVariant variant, VariantRequest request, Fineness fineness,
            Instant now, String field) {
        String sku = request.sku() == null || request.sku().isBlank() ? variant.getSku() : request.sku().strip();
        if (!sku.equals(variant.getSku())) {
            requireFreeSku(product, sku, field);
            variant.setSku(sku);
        }
        boolean content = !Objects.equals(idOf(variant.getFineness()), idOf(fineness))
                || !sameDecimal(variant.getWeightGrams(), request.weightGrams());
        BigDecimal previous = variant.getPrice();
        // Computed before anything changes: a missing quote or a too large price leaves the variant as it was.
        Price price = price(request, fineness, field);
        if (request.mode() == PricingMode.FIXED) {
            if (variant.getPricingMode() != PricingMode.FIXED || previous.compareTo(price.amount()) != 0) {
                variant.setFixedPrice(price.amount(), now);
            }
            variant.setFineness(fineness);
        } else {
            var rule = request.rule();
            variant.setFineness(fineness);
            variant.setMetalLinkedRule(rule.laborPerGram(), rule.laborFixed(), rule.stonePrice(), rule.markupPercent(),
                    rule.minPrice(), rule.maxPrice());
            variant.applyMetalPrice(price.amount(), price.quote(), now);
        }
        variant.setWeightGrams(request.weightGrams());
        variant.setSize(blankToNull(request.size()));
        variant.setStockStatus(request.stockStatus());
        if (previous.compareTo(variant.getPrice()) != 0) {
            recordPrice(variant, previous, price.quote());
        }
        return content;
    }

    /** The price of a request: the seller's (FIXED) or computed from the quote in use (METAL_LINKED). */
    private Price price(VariantRequest request, Fineness fineness, String field) {
        if (request.mode() == PricingMode.FIXED) {
            return new Price(request.price(), null);
        }
        MetalPriceSnapshot quote = snapshots.findFirstByMetalAndStatusOrderByQuoteDateDescIdDesc(fineness.getMetal(),
                QuoteStatus.APPLIED).orElseThrow(
                        () -> new ApiException(HttpStatus.CONFLICT, "merchant.no_metal_price", field + "pricingMode"));
        if (!Currencies.AZN.equals(quote.getCurrency())) {
            throw new IllegalStateException("Quote " + quote.getId() + " is in " + quote.getCurrency());
        }
        try {
            return new Price(PricingEngine.price(request.weightGrams(), fineness.getValue(), quote.getPricePerGram(),
                    request.rule().toRule()), quote);
        } catch (ArithmeticException e) {
            throw invalid("merchant.price_too_large", field + "rule");
        }
    }

    private record Price(BigDecimal amount, MetalPriceSnapshot quote) {
    }

    private void recordPrice(ProductVariant variant, BigDecimal previous, MetalPriceSnapshot quote) {
        history.save(new PriceHistory(variant, variant.getPrice(), previous, variant.getCurrency(),
                PriceChangeReason.MERCHANT, quote, users.getReferenceById(CurrentUser.id())));
    }

    private void requireFreeSku(Product product, String sku, String field) {
        if (variants.existsLiveSku(product.getStore().getId(), sku)) {
            throw new ApiException(HttpStatus.CONFLICT, "merchant.sku_taken", field + "sku");
        }
    }

    /** A SKU for a variant the seller did not name: unique enough without a lookup, checked anyway. */
    private static String generatedSku(Product product) {
        return Slugs.withSuffix("JP" + product.getId(), 6).toUpperCase(java.util.Locale.ROOT);
    }

    private static void replaceStones(Product product, List<StoneRequest> requests) {
        for (ProductStone stone : List.copyOf(product.getStones())) {
            product.removeStone(stone);
        }
        for (int i = 0; i < requests.size(); i++) {
            StoneRequest request = requests.get(i);
            ProductStone stone = new ProductStone(request.type(),
                    request.origin() == null ? StoneOrigin.NATURAL : request.origin(), request.carat(), request.count());
            stone.setGrading(blankToNull(request.shape()), blankToNull(request.color()), blankToNull(request.clarity()),
                    blankToNull(request.cut()));
            stone.setCertificate(blankToNull(request.certificateLab()), blankToNull(request.certificateNumber()));
            stone.setSortOrder(i);
            product.addStone(stone);
        }
    }

    private static String stonesSignature(Product product) {
        List<String> parts = new ArrayList<>();
        for (ProductStone stone : product.getStones()) {
            parts.add(String.join("|", String.valueOf(stone.getStoneType()), String.valueOf(stone.getOrigin()),
                    String.valueOf(stone.getShape()), stone.getCarat() == null ? "" : stone.getCarat().toPlainString(),
                    String.valueOf(stone.getStoneCount()), String.valueOf(stone.getColor()),
                    String.valueOf(stone.getClarity()), String.valueOf(stone.getCut()),
                    String.valueOf(stone.getCertificateLab()), String.valueOf(stone.getCertificateNumber())));
        }
        return String.join(";", parts);
    }

    private static Long idOf(Fineness fineness) {
        return fineness == null ? null : fineness.getId();
    }

    private static boolean sameDecimal(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
