package az.jeparla.merchant;

import az.jeparla.common.dto.Decimal;
import az.jeparla.common.dto.LocalizedTextDto;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.merchant.dto.MerchantImageDto;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.merchant.dto.MerchantProductRowDto;
import az.jeparla.merchant.dto.MerchantVariantDto;
import az.jeparla.product.Product;
import az.jeparla.product.ProductImage;
import az.jeparla.product.dto.StoneDto;
import java.util.Comparator;
import org.springframework.stereotype.Component;

/** Entities of the merchant cabinet to DTOs; call inside the service transaction (lazy collections). */
@Component
class MerchantViews {

    /** Cover first; the loaded list keeps its database order until the next load, so sort again. */
    static final Comparator<ProductImage> IMAGE_ORDER = Comparator.comparingInt(ProductImage::getSortOrder)
            .thenComparing(ProductImage::getId, Comparator.nullsLast(Comparator.naturalOrder()));

    private final ImageUrls imageUrls;

    MerchantViews(ImageUrls imageUrls) {
        this.imageUrls = imageUrls;
    }

    MerchantProductDto product(Product product) {
        return new MerchantProductDto(product.getId(), product.getSlug(), product.getStatus(), product.getReviewNote(),
                product.isHiddenBySeller(), product.getMaterialKind(), product.getCategory().getId(),
                LocalizedTextDto.of(product.getName()), LocalizedTextDto.of(product.getDescription()),
                product.getMetal(), product.getMaterial(), product.getNotPreciousConfirmedAt(),
                product.getExpertiseStatus(), product.getSubmittedAt(), product.getPublishedAt(),
                product.getUpdatedAt(),
                product.getImages().stream().sorted(IMAGE_ORDER).map(this::image).toList(),
                product.getVariants().stream().map(MerchantVariantDto::of).toList(),
                product.getStones().stream().map(StoneDto::of).toList());
    }

    MerchantProductRowDto row(Product product) {
        String cover = product.getImages().stream().min(IMAGE_ORDER)
                .map(image -> imageUrls.url(image.getStorageKey())).orElse(null);
        String priceFrom = product.cheapestVariant().map(variant -> Decimal.of(variant.getPrice())).orElse(null);
        return new MerchantProductRowDto(product.getId(), product.getSlug(), LocalizedTextDto.of(product.getName()),
                cover, product.getCategory().getId(), product.getStatus(), product.getMaterialKind(), priceFrom,
                product.getVariants().size(), null, product.getUpdatedAt(), product.getReviewNote());
    }

    MerchantImageDto image(ProductImage image) {
        return new MerchantImageDto(image.getId(), imageUrls.url(image.getStorageKey()),
                LocalizedTextDto.of(image.getAlt()), image.getWidth(), image.getHeight(), image.getContentType(),
                image.getSizeBytes(), image.isAiGenerated(), image.getSortOrder());
    }
}
