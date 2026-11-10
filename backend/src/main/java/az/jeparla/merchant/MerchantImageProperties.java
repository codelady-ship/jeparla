package az.jeparla.merchant;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Photo upload limits and the cleanup of uploads that were never attached (#154), bound from
 * {@code jeparla.merchant.images.*}. The per-account presign limit is the rate-limit policy
 * {@code image-upload-account}.
 *
 * @param dailyUploadsPerStore presigned uploads one store gets in 24 hours, attached or not
 * @param cleanupLockAtMostFor longest a cleanup run may hold its ShedLock lock
 */
@ConfigurationProperties("jeparla.merchant.images")
public record MerchantImageProperties(
        @DefaultValue("300") int dailyUploadsPerStore,
        @DefaultValue("15m") Duration cleanupLockAtMostFor) {

    public MerchantImageProperties {
        if (dailyUploadsPerStore < MerchantImageService.MAX_IMAGES) {
            throw new IllegalArgumentException("jeparla.merchant.images.daily-uploads-per-store must be at least "
                    + MerchantImageService.MAX_IMAGES);
        }
    }
}
