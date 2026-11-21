package az.jeparla.common.onnx;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * Decodes a product photo for a local model (#119, #163): JPEG, PNG or WebP (TwelveMonkeys plug-in) into an
 * opaque RGB image, with the JPEG EXIF orientation applied (a phone photo is stored sideways and turned by a
 * flag) and transparency flattened onto white. Too large images are refused before their pixels are allocated.
 */
public final class ImageDecoder {

    /** Pixel limit of a decoded photo (6000 x 6000, the upload limit). */
    public static final long MAX_PIXELS = 36_000_000L;

    static {
        // In the Spring Boot jar the WebP reader is in a nested jar: register it explicitly.
        ImageIO.scanForPlugins();
    }

    private ImageDecoder() {
    }

    /** The photo as {@link BufferedImage#TYPE_INT_RGB}, upright. */
    public static BufferedImage decode(byte[] bytes) throws IOException {
        BufferedImage raw;
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new IOException("Unsupported image format");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels <= 0 || pixels > MAX_PIXELS) {
                    throw new IOException("Image is too large: " + reader.getWidth(0) + "x" + reader.getHeight(0));
                }
                raw = reader.read(0);
            } finally {
                reader.dispose();
            }
        }
        return orient(toRgb(raw), exifOrientation(bytes));
    }

    /** Copy as opaque RGB; transparent pixels become white. */
    public static BufferedImage toRgb(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB) {
            return image;
        }
        BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setColor(java.awt.Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());
        g.drawImage(image, 0, 0, null);
        g.dispose();
        return rgb;
    }

    /** Bilinear resize to exactly {@code width} x {@code height}. */
    public static BufferedImage resize(BufferedImage image, int width, int height) {
        BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(image, 0, 0, width, height, null);
        g.dispose();
        return out;
    }

    /** Applies an EXIF orientation value (1-8); other values leave the image as it is. */
    static BufferedImage orient(BufferedImage image, int orientation) {
        if (orientation < 2 || orientation > 8) {
            return image;
        }
        int w = image.getWidth();
        int h = image.getHeight();
        boolean swap = orientation >= 5;
        AffineTransform t = new AffineTransform();
        switch (orientation) {
            case 2 -> { t.translate(w, 0); t.scale(-1, 1); }
            case 3 -> { t.translate(w, h); t.rotate(Math.PI); }
            case 4 -> { t.translate(0, h); t.scale(1, -1); }
            case 5 -> { t.rotate(-Math.PI / 2); t.scale(-1, 1); }
            case 6 -> { t.translate(h, 0); t.rotate(Math.PI / 2); }
            case 7 -> { t.scale(-1, 1); t.translate(-h, 0); t.translate(0, w); t.rotate(3 * Math.PI / 2); }
            case 8 -> { t.translate(0, w); t.rotate(3 * Math.PI / 2); }
            default -> { }
        }
        BufferedImage out = new BufferedImage(swap ? h : w, swap ? w : h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(image, t, null);
        g.dispose();
        return out;
    }

    /** EXIF orientation of a JPEG (1 when absent or not a JPEG). Reads only the APP1 segment headers. */
    static int exifOrientation(byte[] b) {
        if (b.length < 4 || (b[0] & 0xFF) != 0xFF || (b[1] & 0xFF) != 0xD8) {
            return 1;
        }
        int pos = 2;
        while (pos + 4 <= b.length && (b[pos] & 0xFF) == 0xFF) {
            int marker = b[pos + 1] & 0xFF;
            int length = ((b[pos + 2] & 0xFF) << 8) | (b[pos + 3] & 0xFF);
            if (marker == 0xDA || length < 2) {
                return 1;
            }
            int start = pos + 4;
            if (marker == 0xE1 && start + 6 <= b.length && b[start] == 'E' && b[start + 1] == 'x'
                    && b[start + 2] == 'i' && b[start + 3] == 'f') {
                return tiffOrientation(b, start + 6, Math.min(b.length, pos + 2 + length));
            }
            pos += 2 + length;
        }
        return 1;
    }

    private static int tiffOrientation(byte[] b, int tiff, int end) {
        if (tiff + 8 > end) {
            return 1;
        }
        boolean little = b[tiff] == 'I' && b[tiff + 1] == 'I';
        int ifd = tiff + (int) read(b, tiff + 4, 4, little);
        if (ifd < tiff || ifd + 2 > end) {
            return 1;
        }
        int entries = (int) read(b, ifd, 2, little);
        for (int i = 0; i < entries; i++) {
            int entry = ifd + 2 + i * 12;
            if (entry + 12 > end) {
                return 1;
            }
            if (read(b, entry, 2, little) == 0x0112) {
                int value = (int) read(b, entry + 8, 2, little);
                return value >= 1 && value <= 8 ? value : 1;
            }
        }
        return 1;
    }

    private static long read(byte[] b, int at, int bytes, boolean little) {
        long value = 0;
        for (int i = 0; i < bytes; i++) {
            int v = b[at + i] & 0xFF;
            value = little ? value | ((long) v << (8 * i)) : (value << 8) | v;
        }
        return value;
    }
}
