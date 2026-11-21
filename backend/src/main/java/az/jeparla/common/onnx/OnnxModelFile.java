package az.jeparla.common.onnx;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A model file that is not in the repository (#119, #163): downloaded once from a pinned URL into a local
 * directory (a Docker volume on the VM) and accepted only when its SHA-256 matches. A file already there is
 * checked again on every start, so a damaged or swapped file is never loaded.
 *
 * @param name     file name in the model directory, e.g. {@code isnet-general-use.onnx}
 * @param url      pinned download URL (a release asset or a Hugging Face file at a fixed commit)
 * @param sha256   expected SHA-256, lower-case hex
 * @param maxBytes download limit
 */
public record OnnxModelFile(String name, String url, String sha256, long maxBytes) {

    private static final Logger log = LoggerFactory.getLogger(OnnxModelFile.class);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(20);
    private static final Duration DOWNLOAD_TIMEOUT = Duration.ofMinutes(20);

    public OnnxModelFile {
        Objects.requireNonNull(name);
        Objects.requireNonNull(url);
        Objects.requireNonNull(sha256);
        if (name.isBlank() || name.contains("/") || name.contains("\\") || name.startsWith(".")) {
            throw new IllegalArgumentException("Model file name must be a plain file name: " + name);
        }
        sha256 = sha256.strip().toLowerCase(Locale.ROOT);
        if (!sha256.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("Model sha256 must be 64 hex characters");
        }
        if (maxBytes <= 0) {
            throw new IllegalArgumentException("maxBytes must be positive");
        }
    }

    /** Short model version for embedding and log names: the first 12 hex characters of the SHA-256. */
    public String shortHash() {
        return sha256.substring(0, 12);
    }

    /**
     * The verified file in {@code directory}, downloading it first when it is missing or does not match.
     *
     * @throws IOException when the download fails or the checksum does not match (the bad file is removed)
     */
    public Path ensure(Path directory) throws IOException {
        Files.createDirectories(directory);
        Path target = directory.resolve(name);
        if (Files.isRegularFile(target)) {
            if (sha256.equals(sha256Of(target))) {
                return target;
            }
            log.warn("Model file {} does not match its pinned SHA-256: downloading it again", name);
            Files.delete(target);
        }
        Path partial = Files.createTempFile(directory, name, ".part");
        try {
            download(partial);
            String actual = sha256Of(partial);
            if (!sha256.equals(actual)) {
                throw new IOException("Model file " + name + " has SHA-256 " + actual + ", expected " + sha256);
            }
            Files.move(partial, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            log.info("Model file {} downloaded ({} bytes, sha256 {})", name, Files.size(target), shortHash());
            return target;
        } finally {
            Files.deleteIfExists(partial);
        }
    }

    private void download(Path into) throws IOException {
        URI uri = URI.create(url);
        if (!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme()) && !"file".equals(uri.getScheme())) {
            throw new IOException("Unsupported model URL scheme: " + uri.getScheme());
        }
        if ("file".equals(uri.getScheme())) {
            copyLimited(Files.newInputStream(Path.of(uri)), into);
            return;
        }
        log.info("Downloading model file {} from {}", name, uri.getHost());
        try (HttpClient client = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL).build()) {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(DOWNLOAD_TIMEOUT).GET().build();
            HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                response.body().close();
                throw new IOException("Model download of " + name + " answered HTTP " + response.statusCode());
            }
            copyLimited(response.body(), into);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Model download of " + name + " was interrupted", e);
        }
    }

    private void copyLimited(InputStream source, Path into) throws IOException {
        try (InputStream in = source; OutputStream out = Files.newOutputStream(into)) {
            byte[] buffer = new byte[1 << 16];
            long total = 0;
            int read;
            while ((read = in.read(buffer)) >= 0) {
                total += read;
                if (total > maxBytes) {
                    throw new IOException("Model file " + name + " is larger than " + maxBytes + " bytes");
                }
                out.write(buffer, 0, read);
            }
        }
    }

    static String sha256Of(Path file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buffer = new byte[1 << 16];
            int read;
            while ((read = in.read(buffer)) >= 0) {
                digest.update(buffer, 0, read);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
