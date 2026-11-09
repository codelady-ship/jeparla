package az.jeparla.common.net;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;

/**
 * The reverse proxies whose {@code X-Forwarded-For} is believed: a list of CIDR blocks
 * ({@code 172.30.0.0/24}, {@code ::1/128}) or single addresses. An empty list trusts nothing.
 */
public final class TrustedProxies {

    private final List<Block> blocks;

    private TrustedProxies(List<Block> blocks) {
        this.blocks = List.copyOf(blocks);
    }

    /**
     * @param spec comma- or whitespace-separated CIDR blocks; null or blank trusts nothing
     * @throws IllegalArgumentException for an entry that is not an IP literal with a valid prefix
     */
    public static TrustedProxies parse(String spec) {
        List<Block> blocks = new ArrayList<>();
        if (spec != null) {
            for (String entry : spec.split("[,\\s]+")) {
                if (!entry.isEmpty()) {
                    blocks.add(Block.parse(entry));
                }
            }
        }
        return new TrustedProxies(blocks);
    }

    public boolean isEmpty() {
        return blocks.isEmpty();
    }

    /** Whether {@code address} (an IP literal) is one of the trusted proxies. */
    public boolean contains(String address) {
        InetAddress parsed = IpAddresses.parse(address);
        if (parsed == null) {
            return false;
        }
        byte[] bytes = parsed.getAddress();
        for (Block block : blocks) {
            if (block.contains(bytes)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public String toString() {
        return blocks.toString();
    }

    private record Block(byte[] network, int prefix, String text) {

        static Block parse(String entry) {
            int slash = entry.indexOf('/');
            String host = slash < 0 ? entry : entry.substring(0, slash);
            InetAddress address = IpAddresses.parse(host);
            if (address == null) {
                throw new IllegalArgumentException("Trusted proxy is not an IP address or CIDR block: " + entry);
            }
            byte[] network = address.getAddress();
            int max = network.length * 8;
            int prefix;
            if (slash < 0) {
                prefix = max;
            } else {
                try {
                    prefix = Integer.parseInt(entry.substring(slash + 1));
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid CIDR prefix: " + entry, e);
                }
                if (prefix < 0 || prefix > max) {
                    throw new IllegalArgumentException("Invalid CIDR prefix: " + entry);
                }
            }
            return new Block(network, prefix, entry);
        }

        boolean contains(byte[] address) {
            if (address.length != network.length) {
                return false;
            }
            int full = prefix / 8;
            for (int i = 0; i < full; i++) {
                if (address[i] != network[i]) {
                    return false;
                }
            }
            int rest = prefix % 8;
            if (rest == 0) {
                return true;
            }
            int mask = 0xff << (8 - rest) & 0xff;
            return (address[full] & mask) == (network[full] & mask);
        }

        @Override
        public String toString() {
            return text;
        }
    }
}
