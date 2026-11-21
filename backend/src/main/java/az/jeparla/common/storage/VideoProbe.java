package az.jeparla.common.storage;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Reads the type, duration and frame size of a short video from its container (#117), never from the file
 * name or the {@code Content-Type} a client sent. Two containers are recognised, the ones every current
 * browser plays without a plugin:
 *
 * <ul>
 *   <li><b>MP4</b> ({@code ftyp} box first) whose video tracks are all H.264 ({@code avc1}/{@code avc3}): the
 *       duration is {@code mvhd} duration / timescale, the size comes from the {@code tkhd} of the video
 *       track. QuickTime ({@code qt  }) files and HEVC, the default of some phones, are not accepted.</li>
 *   <li><b>WebM</b> (EBML header with DocType {@code webm}) whose video tracks are VP8, VP9 or AV1: the
 *       duration is the {@code Duration} of the segment {@code Info} times its timestamp scale.</li>
 * </ul>
 *
 * <p>Nothing is decoded and no process is started. The whole file is given (at most a few megabytes): the
 * {@code moov} box of a phone recording is at its end. A header without a duration (a fragmented MP4, a WebM
 * straight from a recorder) gives {@code durationMs} 0, so the caller refuses what it cannot measure. The
 * duration is what the header says; a file that lies about it is still bound by the size limit.
 */
public final class VideoProbe {

    public static final String MP4 = "video/mp4";
    public static final String WEBM = "video/webm";

    private static final Set<String> H264 = Set.of("avc1", "avc3");
    private static final Set<String> WEBM_CODECS = Set.of("V_VP8", "V_VP9", "V_AV1");
    /** Boxes and elements nest a few levels; anything deeper is not a file a camera or an encoder wrote. */
    private static final int MAX_ITEMS = 100_000;

    private VideoProbe() {
    }

    /** @param durationMs 0 when the header states no duration */
    public record VideoInfo(String contentType, long durationMs, int width, int height) {
    }

    public static Optional<VideoInfo> probe(byte[] bytes) {
        if (bytes == null || bytes.length < 16) {
            return Optional.empty();
        }
        try {
            if (bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p') {
                return mp4(bytes);
            }
            if (u8(bytes, 0) == 0x1A && u8(bytes, 1) == 0x45 && u8(bytes, 2) == 0xDF && u8(bytes, 3) == 0xA3) {
                return webm(bytes);
            }
        } catch (IndexOutOfBoundsException | ArithmeticException e) {
            // A truncated or malformed file: not a video we accept.
        }
        return Optional.empty();
    }

    // ------------------------------------------------------------------ MP4 (ISO base media file format)

    /** What the walk over the boxes collected. */
    private static final class Mp4 {
        long timescale;
        long duration;
        int videoTracks;
        boolean otherCodec;
        int width;
        int height;
        int items;
    }

    private static Optional<VideoInfo> mp4(byte[] b) {
        String brand = ascii(b, 8, 4);
        if (brand.equals("qt  ")) {
            return Optional.empty();
        }
        Mp4 found = new Mp4();
        int moov = -1;
        int moovEnd = -1;
        int i = 0;
        while (i + 8 <= b.length) {
            long size = boxSize(b, i, b.length);
            if (size < 0) {
                return Optional.empty();
            }
            if (ascii(b, i + 4, 4).equals("moov")) {
                moov = i + headerSize(b, i);
                moovEnd = (int) (i + size);
                break;
            }
            i = Math.toIntExact(i + size);
        }
        if (moov < 0) {
            return Optional.empty();
        }
        walkMoov(b, moov, moovEnd, found);
        if (found.videoTracks == 0 || found.otherCodec || found.width <= 0 || found.height <= 0) {
            return Optional.empty();
        }
        long durationMs = found.timescale <= 0 || found.duration <= 0 || found.duration == 0xFFFFFFFFL
                ? 0 : Math.multiplyExact(found.duration, 1000L) / found.timescale;
        return Optional.of(new VideoInfo(MP4, durationMs, found.width, found.height));
    }

    private static void walkMoov(byte[] b, int start, int end, Mp4 found) {
        int i = start;
        while (i + 8 <= end) {
            long size = boxSize(b, i, end);
            if (size < 0 || ++found.items > MAX_ITEMS) {
                throw new IndexOutOfBoundsException();
            }
            int body = i + headerSize(b, i);
            int next = (int) (i + size);
            switch (ascii(b, i + 4, 4)) {
                case "mvhd" -> {
                    if (u8(b, body) == 1) {
                        found.timescale = u32(b, body + 20);
                        found.duration = u64(b, body + 24);
                    } else {
                        found.timescale = u32(b, body + 12);
                        found.duration = u32(b, body + 16);
                    }
                }
                case "trak" -> track(b, body, next, found);
                default -> {
                }
            }
            i = next;
        }
    }

    /** One track: its handler ({@code vide}?), the codec of its sample description and its {@code tkhd} size. */
    private static void track(byte[] b, int start, int end, Mp4 found) {
        String[] handler = {null};
        String[] codec = {null};
        int[] size = {0, 0};
        trackBoxes(b, start, end, handler, codec, size, found);
        if (!"vide".equals(handler[0])) {
            return;
        }
        found.videoTracks++;
        if (codec[0] == null || !H264.contains(codec[0])) {
            found.otherCodec = true;
        }
        if (found.width == 0) {
            found.width = size[0];
            found.height = size[1];
        }
    }

    private static void trackBoxes(byte[] b, int start, int end, String[] handler, String[] codec, int[] size,
            Mp4 found) {
        int i = start;
        while (i + 8 <= end) {
            long boxSize = boxSize(b, i, end);
            if (boxSize < 0 || ++found.items > MAX_ITEMS) {
                throw new IndexOutOfBoundsException();
            }
            int body = i + headerSize(b, i);
            int next = (int) (i + boxSize);
            switch (ascii(b, i + 4, 4)) {
                case "mdia", "minf", "stbl" -> trackBoxes(b, body, next, handler, codec, size, found);
                // Version and flags, pre_defined, then the handler type.
                case "hdlr" -> handler[0] = ascii(b, body + 8, 4);
                // Version and flags, the entry count, then the first entry: its size and its format.
                case "stsd" -> codec[0] = u32(b, body + 4) > 0 ? ascii(b, body + 12, 4) : null;
                // Width and height are the last two fields, 16.16 fixed point.
                case "tkhd" -> {
                    size[0] = (int) (u32(b, next - 8) >>> 16);
                    size[1] = (int) (u32(b, next - 4) >>> 16);
                }
                default -> {
                }
            }
            i = next;
        }
    }

    /** Size of the box at {@code i} including its header, or -1 when it does not fit before {@code end}. */
    private static long boxSize(byte[] b, int i, int end) {
        long size = u32(b, i);
        if (size == 1) {
            size = u64(b, i + 8);
            if (size < 16) {
                return -1;
            }
        } else if (size == 0) {
            size = (long) end - i;
        } else if (size < 8) {
            return -1;
        }
        return size > (long) end - i ? -1 : size;
    }

    private static int headerSize(byte[] b, int i) {
        return u32(b, i) == 1 ? 16 : 8;
    }

    // ------------------------------------------------------------------ WebM (EBML, Matroska subset)

    private static final long EBML_DOC_TYPE = 0x4282;
    private static final long SEGMENT = 0x18538067L;
    private static final long INFO = 0x1549A966L;
    private static final long TIMESTAMP_SCALE = 0x2AD7B1;
    private static final long DURATION = 0x4489;
    private static final long TRACKS = 0x1654AE6BL;
    private static final long TRACK_ENTRY = 0xAE;
    private static final long TRACK_TYPE = 0x83;
    private static final long CODEC_ID = 0x86;
    private static final long VIDEO = 0xE0;
    private static final long PIXEL_WIDTH = 0xB0;
    private static final long PIXEL_HEIGHT = 0xBA;
    private static final long CLUSTER = 0x1F43B675L;
    private static final long UNKNOWN_SIZE = -1;

    /** An EBML element header: its id, the size of its body ({@link #UNKNOWN_SIZE} for "until the end") and where the body starts. */
    private record Element(long id, long size, int body) {
    }

    /** What the walk over the elements collected. */
    private static final class Webm {
        long timestampScale = 1_000_000;
        double duration;
        int videoTracks;
        boolean otherCodec;
        int width;
        int height;
        int items;
    }

    private static Optional<VideoInfo> webm(byte[] b) {
        Element header = element(b, 0);
        if (header.size() == UNKNOWN_SIZE) {
            return Optional.empty();
        }
        int headerEnd = end(header, b.length);
        boolean webmDocType = false;
        for (int i = header.body(); i < headerEnd; ) {
            Element e = element(b, i);
            int next = end(e, headerEnd);
            if (e.id() == EBML_DOC_TYPE) {
                webmDocType = text(b, e.body(), next - e.body()).equals("webm");
            }
            i = next;
        }
        if (!webmDocType || headerEnd >= b.length) {
            return Optional.empty();
        }
        Element segment = element(b, headerEnd);
        if (segment.id() != SEGMENT) {
            return Optional.empty();
        }
        int segmentEnd = segment.size() == UNKNOWN_SIZE ? b.length : end(segment, b.length);
        Webm found = new Webm();
        for (int i = segment.body(); i < segmentEnd; ) {
            Element e = element(b, i);
            // The clusters are the frames: everything this needs comes before them.
            if (e.id() == CLUSTER || e.size() == UNKNOWN_SIZE || ++found.items > MAX_ITEMS) {
                break;
            }
            int next = end(e, segmentEnd);
            if (e.id() == INFO) {
                info(b, e.body(), next, found);
            } else if (e.id() == TRACKS) {
                tracks(b, e.body(), next, found);
            }
            i = next;
        }
        if (found.videoTracks == 0 || found.otherCodec || found.width <= 0 || found.height <= 0) {
            return Optional.empty();
        }
        double millis = found.duration * found.timestampScale / 1_000_000d;
        long durationMs = Double.isFinite(millis) && millis > 0 && millis < Integer.MAX_VALUE ? Math.round(millis) : 0;
        return Optional.of(new VideoInfo(WEBM, durationMs, found.width, found.height));
    }

    private static void info(byte[] b, int start, int end, Webm found) {
        for (int i = start; i < end; ) {
            Element e = element(b, i);
            int next = end(e, end);
            int length = next - e.body();
            if (e.id() == TIMESTAMP_SCALE) {
                found.timestampScale = uint(b, e.body(), length);
            } else if (e.id() == DURATION) {
                found.duration = length == 4 ? Float.intBitsToFloat((int) uint(b, e.body(), 4))
                        : length == 8 ? Double.longBitsToDouble(uint(b, e.body(), 8)) : 0;
            }
            i = next;
        }
    }

    private static void tracks(byte[] b, int start, int end, Webm found) {
        for (int i = start; i < end; ) {
            Element e = element(b, i);
            int next = end(e, end);
            if (e.id() == TRACK_ENTRY) {
                trackEntry(b, e.body(), next, found);
            }
            i = next;
            if (++found.items > MAX_ITEMS) {
                throw new IndexOutOfBoundsException();
            }
        }
    }

    private static void trackEntry(byte[] b, int start, int end, Webm found) {
        long type = 0;
        String codec = null;
        int width = 0;
        int height = 0;
        for (int i = start; i < end; ) {
            Element e = element(b, i);
            int next = end(e, end);
            int length = next - e.body();
            if (e.id() == TRACK_TYPE) {
                type = uint(b, e.body(), length);
            } else if (e.id() == CODEC_ID) {
                codec = text(b, e.body(), length);
            } else if (e.id() == VIDEO) {
                for (int j = e.body(); j < next; ) {
                    Element v = element(b, j);
                    int vNext = end(v, next);
                    if (v.id() == PIXEL_WIDTH) {
                        width = Math.toIntExact(uint(b, v.body(), vNext - v.body()));
                    } else if (v.id() == PIXEL_HEIGHT) {
                        height = Math.toIntExact(uint(b, v.body(), vNext - v.body()));
                    }
                    j = vNext;
                }
            }
            i = next;
        }
        if (type != 1) {
            return;
        }
        found.videoTracks++;
        if (codec == null || !WEBM_CODECS.contains(codec)) {
            found.otherCodec = true;
        }
        if (found.width == 0) {
            found.width = width;
            found.height = height;
        }
    }

    /** The element header at {@code i}: a 1 to 4 byte id (marker kept) and a 1 to 8 byte size (marker dropped). */
    private static Element element(byte[] b, int i) {
        int idLength = Integer.numberOfLeadingZeros(u8(b, i)) - 23;
        if (idLength > 4) {
            throw new IndexOutOfBoundsException();
        }
        long id = uint(b, i, idLength);
        int at = i + idLength;
        int sizeLength = Integer.numberOfLeadingZeros(u8(b, at)) - 23;
        if (sizeLength > 8) {
            throw new IndexOutOfBoundsException();
        }
        long mask = (1L << (7 * sizeLength)) - 1;
        long size = uint(b, at, sizeLength) & mask;
        return new Element(id, size == mask ? UNKNOWN_SIZE : size, at + sizeLength);
    }

    /** Where a sized element ends; it must fit before {@code limit}. */
    private static int end(Element e, int limit) {
        if (e.size() == UNKNOWN_SIZE || e.size() > (long) limit - e.body()) {
            throw new IndexOutOfBoundsException();
        }
        return (int) (e.body() + e.size());
    }

    // ------------------------------------------------------------------ helpers

    private static int u8(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static long u32(byte[] b, int i) {
        return uint(b, i, 4);
    }

    private static long u64(byte[] b, int i) {
        long value = uint(b, i, 8);
        if (value < 0) {
            throw new ArithmeticException();
        }
        return value;
    }

    /** Big-endian unsigned integer of {@code length} bytes (0 to 8). */
    private static long uint(byte[] b, int i, int length) {
        if (length < 0 || length > 8) {
            throw new IndexOutOfBoundsException();
        }
        long value = 0;
        for (int k = 0; k < length; k++) {
            value = value << 8 | u8(b, i + k);
        }
        return value;
    }

    /** An EBML string: ASCII, maybe padded with zero bytes. */
    private static String text(byte[] b, int i, int length) {
        String value = ascii(b, i, length);
        int zero = value.indexOf('\0');
        return zero < 0 ? value : value.substring(0, zero);
    }

    private static String ascii(byte[] b, int i, int length) {
        if (length < 0 || length > 64) {
            throw new IndexOutOfBoundsException();
        }
        return new String(b, i, length, StandardCharsets.US_ASCII);
    }
}
