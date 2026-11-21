package az.jeparla.ai.studio;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import az.jeparla.common.onnx.ImageDecoder;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.FloatBuffer;
import java.nio.file.Path;
import java.util.Map;

/**
 * {@link Segmenter} on ONNX Runtime, CPU only. The model sees the photo resized to its square input; its mask is
 * scaled back to the photo with bilinear interpolation and stretched to 0..1 (as the model authors do).
 * One inference at a time: the API shares two cores with the database, so jobs queue instead of competing.
 */
public final class OnnxSegmenter implements Segmenter, AutoCloseable {

    private final SegmentationModel model;
    private final OrtEnvironment env;
    private final OrtSession session;
    private final String inputName;

    public OnnxSegmenter(SegmentationModel model, Path file, int threads) throws IOException {
        this.model = model;
        this.env = OrtEnvironment.getEnvironment();
        try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
            options.setIntraOpNumThreads(Math.max(1, threads));
            options.setInterOpNumThreads(1);
            // Memory goes back to the system after each photo instead of staying in ONNX Runtime's arena.
            options.setCPUArenaAllocator(false);
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            this.session = env.createSession(file.toString(), options);
            this.inputName = session.getInputNames().iterator().next();
        } catch (OrtException e) {
            throw new IOException("Could not load segmentation model " + model.id(), e);
        }
    }

    @Override
    public synchronized float[] mask(BufferedImage image) throws IOException {
        int size = model.inputSize();
        BufferedImage input = ImageDecoder.resize(image, size, size);
        float[] chw = new float[3 * size * size];
        int[] rgb = input.getRGB(0, 0, size, size, null, 0, size);
        float max = 1e-6f;
        for (int p : rgb) {
            max = Math.max(max, Math.max((p >> 16) & 0xFF, Math.max((p >> 8) & 0xFF, p & 0xFF)) / 255f);
        }
        int plane = size * size;
        for (int i = 0; i < plane; i++) {
            int p = rgb[i];
            chw[i] = (((p >> 16) & 0xFF) / 255f / max - model.mean(0)) / model.std(0);
            chw[plane + i] = (((p >> 8) & 0xFF) / 255f / max - model.mean(1)) / model.std(1);
            chw[2 * plane + i] = ((p & 0xFF) / 255f / max - model.mean(2)) / model.std(2);
        }
        float[] small;
        try (OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(chw), new long[] {1, 3, size, size});
                OrtSession.Result result = session.run(Map.of(inputName, tensor))) {
            OnnxTensor out = (OnnxTensor) result.get(0);
            FloatBuffer buffer = out.getFloatBuffer();
            small = new float[plane];
            buffer.get(small, 0, plane);
        } catch (OrtException e) {
            throw new IOException("Segmentation model " + model.id() + " failed", e);
        }
        if (model.logits()) {
            for (int i = 0; i < plane; i++) {
                small[i] = (float) (1 / (1 + Math.exp(-small[i])));
            }
        }
        float lo = Float.MAX_VALUE;
        float hi = -Float.MAX_VALUE;
        for (float v : small) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
        }
        float range = Math.max(hi - lo, 1e-6f);
        for (int i = 0; i < plane; i++) {
            small[i] = (small[i] - lo) / range;
        }
        return upscale(small, size, image.getWidth(), image.getHeight());
    }

    /** Bilinear resize of a {@code size x size} mask to {@code width x height}. */
    static float[] upscale(float[] mask, int size, int width, int height) {
        float[] out = new float[width * height];
        float sx = (float) size / width;
        float sy = (float) size / height;
        for (int y = 0; y < height; y++) {
            float fy = Math.max(0, (y + 0.5f) * sy - 0.5f);
            int y0 = Math.min((int) fy, size - 1);
            int y1 = Math.min(y0 + 1, size - 1);
            float wy = fy - y0;
            for (int x = 0; x < width; x++) {
                float fx = Math.max(0, (x + 0.5f) * sx - 0.5f);
                int x0 = Math.min((int) fx, size - 1);
                int x1 = Math.min(x0 + 1, size - 1);
                float wx = fx - x0;
                float top = mask[y0 * size + x0] * (1 - wx) + mask[y0 * size + x1] * wx;
                float bottom = mask[y1 * size + x0] * (1 - wx) + mask[y1 * size + x1] * wx;
                out[y * width + x] = top * (1 - wy) + bottom * wy;
            }
        }
        return out;
    }

    @Override
    public void close() {
        try {
            session.close();
        } catch (OrtException e) {
            // Closing at shutdown; nothing to do.
        }
    }
}
