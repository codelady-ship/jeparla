package az.jeparla.common.storage;

import java.util.Optional;

/**
 * Reads the type and pixel size of an image from its first bytes (magic numbers and header), never from
 * the file name or the {@code Content-Type} a client sent (#39: MIME check on the server). Only JPEG, PNG
 * and WebP are recognised; anything else is empty. Nothing is decoded.
 */
public final class ImageProbe {

    /** Bytes to read from the start of a file: enough for a JPEG whose size marker follows large EXIF data. */
    public static final int HEADER_BYTES = 256 * 1024;

    private ImageProbe() {
    }

    public record ImageInfo(String contentType, int width, int height) {
    }

    public static Optional<ImageInfo> probe(byte[] bytes) {
        if (bytes == null) {
            return Optional.empty();
        }
        if (isPng(bytes)) {
            return png(bytes);
        }
        if (isJpeg(bytes)) {
            return jpeg(bytes);
        }
        if (isWebp(bytes)) {
            return webp(bytes);
        }
        return Optional.empty();
    }

    // ------------------------------------------------------------------ PNG

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};

    private static boolean isPng(byte[] b) {
        if (b.length < 24) {
            return false;
        }
        for (int i = 0; i < PNG.length; i++) {
            if (b[i] != PNG[i]) {
                return false;
            }
        }
        // The first chunk is IHDR.
        return b[12] == 'I' && b[13] == 'H' && b[14] == 'D' && b[15] == 'R';
    }

    private static Optional<ImageInfo> png(byte[] b) {
        return info("image/png", int32be(b, 16), int32be(b, 20));
    }

    // ------------------------------------------------------------------ JPEG

    private static boolean isJpeg(byte[] b) {
        return b.length >= 4 && u8(b, 0) == 0xFF && u8(b, 1) == 0xD8 && u8(b, 2) == 0xFF;
    }

    /** Walks the segments to the first start-of-frame marker (SOF0-SOF15 except DHT, JPG and DAC). */
    private static Optional<ImageInfo> jpeg(byte[] b) {
        int i = 2;
        while (i + 3 < b.length) {
            if (u8(b, i) != 0xFF) {
                return Optional.empty();
            }
            int marker = u8(b, i + 1);
            if (marker == 0xFF) {
                i++;
                continue;
            }
            if (marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                i += 2;
                continue;
            }
            if (marker == 0xD9 || marker == 0xDA) {
                return Optional.empty();
            }
            int length = int16be(b, i + 2);
            if (length < 2) {
                return Optional.empty();
            }
            boolean frame = marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
            if (frame) {
                if (i + 8 >= b.length) {
                    return Optional.empty();
                }
                return info("image/jpeg", int16be(b, i + 7), int16be(b, i + 5));
            }
            i += 2 + length;
        }
        return Optional.empty();
    }

    // ------------------------------------------------------------------ WebP

    private static boolean isWebp(byte[] b) {
        return b.length >= 30 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    private static Optional<ImageInfo> webp(byte[] b) {
        String chunk = new String(b, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
        return switch (chunk) {
            // Lossy: frame tag (3 bytes), start code 9D 01 2A, then 14-bit width and height.
            case "VP8 " -> u8(b, 23) == 0x9D && u8(b, 24) == 0x01 && u8(b, 25) == 0x2A
                    ? info("image/webp", int16le(b, 26) & 0x3FFF, int16le(b, 28) & 0x3FFF)
                    : Optional.empty();
            // Lossless: signature 0x2F, then 14 bits width - 1 and 14 bits height - 1.
            case "VP8L" -> {
                if (u8(b, 20) != 0x2F) {
                    yield Optional.empty();
                }
                long bits = (long) u8(b, 21) | (long) u8(b, 22) << 8 | (long) u8(b, 23) << 16 | (long) u8(b, 24) << 24;
                yield info("image/webp", (int) (bits & 0x3FFF) + 1, (int) (bits >> 14 & 0x3FFF) + 1);
            }
            // Extended: 24-bit canvas width - 1 and height - 1.
            case "VP8X" -> info("image/webp", int24le(b, 24) + 1, int24le(b, 27) + 1);
            default -> Optional.empty();
        };
    }

    // ------------------------------------------------------------------ helpers

    private static Optional<ImageInfo> info(String type, long width, long height) {
        if (width <= 0 || height <= 0 || width > Integer.MAX_VALUE || height > Integer.MAX_VALUE) {
            return Optional.empty();
        }
        return Optional.of(new ImageInfo(type, (int) width, (int) height));
    }

    private static int u8(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static int int16be(byte[] b, int i) {
        return u8(b, i) << 8 | u8(b, i + 1);
    }

    private static int int16le(byte[] b, int i) {
        return u8(b, i) | u8(b, i + 1) << 8;
    }

    private static int int24le(byte[] b, int i) {
        return u8(b, i) | u8(b, i + 1) << 8 | u8(b, i + 2) << 16;
    }

    private static long int32be(byte[] b, int i) {
        return (long) u8(b, i) << 24 | (long) u8(b, i + 1) << 16 | (long) u8(b, i + 2) << 8 | u8(b, i + 3);
    }
}
