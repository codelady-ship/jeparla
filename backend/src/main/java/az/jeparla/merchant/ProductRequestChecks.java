package az.jeparla.merchant;

import az.jeparla.common.error.ApiException;
import az.jeparla.merchant.dto.ProductRequest;
import az.jeparla.merchant.dto.StoneRequest;
import az.jeparla.merchant.dto.VariantRequest;
import az.jeparla.product.Category;
import az.jeparla.product.CategoryRepository;
import az.jeparla.product.Fineness;
import az.jeparla.product.FinenessRepository;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.StoneType;
import az.jeparla.store.Store;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The rules of a product request that Bean Validation cannot express: what the store may sell, PRECIOUS
 * versus FASHION (#128), the category and finenesses in the database, and the pricing mode of each variant.
 * Errors are 400 with the request field ({@code variants[0].finenessId}), like Bean Validation errors.
 */
@Component
class ProductRequestChecks {

    private final CategoryRepository categories;
    private final FinenessRepository finenesses;

    ProductRequestChecks(CategoryRepository categories, FinenessRepository finenesses) {
        this.categories = categories;
        this.finenesses = finenesses;
    }

    /** A checked request: its category and the fineness of each variant (null for FASHION), in order. */
    record Checked(Category category, List<Fineness> finenesses) {
    }

    Checked check(Store store, ProductRequest request) {
        MaterialKind kind = request.materialKind();
        if (!store.getSellerKind().allows(kind)) {
            throw invalid("merchant.material_not_allowed", "materialKind");
        }
        if (kind == MaterialKind.PRECIOUS) {
            if (request.metal() == null) {
                throw invalid("merchant.metal_required", "metal");
            }
            if (request.material() != null) {
                throw invalid("merchant.material_precious", "material");
            }
        } else {
            checkFashion(request);
        }
        Category category = categories.findById(request.categoryId()).filter(Category::isActive)
                .orElseThrow(() -> invalid("merchant.category_invalid", "categoryId"));

        List<Fineness> resolved = new ArrayList<>();
        Set<String> skus = new HashSet<>();
        for (int i = 0; i < request.variants().size(); i++) {
            VariantRequest variant = request.variants().get(i);
            resolved.add(variant(kind, request.metal(), variant, "variants[" + i + "]."));
            if (variant.sku() != null && !variant.sku().isBlank() && !skus.add(variant.sku().strip())) {
                throw invalid("merchant.duplicate_sku", "variants[" + i + "].sku");
            }
        }
        List<StoneRequest> stones = request.stonesOrEmpty();
        for (int i = 0; i < stones.size(); i++) {
            stone(kind, stones.get(i), "stones[" + i + "].");
        }
        return new Checked(category, resolved);
    }

    /**
     * One variant of a product of {@code kind} and {@code metal}: its fineness (null for FASHION) after the
     * fineness, weight and pricing rules. {@code field} prefixes the error field, e.g. "variants[1].".
     */
    Fineness variant(MaterialKind kind, Metal metal, VariantRequest variant, String field) {
        Fineness fineness = null;
        if (kind == MaterialKind.PRECIOUS) {
            if (variant.finenessId() == null) {
                throw invalid("merchant.fineness_required", field + "finenessId");
            }
            fineness = finenesses.findById(variant.finenessId())
                    .filter(f -> f.isActive() && f.getMetal() == metal)
                    .orElseThrow(() -> invalid("merchant.fineness_invalid", field + "finenessId"));
            if (variant.weightGrams() == null) {
                throw invalid("merchant.weight_required", field + "weightGrams");
            }
        } else {
            if (variant.finenessId() != null) {
                throw invalid("merchant.fashion_metal", field + "finenessId");
            }
            if (variant.mode() != PricingMode.FIXED) {
                throw invalid("merchant.fashion_fixed_price", field + "pricingMode");
            }
        }
        if (variant.mode() == PricingMode.FIXED) {
            if (variant.price() == null) {
                throw invalid("merchant.price_required", field + "price");
            }
        } else {
            if (variant.rule() == null) {
                throw invalid("merchant.rule_required", field + "rule");
            }
            if (variant.rule().minPrice() != null && variant.rule().maxPrice() != null
                    && variant.rule().minPrice().compareTo(variant.rule().maxPrice()) > 0) {
                throw invalid("merchant.price_limits", field + "rule.maxPrice");
            }
        }
        return fineness;
    }

    private static void checkFashion(ProductRequest request) {
        if (request.metal() != null) {
            throw invalid("merchant.fashion_metal", "metal");
        }
        if (request.material() == null) {
            throw invalid("merchant.material_required", "material");
        }
        if (!Boolean.TRUE.equals(request.notPreciousConfirmed())) {
            throw invalid("merchant.not_precious_confirmation", "notPreciousConfirmed");
        }
        var name = request.name();
        if (claim(name.az(), name.en(), name.ru()).isPresent()) {
            throw invalid("merchant.fashion_claim", "name");
        }
        var description = request.description();
        if (description != null && claim(description.az(), description.en(), description.ru()).isPresent()) {
            throw invalid("merchant.fashion_claim", "description");
        }
    }

    private static void stone(MaterialKind kind, StoneRequest stone, String field) {
        boolean certificate = notBlank(stone.certificateLab()) || notBlank(stone.certificateNumber());
        if (kind == MaterialKind.FASHION && (stone.type() != StoneType.CUBIC_ZIRCONIA || certificate)) {
            throw invalid("merchant.fashion_stone", field + "type");
        }
        if (notBlank(stone.certificateNumber()) && !notBlank(stone.certificateLab())) {
            throw invalid("merchant.certificate_lab_required", field + "certificateLab");
        }
    }

    private static Optional<String> claim(String... texts) {
        for (String text : texts) {
            Optional<String> found = FashionClaims.find(text);
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    static ApiException invalid(String code, String field) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, field);
    }
}
