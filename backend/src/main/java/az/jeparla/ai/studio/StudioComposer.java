package az.jeparla.ai.studio;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Arrays;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

/**
 * The studio look (#119, docs/DESIGN.md "Məhsul şəkli standartı"), without generation: the item is cut out with
 * a segmentation mask and placed, unchanged in shape, colour and stones, on the uniform cream background, centred,
 * about 70% of a 4:5 frame, with a soft shadow under it. The only change to the item's own pixels is one global
 * exposure factor (0.92-1.15, the same for all three channels, so hue is kept) so that a dark and a bright photo
 * end up in similar light; edge pixels lose the colour of the old background (they are not redrawn).
 *
 * <p>Pure Java, no model: the mask comes from a {@link Segmenter}. Deterministic for the same input.
 */
public final class StudioComposer {

    /** Cream background, {@code --background} of docs/design/tokens.json ({@code #F7F3EA}). */
    static final int BACKGROUND = 0xF7F3EA;
    /** Warm dark shadow tone (not black: a black shadow looks grey on cream). */
    private static final int SHADOW = 0x3B3226;
    private static final float SHADOW_OPACITY = 0.26f;
    /** Share of the frame the item fills along its tighter side. */
    static final float FILL = 0.70f;
    /** Photos are processed at most this long (the stored original keeps its full size). */
    static final int MAX_WORK_SIDE = 2000;
    static final int MIN_OUTPUT_WIDTH = 800;
    static final int MAX_OUTPUT_WIDTH = 1600;
    /** Below this share of the photo the mask is treated as "no item found". */
    static final float MIN_ITEM_SHARE = 0.002f;
    /** Mark in the JPEG comment: the file is a processed photo, not the original and not generated. */
    static final String COMMENT = "Jeparla studio look (#119): background replaced, item not generated or redrawn";

    private final Segmenter segmenter;

    public StudioComposer(Segmenter segmenter) {
        this.segmenter = segmenter;
    }

    /** Output size: {@code width x height} (4:5), or 0 x 0 to pick it from the item's size. */
    public record Size(int width, int height) {

        public static final Size AUTO = new Size(0, 0);
    }

    /** The finished JPEG. */
    public byte[] compose(BufferedImage photo, Size size) throws IOException {
        return encodeJpeg(render(photo, size), 0.92f);
    }

    /** The finished image. */
    public BufferedImage render(BufferedImage photo, Size size) throws IOException {
        BufferedImage work = limit(photo);
        int w = work.getWidth();
        int h = work.getHeight();
        float[] alpha = segmenter.mask(work);
        if (alpha.length != w * h) {
            throw new IOException("Mask size does not match the photo");
        }
        alpha = refine(alpha, w, h);
        int[] box = bounds(alpha, w, h, 0.5f);
        if (box == null) {
            throw new NoItemException();
        }
        int[] pixels = work.getRGB(0, 0, w, h, null, 0, w);
        float[][] fg = decontaminate(pixels, alpha, w, h);
        float gain = exposureGain(fg, alpha);
        return place(fg, alpha, w, box, gain, size);
    }

    /** The mask found no item (or only specks): the job fails instead of returning an empty frame. */
    public static final class NoItemException extends IOException {

        NoItemException() {
            super("No item found in the photo");
        }
    }

    static BufferedImage limit(BufferedImage photo) {
        int longest = Math.max(photo.getWidth(), photo.getHeight());
        if (longest <= MAX_WORK_SIDE) {
            return az.jeparla.common.onnx.ImageDecoder.toRgb(photo);
        }
        double scale = (double) MAX_WORK_SIDE / longest;
        return az.jeparla.common.onnx.ImageDecoder.resize(photo, (int) Math.round(photo.getWidth() * scale),
                (int) Math.round(photo.getHeight() * scale));
    }

