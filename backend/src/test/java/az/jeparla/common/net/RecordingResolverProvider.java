package az.jeparla.common.net;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.net.spi.InetAddressResolver;
import java.net.spi.InetAddressResolverProvider;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

/**
 * The JVM's name resolver in tests (registered in {@code META-INF/services}): delegates to the
 * built-in resolver and records every host name looked up, so a test can prove that a value was
 * never sent to DNS.
 */
public class RecordingResolverProvider extends InetAddressResolverProvider {

    private static final Set<String> LOOKUPS = ConcurrentHashMap.newKeySet();

    /** Every host name looked up in this JVM so far. */
    public static Set<String> lookups() {
        return Set.copyOf(LOOKUPS);
    }

    @Override
    public InetAddressResolver get(Configuration configuration) {
        InetAddressResolver builtin = configuration.builtinResolver();
        return new InetAddressResolver() {

            @Override
            public Stream<InetAddress> lookupByName(String host, LookupPolicy lookupPolicy)
                    throws UnknownHostException {
                LOOKUPS.add(host);
                return builtin.lookupByName(host, lookupPolicy);
            }

            @Override
            public String lookupByAddress(byte[] addr) throws UnknownHostException {
                return builtin.lookupByAddress(addr);
            }
        };
    }

    @Override
    public String name() {
        return "jeparla-test-recording-resolver";
    }
}
