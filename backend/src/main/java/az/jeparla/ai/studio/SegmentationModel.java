package az.jeparla.ai.studio;

import az.jeparla.common.onnx.OnnxModelFile;
import java.util.Locale;

/**
 * Background removal models the studio look processor can run (#119): salient object segmentation, not
 * generation. Each returns a soft mask of the item; the item's pixels are never changed by the model. All have a
 * licence that allows commercial use (docs/ai-providers.md, "Studiya görünüşü").
 *
 * <p>Files are the ONNX exports published as release assets of the rembg project (MIT), pinned by SHA-256.
 */
public enum SegmentationModel {

    /** IS-Net general use (DIS, Apache-2.0): 1024 px input, 179 MB, fine edges (chains). The default. */
    ISNET("isnet", new OnnxModelFile("isnet-general-use.onnx",
            "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
            "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a", 200_000_000L),
            1024, new float[] {0.5f, 0.5f, 0.5f}, new float[] {1f, 1f, 1f}, false),

    /** U2-Net-p (Apache-2.0): 320 px input, 4.6 MB, fast and coarse; for very small machines. */
    U2NETP("u2netp", new OnnxModelFile("u2netp.onnx",
            "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
            "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8", 10_000_000L),
            320, new float[] {0.485f, 0.456f, 0.406f}, new float[] {0.229f, 0.224f, 0.225f}, false);

    private final String id;
    private final OnnxModelFile file;
    private final int inputSize;
    private final float[] mean;
    private final float[] std;
    private final boolean logits;

    SegmentationModel(String id, OnnxModelFile file, int inputSize, float[] mean, float[] std, boolean logits) {
        this.id = id;
        this.file = file;
        this.inputSize = inputSize;
        this.mean = mean;
        this.std = std;
        this.logits = logits;
    }

    public String id() {
        return id;
    }

    public OnnxModelFile file() {
        return file;
    }

    /** Square input side in pixels. */
    public int inputSize() {
        return inputSize;
    }

    float mean(int channel) {
        return mean[channel];
    }

    float std(int channel) {
        return std[channel];
    }

    /** Whether the first output is a logit (needs a sigmoid) rather than a probability. */
    boolean logits() {
        return logits;
    }

    /** The model with this id ({@code jeparla.ai.studio.model}). */
    public static SegmentationModel of(String id) {
        String wanted = id == null ? "" : id.strip().toLowerCase(Locale.ROOT);
        for (SegmentationModel model : values()) {
            if (model.id.equals(wanted)) {
                return model;
            }
        }
        throw new IllegalArgumentException("Unknown studio segmentation model: " + id + " (isnet or u2netp)");
    }
}
