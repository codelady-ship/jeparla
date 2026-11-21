package az.jeparla.search.embedding;

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
 * DINOv2 small on ONNX Runtime, CPU (#163). Preprocessing as the model was trained: shortest side 256, centre
 * crop 224, ImageNet mean and std. The embedding is the class token joined with the mean of the patch tokens
 * (768 values), L2-normalised, so cosine similarity is a dot product.
 */
public final class OnnxDinoEncoder implements ImageEncoder, AutoCloseable {

    static final int RESIZE = 256;
    static final int CROP = 224;
    private static final float[] MEAN = {0.485f, 0.456f, 0.406f};
    private static final float[] STD = {0.229f, 0.224f, 0.225f};

    private final OrtEnvironment env;
    private final OrtSession session;
    private final String inputName;

    public OnnxDinoEncoder(Path file, int threads) throws IOException {
        env = OrtEnvironment.getEnvironment();
        try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
            options.setIntraOpNumThreads(Math.max(1, threads));
            options.setInterOpNumThreads(1);
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            session = env.createSession(file.toString(), options);
            inputName = session.getInputNames().iterator().next();
        } catch (OrtException e) {
            throw new IOException("Could not load the image search model", e);
        }
    }

    /** Shortest side to {@value #RESIZE}, centre {@value #CROP} x {@value #CROP}, normalised, CHW order. */
    static float[] preprocess(BufferedImage photo) {
        int w = photo.getWidth();
        int h = photo.getHeight();
        double scale = (double) RESIZE / Math.min(w, h);
        int rw = Math.max(CROP, (int) Math.round(w * scale));
        int rh = Math.max(CROP, (int) Math.round(h * scale));
        BufferedImage resized = ImageDecoder.resize(photo, rw, rh);
        int x0 = (rw - CROP) / 2;
        int y0 = (rh - CROP) / 2;
        int[] rgb = resized.getRGB(x0, y0, CROP, CROP, null, 0, CROP);
        int plane = CROP * CROP;
        float[] chw = new float[3 * plane];
        for (int i = 0; i < plane; i++) {
            int p = rgb[i];
            chw[i] = (((p >> 16) & 0xFF) / 255f - MEAN[0]) / STD[0];
            chw[plane + i] = (((p >> 8) & 0xFF) / 255f - MEAN[1]) / STD[1];
            chw[2 * plane + i] = ((p & 0xFF) / 255f - MEAN[2]) / STD[2];
        }
        return chw;
    }

    /** Class token joined with the mean patch token, L2-normalised. {@code tokens}: [tokens x dim], row major. */
    static float[] pool(float[] tokens, int count, int dim) {
        float[] out = new float[2 * dim];
        System.arraycopy(tokens, 0, out, 0, dim);
        for (int t = 1; t < count; t++) {
            for (int d = 0; d < dim; d++) {
                out[dim + d] += tokens[t * dim + d];
            }
        }
        for (int d = 0; d < dim; d++) {
            out[dim + d] /= Math.max(1, count - 1);
        }
        double norm = 0;
        for (float v : out) {
            norm += (double) v * v;
        }
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < out.length; i++) {
                out[i] = (float) (out[i] / norm);
            }
        }
        return out;
    }

    @Override
    public float[] encode(BufferedImage photo) throws IOException {
        float[] input = preprocess(photo);
        try (OnnxTensor tensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), new long[] {1, 3, CROP, CROP});
                OrtSession.Result result = session.run(Map.of(inputName, tensor))) {
            OnnxTensor hidden = (OnnxTensor) result.get("last_hidden_state").orElse(result.get(0));
            long[] shape = hidden.getInfo().getShape();
            int count = (int) shape[1];
            int dim = (int) shape[2];
            float[] tokens = new float[count * dim];
            hidden.getFloatBuffer().get(tokens);
            return pool(tokens, count, dim);
        } catch (OrtException e) {
            throw new IOException("Image search model failed", e);
        }
    }

    @Override
    public void close() {
        try {
            session.close();
        } catch (OrtException e) {
            // Shutdown.
        }
    }
}
