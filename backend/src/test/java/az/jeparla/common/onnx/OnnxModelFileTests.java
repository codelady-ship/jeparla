package az.jeparla.common.onnx;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Pinned model files (#119, #163): a tiny local file stands in for the real download, CI fetches nothing. */
class OnnxModelFileTests {

    @TempDir
    Path temp;

    private Path source(String content) throws IOException {
        Path file = temp.resolve("source.bin");
        Files.writeString(file, content, StandardCharsets.UTF_8);
        return file;
    }

    @Test
    void downloadsOnceAndChecksTheHash() throws IOException {
        Path source = source("model weights");
        String hash = OnnxModelFile.sha256Of(source);
        OnnxModelFile model = new OnnxModelFile("tiny.onnx", source.toUri().toString(), hash, 1000);
        Path dir = temp.resolve("models");

        Path file = model.ensure(dir);

        assertThat(file).hasFileName("tiny.onnx").hasContent("model weights");
        assertThat(model.shortHash()).hasSize(12).isEqualTo(hash.substring(0, 12));
        // Second start: the verified file is used as it is, even when the source is gone.
        Files.delete(source);
        assertThat(model.ensure(dir)).isEqualTo(file);
    }

    @Test
    void aWrongHashIsRefusedAndNothingIsLeftBehind() throws IOException {
        Path source = source("tampered");
        OnnxModelFile model = new OnnxModelFile("tiny.onnx", source.toUri().toString(), "0".repeat(64), 1000);
        Path dir = temp.resolve("models");

        assertThatThrownBy(() -> model.ensure(dir)).isInstanceOf(IOException.class).hasMessageContaining("SHA-256");
        try (var files = Files.list(dir)) {
            assertThat(files).isEmpty();
        }
    }

    @Test
    void aDamagedLocalFileIsReplaced() throws IOException {
        Path source = source("good weights");
        OnnxModelFile model = new OnnxModelFile("tiny.onnx", source.toUri().toString(),
                OnnxModelFile.sha256Of(source), 1000);
        Path dir = Files.createDirectories(temp.resolve("models"));
        Files.writeString(dir.resolve("tiny.onnx"), "damaged");

        assertThat(model.ensure(dir)).hasContent("good weights");
    }

    @Test
    void theSizeLimitHolds() throws IOException {
        Path source = source("x".repeat(100));
        OnnxModelFile model = new OnnxModelFile("tiny.onnx", source.toUri().toString(),
                OnnxModelFile.sha256Of(source), 10);

        assertThatThrownBy(() -> model.ensure(temp.resolve("models"))).hasMessageContaining("larger than");
    }

    @Test
    void namesAndHashesAreValidated() {
        assertThatThrownBy(() -> new OnnxModelFile("../x.onnx", "https://example.org/x", "0".repeat(64), 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new OnnxModelFile("x.onnx", "https://example.org/x", "abc", 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
