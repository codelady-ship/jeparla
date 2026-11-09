package az.jeparla.common.net;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

/**
 * IP address literals, parsed without the resolver.
 *
 * <p>{@link InetAddress#getByName} looks a string up in DNS whenever it is not a literal it
 * recognises (e.g. {@code face.cafe}), so it is never called on request data. Here only strict
 * IPv4 dotted quads and IPv6 text (RFC 4291, optionally with a trailing IPv4 part) are accepted;
 * the bytes are turned into an address with {@link InetAddress#getByAddress(byte[])}, which never
 * performs a lookup. Everything else, including host names, zone ids and brackets, is rejected.
 */
public final class IpAddresses {

    /** Longest IPv6 text form: 8 groups of 4 hex digits with an IPv4 tail. */
    private static final int MAX_LENGTH = 45;

    private IpAddresses() {
    }

    /** The address, or null when {@code text} is not an IPv4 or IPv6 literal. Never resolves. */
    public static InetAddress parse(String text) {
        if (text == null) {
            return null;
        }
        String value = text.strip();
        if (value.isEmpty() || value.length() > MAX_LENGTH) {
            return null;
        }
        byte[] bytes = value.indexOf(':') >= 0 ? parseV6(value) : parseV4(value);
        if (bytes == null) {
            return null;
        }
        try {
            // Never resolves; an IPv4-mapped IPv6 address comes back as the IPv4 address.
            return InetAddress.getByAddress(bytes);
        } catch (UnknownHostException e) {
            return null;
        }
    }

    /** Canonical text form ({@code 2001:db8:0:0:0:0:0:1}, {@code 192.0.2.1}), or null. */
    public static String canonical(String text) {
        InetAddress address = parse(text);
        return address == null ? null : address.getHostAddress();
    }

    /**
     * Rate-limit key of a client address: the IPv4 address itself, or the /64 network of an IPv6
     * address (one subscriber usually gets a whole /64 and can rotate through it freely). Text
     * that is not an IP literal is used as it is.
     */
    public static String rateLimitKey(String text) {
        InetAddress address = parse(text);
        if (address == null) {
            return text == null ? "" : text.strip();
        }
        if (address instanceof Inet4Address) {
            return address.getHostAddress();
        }
        byte[] network = Arrays.copyOf(address.getAddress(), 16);
        Arrays.fill(network, 8, 16, (byte) 0);
        try {
            return InetAddress.getByAddress(network).getHostAddress() + "/64";
        } catch (UnknownHostException e) {
            throw new IllegalStateException("16 bytes are always a valid IPv6 address", e);
        }
    }

    /** Four decimal parts 0-255, no leading zeros (no octal or hex forms). */
    static byte[] parseV4(String text) {
        String[] parts = text.split("\\.", -1);
        if (parts.length != 4) {
            return null;
        }
        byte[] bytes = new byte[4];
        for (int i = 0; i < 4; i++) {
            String part = parts[i];
            if (part.isEmpty() || part.length() > 3 || (part.length() > 1 && part.charAt(0) == '0')) {
                return null;
            }
            int value = 0;
            for (int j = 0; j < part.length(); j++) {
                char c = part.charAt(j);
                if (c < '0' || c > '9') {
                    return null;
                }
                value = value * 10 + (c - '0');
            }
            if (value > 255) {
                return null;
            }
            bytes[i] = (byte) value;
        }
        return bytes;
    }

    /** Eight 16-bit hex groups, at most one {@code ::}, optionally ending in an IPv4 address. */
    static byte[] parseV6(String text) {
        int gap = text.indexOf("::");
        if (gap >= 0 && text.indexOf("::", gap + 1) >= 0) {
            return null;
        }
        int[] head;
        int[] tail;
        if (gap >= 0) {
            head = groups(text.substring(0, gap), false);
            tail = groups(text.substring(gap + 2), true);
        } else {
            head = groups(text, true);
            tail = new int[0];
        }
        if (head == null || tail == null) {
            return null;
        }
        int count = head.length + tail.length;
        if (gap >= 0 ? count > 7 : count != 8) {
            return null;
        }
        byte[] bytes = new byte[16];
        for (int i = 0; i < head.length; i++) {
            bytes[2 * i] = (byte) (head[i] >> 8);
            bytes[2 * i + 1] = (byte) head[i];
        }
        int offset = 8 - tail.length;
        for (int i = 0; i < tail.length; i++) {
            bytes[2 * (offset + i)] = (byte) (tail[i] >> 8);
            bytes[2 * (offset + i) + 1] = (byte) tail[i];
        }
        return bytes;
    }

    /** 16-bit groups of one side of {@code ::}; the last one may be an IPv4 address (2 groups). */
    private static int[] groups(String text, boolean ipv4AllowedLast) {
        if (text.isEmpty()) {
            return new int[0];
        }
        String[] parts = text.split(":", -1);
        int[] result = new int[parts.length + 1];
        int n = 0;
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i];
            if (ipv4AllowedLast && i == parts.length - 1 && part.indexOf('.') >= 0) {
                byte[] v4 = parseV4(part);
                if (v4 == null) {
                    return null;
                }
                result[n++] = (v4[0] & 0xff) << 8 | (v4[1] & 0xff);
                result[n++] = (v4[2] & 0xff) << 8 | (v4[3] & 0xff);
                continue;
            }
            if (part.isEmpty() || part.length() > 4) {
                return null;
            }
            int value = 0;
            for (int j = 0; j < part.length(); j++) {
                int digit = Character.digit(part.charAt(j), 16);
                if (digit < 0 || part.charAt(j) > 'f') {
                    return null;
                }
                value = value << 4 | digit;
            }
            result[n++] = value;
        }
        return Arrays.copyOf(result, n);
    }
}
