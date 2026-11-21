package az.jeparla.common.onnx;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class ImageDecoderTests {

    /** A 40 x 20 image: left half red, right half blue. */
    private static BufferedImage sample() {
        BufferedImage image = new BufferedImage(40, 20, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 20; y++) {
            for (int x = 0; x < 40; x++) {
                image.setRGB(x, y, x < 20 ? 0xFF0000 : 0x0000FF);
            }
        }
        return image;
    }

    private static byte[] encode(BufferedImage image, String format) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    /** The JPEG with an APP1 Exif segment (big-endian TIFF, one IFD entry: orientation) after the start marker. */
    private static byte[] withOrientation(byte[] jpeg, int orientation) {
        byte[] tiff = {
            'M', 'M', 0, 42, 0, 0, 0, 8,
            0, 1,
            0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, (byte) orientation, 0, 0,
            0, 0, 0, 0,
        };
        int length = 2 + 6 + tiff.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        out.write(0xFF);
        out.write(0xE1);
        out.write(length >> 8);
        out.write(length & 0xFF);
        out.writeBytes(new byte[] {'E', 'x', 'i', 'f', 0, 0});
        out.writeBytes(tiff);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    @Test
    void decodesPngAndJpeg() throws IOException {
        assertThat(ImageDecoder.decode(encode(sample(), "png")).getWidth()).isEqualTo(40);
        BufferedImage jpeg = ImageDecoder.decode(encode(sample(), "jpeg"));
        assertThat(jpeg.getType()).isEqualTo(BufferedImage.TYPE_INT_RGB);
        assertThat(jpeg.getHeight()).isEqualTo(20);
    }

    @Test
    void appliesTheExifOrientation() throws IOException {
        byte[] jpeg = withOrientation(encode(sample(), "jpeg"), 6);
        assertThat(ImageDecoder.exifOrientation(jpeg)).isEqualTo(6);

        BufferedImage upright = ImageDecoder.decode(jpeg);

        // Turned 90 degrees clockwise: the red left half is now on top.
        assertThat(upright.getWidth()).isEqualTo(20);
        assertThat(upright.getHeight()).isEqualTo(40);
        assertThat((upright.getRGB(10, 5) >> 16) & 0xFF).isGreaterThan(200);
        assertThat(upright.getRGB(10, 35) & 0xFF).isGreaterThan(200);
    }

    @Test
    void everyOrientationKeepsAllPixels() {
        for (int orientation = 1; orientation <= 8; orientation++) {
            BufferedImage turned = ImageDecoder.orient(sample(), orientation);
            int red = 0;
            for (int y = 0; y < turned.getHeight(); y++) {
                for (int x = 0; x < turned.getWidth(); x++) {
                    red += ((turned.getRGB(x, y) >> 16) & 0xFF) > 200 ? 1 : 0;
                }
            }
            assertThat(red).as("orientation %d", orientation).isEqualTo(400);
        }
    }

    @Test
    void refusesWhatIsNotAnImage() {
        assertThatThrownBy(() -> ImageDecoder.decode("not an image".getBytes())).isInstanceOf(IOException.class);
        assertThat(ImageDecoder.exifOrientation(new byte[] {1, 2, 3})).isEqualTo(1);
    }
}
