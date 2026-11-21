package az.jeparla.merchant;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Product video limits (#117), bound from {@code jeparla.merchant.videos.*}.
 *
 * @param maxPerStore products of one store that may have a video at a time. A video is at most 8 MB, so 20 is
 *                    at most 160 MB per store: the free tier of the object storage (10 GB, shared with the
 *                    photos) holds dozens of stores. Raise it only with the storage plan in mind.
 */
@ConfigurationProperties("jeparla.merchant.videos")
public record MerchantVideoProperties(@DefaultValue("20") int maxPerStore) {

    public MerchantVideoProperties {
        if (maxPerStore < 0) {
            throw new IllegalArgumentException("jeparla.merchant.videos.max-per-store must not be negative");
        }
    }
}
