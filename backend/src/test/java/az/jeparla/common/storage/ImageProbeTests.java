package az.jeparla.common.storage;

import static org.assertj.core.api.Assertions.assertThat;

import az.jeparla.common.storage.ImageProbe.ImageInfo;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/** The server-side MIME check of uploaded photos (#39): magic numbers and header sizes, never the name. */
class ImageProbeTests {

    @Test
    void realPngAndJpegFilesAreRecognisedWithTheirSize() throws IOException {
        assertThat(ImageProbe.probe(encode("png", 640, 480))).contains(new ImageInfo("image/png", 640, 480));
        assertThat(ImageProbe.probe(encode("jpg", 300, 200))).contains(new ImageInfo("image/jpeg", 300, 200));
    }

    @Test
    void jpegSizeIsFoundAfterLargeMetadataSegments() {
        byte[] app1 = new byte[4 + 60_000];
        app1[0] = (byte) 0xFF;
        app1[1] = (byte) 0xE1;
        app1[2] = (byte) ((60_002 >> 8) & 0xFF);
        app1[3] = (byte) (60_002 & 0xFF);
        byte[] sof = {(byte) 0xFF, (byte) 0xC2, 0, 17, 8, 0x0B, (byte) 0xB8, 0x0F, (byte) 0xA0, 3};
        byte[] file = concat(new byte[] {(byte) 0xFF, (byte) 0xD8}, Arrays.copyOf(app1, 2 + 60_002), sof);
        assertThat(ImageProbe.probe(file)).contains(new ImageInfo("image/jpeg", 4000, 3000));
    }

    @Test
    void webpVariantsAreRecognised() {
        // Extended (VP8X): 24-bit width - 1 and height - 1.
        byte[] vp8x = webp("VP8X", new byte[] {0, 0, 0, 0, (byte) 0xFF, 0x03, 0, (byte) 0x1F, 0x03, 0});
        assertThat(ImageProbe.probe(vp8x)).contains(new ImageInfo("image/webp", 1024, 800));
        // Lossless (VP8L): 14 bits width - 1, 14 bits height - 1 after the 0x2F signature.
        int bits = 99 | 49 << 14;
        byte[] vp8l = webp("VP8L", new byte[] {0x2F, (byte) bits, (byte) (bits >> 8), (byte) (bits >> 16),
                (byte) (bits >> 24), 0, 0, 0, 0, 0});
        assertThat(ImageProbe.probe(vp8l)).contains(new ImageInfo("image/webp", 100, 50));
        // Lossy (VP8): frame tag, start code 9D 01 2A, 14-bit width and height.
        byte[] vp8 = webp("VP8 ", new byte[] {0, 0, 0, (byte) 0x9D, 0x01, 0x2A, (byte) 0x80, 0x02, (byte) 0xE0, 0x01});
        assertThat(ImageProbe.probe(vp8)).contains(new ImageInfo("image/webp", 640, 480));
    }

    @Test
    void otherFilesAreNotImages() {
        assertThat(ImageProbe.probe("GIF89a....................................".getBytes(StandardCharsets.US_ASCII)))
                .isEmpty();
        assertThat(ImageProbe.probe("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8)))
                .isEmpty();
        assertThat(ImageProbe.probe("%PDF-1.7 not an image at all, really not".getBytes(StandardCharsets.US_ASCII)))
                .isEmpty();
        assertThat(ImageProbe.probe(new byte[0])).isEmpty();
        assertThat(ImageProbe.probe(null)).isEmpty();
    }

    @Test
    void truncatedOrZeroSizedHeadersAreRejected() throws IOException {
        byte[] png = encode("png", 10, 10);
        assertThat(ImageProbe.probe(Arrays.copyOf(png, 20))).isEmpty();
        byte[] zeroWidth = png.clone();
        Arrays.fill(zeroWidth, 16, 20, (byte) 0);
        assertThat(ImageProbe.probe(zeroWidth)).isEmpty();
        assertThat(ImageProbe.probe(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9})).isEmpty();
    }

    static byte[] encode(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    private static byte[] webp(String chunk, byte[] data) {
        byte[] header = concat("RIFF".getBytes(StandardCharsets.US_ASCII), new byte[] {0, 0, 0, 0},
                "WEBP".getBytes(StandardCharsets.US_ASCII), chunk.getBytes(StandardCharsets.US_ASCII),
                new byte[] {(byte) data.length, 0, 0, 0});
        return concat(header, data);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.writeBytes(part);
        }
        return out.toByteArray();
    }
}
