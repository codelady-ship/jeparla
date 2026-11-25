package az.jeparla.merchant;

import az.jeparla.admin.AuditService;
import az.jeparla.admin.AuditTargetType;
import az.jeparla.common.error.ApiException;
import az.jeparla.merchant.dto.MetalSiblingsDto;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Product;
import az.jeparla.product.ProductRepository;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Metal siblings (V70, owner decision 2026-11-25): the seller links two of the store's precious products that are
 * the same design in different metals, e.g. a gold and a silver ring. Both rows point at each other; a product has
 * at most one partner, so linking a new one first unlinks the old partners of both. Each product keeps its own
 * metal, prices and photos; nothing here sends a product back to review, since nothing that is sold changes.
 */
@Service
public class MerchantMetalSiblings {

    private final MerchantProducts products;
    private final ProductRepository repository;
    private final AuditService audit;

    MerchantMetalSiblings(MerchantProducts products, ProductRepository repository, AuditService audit) {
        this.products = products;
        this.repository = repository;
        this.audit = audit;
    }

    /** The current partner and the store's products that may become one (precious, another metal, not deleted). */
    @Transactional(readOnly = true)
    public MetalSiblingsDto get(long productId) {
        return view(products.owned(productId));
    }

    /**
     * Links {@code siblingId} (or unlinks with null). 400 {@code merchant.metal_sibling} for itself, a product of
     * another store (also when it does not exist), a bijouterie product or the same metal.
     */
    @Transactional
    public MetalSiblingsDto set(long productId, Long siblingId) {
        Product product = products.ownedWritable(productId);
        products.lockStore(product);
        Product sibling = siblingId == null ? null : candidate(product, siblingId);
        if (Objects.equals(product.getMetalSiblingId(), siblingId)) {
            return view(product);
        }
        // Unlink first and flush, so the unique index never sees one partner twice in a single flush.
        unlink(product);
        if (sibling != null) {
            unlink(sibling);
        }
        products.flush();
        if (sibling != null) {
            product.setMetalSiblingId(sibling.getId());
            sibling.setMetalSiblingId(product.getId());
        }
        audit.record(sibling == null ? "METAL_SIBLING_REMOVED" : "METAL_SIBLING_SET", AuditTargetType.PRODUCT,
                product.getId(), product.getName().az(), null,
                "{\"siblingId\":" + (sibling == null ? "null" : sibling.getId()) + "}");
        return view(product);
    }

    private Product candidate(Product product, long siblingId) {
        Product sibling = repository.findById(siblingId)
                .filter(other -> !other.isDeleted() && other.getId() != product.getId().longValue()
                        && other.getStore().getId().equals(product.getStore().getId()))
                .orElseThrow(MerchantMetalSiblings::invalid);
        if (!fits(product, sibling)) {
            throw invalid();
        }
        return sibling;
    }

    /** Both precious with a metal, and the metals differ. */
    static boolean fits(Product product, Product other) {
        return product.getMaterialKind() == MaterialKind.PRECIOUS && other.getMaterialKind() == MaterialKind.PRECIOUS
                && product.getMetal() != null && other.getMetal() != null && product.getMetal() != other.getMetal();
    }

    private void unlink(Product product) {
        Long old = product.getMetalSiblingId();
        if (old == null) {
            return;
        }
        repository.findById(old).filter(other -> product.getId().equals(other.getMetalSiblingId()))
                .ifPresent(other -> other.setMetalSiblingId(null));
        product.setMetalSiblingId(null);
    }

    private MetalSiblingsDto view(Product product) {
        var options = repository.findLiveByStoreId(product.getStore().getId()).stream()
                .filter(other -> !other.getId().equals(product.getId()) && fits(product, other))
                .map(other -> new MetalSiblingsDto.Option(other.getId(), other.getName().az(), other.getMetal(),
                        other.getMetalSiblingId() != null && !other.getMetalSiblingId().equals(product.getId())))
                .toList();
        return new MetalSiblingsDto(product.getMetalSiblingId(), options);
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "merchant.metal_sibling", "siblingId");
    }
}
