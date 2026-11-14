package az.jeparla.ai.provider;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * Images one attempt produced.
 *
 * @param images the files (JPEG, PNG or WebP bytes); at least one
 * @param cost   what the provider charged, in {@code jeparla.ai.cost-currency}, or null when it does not say
 *               (the estimate is kept then)
 */
public record GenerationResult(List<GeneratedImage> images, BigDecimal cost) {

    public GenerationResult {
        images = List.copyOf(images);
        if (images.isEmpty()) {
            throw new IllegalArgumentException("A result needs at least one image");
        }
        if (cost != null && cost.signum() < 0) {
            throw new IllegalArgumentException("cost must not be negative");
        }
    }

    /** One generated file. */
    public record GeneratedImage(byte[] bytes) {

        public GeneratedImage {
            Objects.requireNonNull(bytes);
            bytes = bytes.clone();
        }

        @Override
        public byte[] bytes() {
            return bytes.clone();
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof GeneratedImage image && java.util.Arrays.equals(bytes, image.bytes);
        }

        @Override
        public int hashCode() {
            return java.util.Arrays.hashCode(bytes);
        }

        @Override
        public String toString() {
            return "GeneratedImage[" + bytes.length + " bytes]";
        }
    }
}
