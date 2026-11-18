package az.jeparla.ai.studio;

import az.jeparla.common.onnx.ImageDecoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * The studio look pipeline from the command line, the same code as the API's STUDIO_LOOK processor (#119). Used
 * for the demo catalog photos in {@code frontend/public/demo/}; no Spring, no database.
 *
 * <pre>
 * ./gradlew studioLook --args="--out build/studio --size 800x1000 ../frontend/public/demo/ring-gold-1.jpg"
 * </pre>
 *
 * Options: {@code --model isnet|u2netp} (default isnet), {@code --models-dir} (default
 * {@code build/models}), {@code --size WxH} (default: from the item), {@code --threads N}, {@code --out DIR}.
 */
public final class StudioLookCli {

    private StudioLookCli() {
    }

    public static void main(String[] args) throws Exception {
        SegmentationModel model = SegmentationModel.ISNET;
        Path modelsDir = Path.of("build", "models");
        Path out = Path.of("build", "studio");
        StudioComposer.Size size = StudioComposer.Size.AUTO;
        int threads = Runtime.getRuntime().availableProcessors();
        List<Path> inputs = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--model" -> model = SegmentationModel.of(args[++i]);
                case "--models-dir" -> modelsDir = Path.of(args[++i]);
                case "--out" -> out = Path.of(args[++i]);
                case "--threads" -> threads = Integer.parseInt(args[++i]);
                case "--size" -> {
                    String[] parts = args[++i].split("x");
                    size = new StudioComposer.Size(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
                }
                default -> inputs.add(Path.of(args[i]));
            }
        }
        if (inputs.isEmpty()) {
            System.err.println("Usage: StudioLookCli [--model isnet|u2netp] [--size 800x1000] [--out DIR] photo...");
            System.exit(2);
        }
        Files.createDirectories(out);
        Path file = model.file().ensure(modelsDir);
        try (OnnxSegmenter segmenter = new OnnxSegmenter(model, file, threads)) {
            StudioComposer composer = new StudioComposer(segmenter);
            for (Path input : inputs) {
                long started = System.nanoTime();
                byte[] jpeg = composer.compose(ImageDecoder.decode(Files.readAllBytes(input)), size);
                Path target = out.resolve(input.getFileName().toString().replaceAll("\\.[A-Za-z]+$", "") + ".jpg");
                Files.write(target, jpeg);
                System.out.printf("%s -> %s (%d ms)%n", input.getFileName(), target,
                        (System.nanoTime() - started) / 1_000_000);
            }
        }
    }
}
