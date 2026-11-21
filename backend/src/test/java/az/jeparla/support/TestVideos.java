package az.jeparla.support;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

/**
 * Smallest MP4 and WebM files with a real container structure (#117): the boxes and elements a player reads
 * before the frames, and no frames. Enough for the server-side check, which reads only the container.
 */
public final class TestVideos {

    private TestVideos() {
    }

    // ------------------------------------------------------------------ MP4

    /** An H.264 MP4 with its index ({@code moov}) before the frames, as an encoder with "fast start" writes it. */
    public static byte[] mp4(long durationMs, int width, int height) {
        return mp4("isom", "avc1", durationMs, width, height, false);
    }

    /**
     * @param brand    major brand of the {@code ftyp} box ({@code isom}, {@code mp42}, {@code qt  })
     * @param codec    sample entry of the video track ({@code avc1} is H.264, {@code hvc1} HEVC)
     * @param moovLast the index after the frames, as a phone camera writes it
     */
    public static byte[] mp4(String brand, String codec, long durationMs, int width, int height, boolean moovLast) {
        byte[] ftyp = box("ftyp", ascii(brand), u32(0), ascii(brand));
        byte[] mdat = box("mdat", new byte[64]);
        byte[] moov = box("moov", mvhd(durationMs), track("vide", codec, width, height),
                track("soun", "mp4a", 0, 0));
        return moovLast ? concat(ftyp, mdat, moov) : concat(ftyp, moov, mdat);
    }

    /** Version 0: creation, modification, timescale (1000: the duration is in milliseconds), duration. */
    private static byte[] mvhd(long durationMs) {
        return box("mvhd", u32(0), u32(0), u32(0), u32(1000), u32(durationMs), new byte[80]);
    }

    private static byte[] track(String handler, String codec, int width, int height) {
        byte[] tkhd = box("tkhd", u32(0), new byte[72], u32((long) width << 16), u32((long) height << 16));
        byte[] hdlr = box("hdlr", u32(0), u32(0), ascii(handler), new byte[12], new byte[1]);
        byte[] entry = concat(u32(16), ascii(codec), new byte[8]);
        byte[] stsd = box("stsd", u32(0), u32(1), entry);
        return box("trak", tkhd, box("mdia", hdlr, box("minf", box("stbl", stsd))));
    }

    private static byte[] box(String type, byte[]... parts) {
        byte[] body = concat(parts);
        return concat(u32(8L + body.length), ascii(type), body);
    }

    // ------------------------------------------------------------------ WebM

    /** A VP9 WebM with a duration, as an encoder writes it. */
    public static byte[] webm(long durationMs, int width, int height) {
        return webm("webm", "V_VP9", (double) durationMs, width, height);
    }

    /**
     * @param docType  {@code webm}, or {@code matroska} for an MKV
     * @param codec    codec id of the video track ({@code V_VP8}, {@code V_VP9}, {@code V_AV1})
     * @param duration in milliseconds (the timestamp scale is 1 ms); null leaves the element out, as a browser
     *                 recorder does
     */
    public static byte[] webm(String docType, String codec, Double duration, int width, int height) {
        byte[] header = element(0x1A45DFA3L, element(0x4282, ascii(docType)));
        byte[] scale = element(0x2AD7B1, new byte[] {0x0F, 0x42, 0x40});
        byte[] info = duration == null ? element(0x1549A966L, scale)
                : element(0x1549A966L, scale, element(0x4489, ByteBuffer.allocate(8).putDouble(duration).array()));
        byte[] video = element(0xAE, element(0x83, new byte[] {1}), element(0x86, ascii(codec)),
                element(0xE0, element(0xB0, u16(width)), element(0xBA, u16(height))));
        byte[] audio = element(0xAE, element(0x83, new byte[] {2}), element(0x86, ascii("A_OPUS")));
        byte[] cluster = element(0x1F43B675L, new byte[32]);
        return concat(header, element(0x18538067L, info, element(0x1654AE6BL, video, audio), cluster));
    }

    /** An EBML element: the id as it is written (marker included) and an 8-byte size. */
    private static byte[] element(long id, byte[]... parts) {
        byte[] body = concat(parts);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        boolean started = false;
        for (int shift = 24; shift >= 0; shift -= 8) {
            int b = (int) (id >>> shift) & 0xFF;
            if (b != 0 || started) {
                out.write(b);
                started = true;
            }
        }
        out.write(0x01);
        for (int shift = 48; shift >= 0; shift -= 8) {
            out.write((int) ((long) body.length >>> shift) & 0xFF);
        }
        out.writeBytes(body);
        return out.toByteArray();
    }

    // ------------------------------------------------------------------ helpers

    private static byte[] ascii(String text) {
        return text.getBytes(StandardCharsets.US_ASCII);
    }

    private static byte[] u16(int value) {
        return new byte[] {(byte) (value >>> 8), (byte) value};
    }

    private static byte[] u32(long value) {
        return ByteBuffer.allocate(4).putInt((int) value).array();
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.writeBytes(part);
        }
        return out.toByteArray();
    }
}
