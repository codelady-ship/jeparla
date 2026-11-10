package az.jeparla.verification;

import java.util.Optional;

/**
 * The type of an uploaded document from its first bytes (magic numbers), never from the file name or the
 * {@code Content-Type} the browser sent: PDF ({@code %PDF-}), PNG (signature and IHDR) or JPEG (SOI and a
 * marker). Anything else, an SVG or an HTML page renamed to {@code .pdf} for example, is empty.
 */
final class DocumentProbe {

    /** Bytes to read from the start of a file. */
    static final int HEADER_BYTES = 1024;

    private static final byte[] PDF = {'%', 'P', 'D', 'F', '-'};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};

    private DocumentProbe() {
    }

    static Optional<String> contentType(byte[] bytes) {
        if (bytes == null) {
            return Optional.empty();
        }
        if (startsWith(bytes, PDF)) {
            return Optional.of("application/pdf");
        }
        if (bytes.length >= 16 && startsWith(bytes, PNG)
                && bytes[12] == 'I' && bytes[13] == 'H' && bytes[14] == 'D' && bytes[15] == 'R') {
            return Optional.of("image/png");
        }
        if (bytes.length >= 4 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return Optional.of("image/jpeg");
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