    /**
     * Cleans the soft mask: faint haze (below 0.08) becomes background, near-certain item (above 0.92) becomes
     * item, and specks far smaller than the item (dust, reflections in the old background) are dropped.
     */
    static float[] refine(float[] mask, int w, int h) {
        float[] a = new float[mask.length];
        for (int i = 0; i < mask.length; i++) {
            float v = (mask[i] - 0.08f) / 0.84f;
            a[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
        }
        int[] label = new int[a.length];
        Arrays.fill(label, -1);
        int[] sizes = new int[16];
        int count = 0;
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        for (int start = 0; start < a.length; start++) {
            if (a[start] < 0.5f || label[start] >= 0) {
                continue;
            }
            if (count == sizes.length) {
                sizes = Arrays.copyOf(sizes, count * 2);
            }
            label[start] = count;
            queue.add(start);
            int size = 0;
            while (!queue.isEmpty()) {
                int p = queue.poll();
                size++;
                int x = p % w;
                int y = p / w;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx;
                        int ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
                            continue;
                        }
                        int n = ny * w + nx;
                        if (label[n] < 0 && a[n] >= 0.5f) {
                            label[n] = count;
                            queue.add(n);
                        }
                    }
                }
            }
            sizes[count++] = size;
        }
        int largest = 0;
        for (int i = 0; i < count; i++) {
            largest = Math.max(largest, sizes[i]);
        }
        int minKeep = Math.max(4, largest / 200);
        boolean[] drop = new boolean[count];
        for (int i = 0; i < count; i++) {
            drop[i] = sizes[i] < minKeep;
        }
        for (int i = 0; i < a.length; i++) {
            if (label[i] >= 0 && drop[label[i]]) {
                a[i] = 0;
            }
        }
        return a;
    }

    /** {@code [x0, y0, x1, y1]} (exclusive end) of the mask above {@code threshold}, or null when too small. */
    static int[] bounds(float[] alpha, int w, int h, float threshold) {
        int x0 = w;
        int y0 = h;
        int x1 = -1;
        int y1 = -1;
        long area = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (alpha[y * w + x] >= threshold) {
                    area++;
                    x0 = Math.min(x0, x);
                    x1 = Math.max(x1, x);
                    y0 = Math.min(y0, y);
                    y1 = Math.max(y1, y);
                }
            }
        }
        if (area < MIN_ITEM_SHARE * w * h || x1 < 0) {
            return null;
        }
        return new int[] {x0, y0, x1 + 1, y1 + 1};
    }

    /**
     * Item colour without the old background: at an edge pixel the photo is a mix {@code a*F + (1-a)*B}; B is
     * estimated from the nearby background and F solved. Fully opaque pixels are returned unchanged.
     * Returns {@code [r, g, b]} planes in 0..255.
     */
    static float[][] decontaminate(int[] pixels, float[] alpha, int w, int h) {
        float[][] rgb = new float[3][pixels.length];
        for (int i = 0; i < pixels.length; i++) {
            rgb[0][i] = (pixels[i] >> 16) & 0xFF;
            rgb[1][i] = (pixels[i] >> 8) & 0xFF;
            rgb[2][i] = pixels[i] & 0xFF;
        }
        float[] weight = new float[pixels.length];
        for (int i = 0; i < weight.length; i++) {
            weight[i] = 1 - alpha[i];
        }
        int radius = Math.max(2, Math.max(w, h) / 60);
        float[] weightBlur = blur(weight, w, h, radius);
        for (int c = 0; c < 3; c++) {
            float[] weighted = new float[pixels.length];
            for (int i = 0; i < weighted.length; i++) {
                weighted[i] = rgb[c][i] * weight[i];
            }
            float[] background = blur(weighted, w, h, radius);
            for (int i = 0; i < weighted.length; i++) {
                float a = alpha[i];
                if (a >= 0.999f || a <= 0.01f) {
                    continue;
                }
                float b = weightBlur[i] > 1e-4f ? background[i] / weightBlur[i] : rgb[c][i];
                float f = (rgb[c][i] - (1 - a) * b) / Math.max(a, 0.15f);
                rgb[c][i] = f < 0 ? 0 : f > 255 ? 255 : f;
            }
        }
        return rgb;
    }

    /**
     * One brightness factor for the whole item: its median luminance is moved part of the way towards a common
     * level, limited to 0.92-1.15 so that no photo is changed much.
     */
    static float exposureGain(float[][] rgb, float[] alpha) {
        int[] histogram = new int[256];
        int n = 0;
        for (int i = 0; i < alpha.length; i++) {
            if (alpha[i] >= 0.9f) {
                int l = Math.round(0.2126f * rgb[0][i] + 0.7152f * rgb[1][i] + 0.0722f * rgb[2][i]);
                histogram[Math.min(255, Math.max(0, l))]++;
                n++;
            }
        }
        if (n == 0) {
            return 1f;
        }
        int seen = 0;
        int median = 0;
        for (int l = 0; l < 256; l++) {
            seen += histogram[l];
            if (seen * 2 >= n) {
                median = l;
                break;
            }
        }
        float gain = (float) Math.sqrt(150f / Math.max(median, 1));
        return Math.max(0.92f, Math.min(1.15f, gain));
    }

    private BufferedImage place(float[][] fg, float[] alpha, int w, int[] box, float gain, Size size) {
        int bw = box[2] - box[0];
        int bh = box[3] - box[1];
        int outW;
        int outH;
        if (size.width() > 0 && size.height() > 0) {
            outW = size.width();
            outH = size.height();
        } else {
            // Big enough that the item keeps its own resolution, within 800-1600 px wide.
            int needed = (int) Math.ceil(Math.max(bw / FILL, bh / FILL * 0.8f));
            outW = Math.max(MIN_OUTPUT_WIDTH, Math.min(MAX_OUTPUT_WIDTH, needed));
            outW -= outW % 4;
            outH = outW * 5 / 4;
        }
        int h = alpha.length / w;
        // A chain that runs out of the original photo must run out of the new frame on the same side too, or it
        // would end in mid-air.
        boolean left = touches(alpha, w, h, 0);
        boolean top = touches(alpha, w, h, 1);
        boolean right = touches(alpha, w, h, 2);
        boolean bottom = touches(alpha, w, h, 3);
        float scale = Math.min(limit(outW, bw, left, right), limit(outH, bh, top, bottom));
        float cx = (box[0] + box[2]) / 2f;
        float cy = (box[1] + box[3]) / 2f;
        // The item sits a little above the centre: the shadow below it balances the frame.
        float targetX = anchor(outW / 2f, outW, bw * scale, left, right);
        float targetY = anchor(outH * 0.48f, outH, bh * scale, top, bottom);
        // Premultiplied, so that resampling never mixes in the colour of background pixels.
        float[][] premultiplied = new float[3][alpha.length];
        for (int ch = 0; ch < 3; ch++) {
            for (int i = 0; i < alpha.length; i++) {
                premultiplied[ch][i] = fg[ch][i] * alpha[i];
            }
        }
        float[] a = new float[outW * outH];
        float[][] c = new float[3][outW * outH];
        for (int y = 0; y < outH; y++) {
            float sy = (y + 0.5f - targetY) / scale + cy - 0.5f;
            for (int x = 0; x < outW; x++) {
                float sx = (x + 0.5f - targetX) / scale + cx - 0.5f;
                int i = y * outW + x;
                a[i] = sample(alpha, w, h, sx, sy);
                if (a[i] > 1e-4f) {
                    for (int ch = 0; ch < 3; ch++) {
                        c[ch][i] = sample(premultiplied[ch], w, h, sx, sy) / a[i] * gain;
                    }
                }
            }
        }
        // Soft shadow: the item's own silhouette, blurred and a little lower.
        int radius = Math.max(3, outW / 70);
        float[] shadow = blur(a, outW, outH, radius);
        int drop = Math.max(2, outH / 90);
        BufferedImage out = new BufferedImage(outW, outH, BufferedImage.TYPE_INT_RGB);
        int[] row = new int[outW];
        float[] bg = {(BACKGROUND >> 16) & 0xFF, (BACKGROUND >> 8) & 0xFF, BACKGROUND & 0xFF};
        float[] sh = {(SHADOW >> 16) & 0xFF, (SHADOW >> 8) & 0xFF, SHADOW & 0xFF};
        for (int y = 0; y < outH; y++) {
            for (int x = 0; x < outW; x++) {
                int i = y * outW + x;
                int sy = y - drop;
                float s = sy >= 0 ? shadow[sy * outW + x] * SHADOW_OPACITY : 0;
                int px = 0;
                for (int ch = 0; ch < 3; ch++) {
                    float base = bg[ch] + (sh[ch] - bg[ch]) * s;
                    float v = base * (1 - a[i]) + rollOff(c[ch][i]) * a[i];
                    px = (px << 8) | Math.max(0, Math.min(255, Math.round(v)));
                }
                row[x] = px;
            }
            out.setRGB(0, y, outW, 1, row, 0, outW);
        }
        return out;
    }

    /** Largest scale along one axis: 70% of the frame when free, more when the item leaves the photo there. */
    private static float limit(int frame, int item, boolean start, boolean end) {
        float share = start && end ? 1f : start || end ? 0.85f : FILL;
        return frame * share / item;
    }

    /** Centre of the scaled item along one axis: at the frame edge on the side where it leaves the photo. */
    private static float anchor(float free, int frame, float item, boolean start, boolean end) {
        if (start == end) {
            return start ? frame / 2f : free;
        }
        return start ? item / 2f : frame - item / 2f;
    }

    /**
     * Whether the item reaches the photo's edge (0 left, 1 top, 2 right, 3 bottom): a few pixels of the outer two
     * rows or columns belong to it.
     */
    static boolean touches(float[] alpha, int w, int h, int side) {
        int hits = 0;
        int length = side % 2 == 0 ? h : w;
        for (int band = 0; band < 2; band++) {
            for (int i = 0; i < length; i++) {
                int x = switch (side) {
                    case 0 -> band;
                    case 2 -> w - 1 - band;
                    default -> i;
                };
                int y = switch (side) {
                    case 1 -> band;
                    case 3 -> h - 1 - band;
                    default -> i;
                };
                if (alpha[y * w + x] >= 0.5f) {
                    hits++;
                }
            }
        }
        return hits >= 4;
    }

    /** Highlights brightened by the exposure factor roll off softly instead of clipping flat. */
    private static float rollOff(float v) {
        if (v <= 230) {
            return v;
        }
        return 230 + 25 * (1 - (float) Math.exp(-(v - 230) / 25));
    }

    private static float sample(float[] plane, int w, int h, float x, float y) {
        if (x < -0.5f || y < -0.5f || x > w - 0.5f || y > h - 0.5f) {
            return 0;
        }
        x = Math.max(0, Math.min(w - 1, x));
        y = Math.max(0, Math.min(h - 1, y));
        int x0 = (int) x;
        int y0 = (int) y;
        int x1 = Math.min(x0 + 1, w - 1);
        int y1 = Math.min(y0 + 1, h - 1);
        float wx = x - x0;
        float wy = y - y0;
        float top = plane[y0 * w + x0] * (1 - wx) + plane[y0 * w + x1] * wx;
        float bottom = plane[y1 * w + x0] * (1 - wx) + plane[y1 * w + x1] * wx;
        return top * (1 - wy) + bottom * wy;
    }

    /** Three box blurs (close to a Gaussian) with the given radius. */
    static float[] blur(float[] plane, int w, int h, int radius) {
        float[] a = plane.clone();
        float[] b = new float[a.length];
        for (int pass = 0; pass < 3; pass++) {
            boxHorizontal(a, b, w, h, radius);
            boxVertical(b, a, w, h, radius);
        }
        return a;
    }

    private static void boxHorizontal(float[] in, float[] out, int w, int h, int r) {
        float norm = 1f / (2 * r + 1);
        for (int y = 0; y < h; y++) {
            int row = y * w;
            float sum = 0;
            for (int x = -r; x <= r; x++) {
                sum += in[row + Math.max(0, Math.min(w - 1, x))];
            }
            for (int x = 0; x < w; x++) {
                out[row + x] = sum * norm;
                sum += in[row + Math.min(w - 1, x + r + 1)] - in[row + Math.max(0, x - r)];
            }
        }
    }

    private static void boxVertical(float[] in, float[] out, int w, int h, int r) {
        float norm = 1f / (2 * r + 1);
        for (int x = 0; x < w; x++) {
            float sum = 0;
            for (int y = -r; y <= r; y++) {
                sum += in[Math.max(0, Math.min(h - 1, y)) * w + x];
            }
            for (int y = 0; y < h; y++) {
                out[y * w + x] = sum * norm;
                sum += in[Math.min(h - 1, y + r + 1) * w + x] - in[Math.max(0, y - r) * w + x];
            }
        }
    }

    /** Baseline JPEG with the studio look comment right after the start marker. */
    static byte[] encodeJpeg(BufferedImage image, float quality) throws IOException {
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ImageOutputStream out = ImageIO.createImageOutputStream(raw)) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
        byte[] jpeg = raw.toByteArray();
        byte[] text = COMMENT.getBytes(StandardCharsets.US_ASCII);
        ByteArrayOutputStream marked = new ByteArrayOutputStream(jpeg.length + text.length + 4);
        marked.write(jpeg, 0, 2);
        marked.write(0xFF);
        marked.write(0xFE);
        marked.write((text.length + 2) >> 8);
        marked.write((text.length + 2) & 0xFF);
        marked.write(text, 0, text.length);
        marked.write(jpeg, 2, jpeg.length - 2);
        return marked.toByteArray();
    }
}
