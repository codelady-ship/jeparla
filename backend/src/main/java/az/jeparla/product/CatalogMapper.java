package az.jeparla.product;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.product.dto.CompareItemDto;
import az.jeparla.product.dto.DimensionsDto;
import az.jeparla.product.dto.EvidencePhotoDto;
import az.jeparla.product.dto.ProductDto;
import az.jeparla.product.dto.ProductImageDto;
import az.jeparla.product.dto.ProductSummaryDto;
import az.jeparla.product.dto.ProductVideoDto;
import az.jeparla.product.dto.StoneDto;
import az.jeparla.product.dto.VariantDto;
import az.jeparla.store.Store;
import az.jeparla.store.dto.StoreRefDto;
import az.jeparla.verification.CheckStatus;
import az.jeparla.verification.dto.VerificationDto;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Product entities to the public DTOs of frontend/src/types/api.ts. Call inside the read-only
 * transaction of a catalog service (open-in-view is off); the collections are loaded in batches.
 * Only listed products (public, with a live variant) are mapped.
 */
@Component
public class CatalogMapper {

    private static final Comparator<StockStatus> AVAILABILITY = Comparator.comparingInt(CatalogMapper::rank);

    private final ImageUrls imageUrls;

    public CatalogMapper(ImageUrls imageUrls) {
        this.imageUrls = imageUrls;
    }

    public ProductSummaryDto summary(Product product) {
        ProductVariant cheapest = product.cheapestVariant()
                .orElseThrow(() -> new IllegalStateException("Product " + product.getId() + " has no live variant"));
        Store store = product.getStore();
        StockStatus stock = product.getVariants().stream().map(ProductVariant::getStockStatus)
                .min(AVAILABILITY).orElse(StockStatus.OUT_OF_STOCK);
        return new ProductSummaryDto(
                product.getId(),
                product.getSlug(),
                LocalizedTextDto.of(product.getName()),
                product.getCategory().getId(),
                StoreRefDto.of(store),
                product.getMaterialKind(),
                product.getMaterial(),
                product.getMetal(),
                MoneyDto.of(cheapest.getPrice(), cheapest.getCurrency()),
                cheapest.getId(),
                cheapest.getPricingMode(),
                cheapest.getFineness() == null ? null : cheapest.getFineness().getValue(),
                Decimal.of(cheapest.getWeightGrams()),
                images(product),
                !product.getStones().isEmpty(),
                verification(product),
                stock,
                product.getPublishedAt().toString(),
                ProductVideoDto.of(product, imageUrls));
    }

    public ProductDto detail(Product product) {
        return ProductDto.of(summary(product), LocalizedTextDto.of(product.getDescription()),
                product.getVariants().stream().map(VariantDto::of).toList(), stones(product), product.getStatus(),
                evidencePhotos(product), DimensionsDto.of(product), product.getKeyFeatures());
    }

    /** Hallmark and label photos of a listed product (#106); rejected ones are not shown. */
    private List<EvidencePhotoDto> evidencePhotos(Product product) {
        return product.getEvidencePhotos().stream()
                .filter(photo -> photo.getStatus() != CheckStatus.REJECTED)
                .sorted(Comparator.comparing(ProductEvidencePhoto::getKind))
                .map(photo -> new EvidencePhotoDto(photo.getKind(), imageUrls.url(photo.getStorageKey()),
                        photo.getWidth(), photo.getHeight(), photo.getStatus() == CheckStatus.VERIFIED))
                .toList();
    }

    public CompareItemDto compareItem(ProductVariant variant) {
        Product product = variant.getProduct();
        return new CompareItemDto(summary(product), VariantDto.of(variant), stones(product));
    }

    /**
     * Seller and documents checks of the store, expertise of this product (PLAN 5.9). A FASHION product shows
     * only the seller check (#128): its documents are NONE even in a MIXED store whose documents passed, so it
     * never borrows the trust of the store's precious products.
     */
    public static VerificationDto verification(Product product) {
        Store store = product.getStore();
        if (product.getMaterialKind() == MaterialKind.FASHION) {
            return new VerificationDto(store.getSellerStatus(), CheckStatus.NONE, CheckStatus.NONE);
        }
        return new VerificationDto(store.getSellerStatus(), store.getDocumentsStatus(), product.getExpertiseStatus());
    }

    private List<ProductImageDto> images(Product product) {
        return product.getImages().stream()
                .map(image -> new ProductImageDto(imageUrls.url(image.getStorageKey()),
                        LocalizedTextDto.of(image.getAlt(), product.getName()), image.getWidth(), image.getHeight(),
                        image.isAiGenerated()))
                .toList();
    }

    private static List<StoneDto> stones(Product product) {
        return product.getStones().stream().map(StoneDto::of).toList();
    }

    private static int rank(StockStatus status) {
        return switch (status) {
            case IN_STOCK -> 0;
            case MADE_TO_ORDER -> 1;
            case OUT_OF_STOCK -> 2;
        };
    }
}
