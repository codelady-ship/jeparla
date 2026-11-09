package az.jeparla.common.net;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class IpAddressesTests {

    @Test
    void parsesIpv4AndIpv6Literals() {
        assertThat(IpAddresses.canonical("203.0.113.7")).isEqualTo("203.0.113.7");
        assertThat(IpAddresses.canonical(" 0.0.0.0 ")).isEqualTo("0.0.0.0");
        assertThat(IpAddresses.canonical("2001:db8::1")).isEqualTo("2001:db8:0:0:0:0:0:1");
        assertThat(IpAddresses.canonical("2001:DB8:0:0:0:0:0:1")).isEqualTo("2001:db8:0:0:0:0:0:1");
        assertThat(IpAddresses.canonical("::1")).isEqualTo("0:0:0:0:0:0:0:1");
        assertThat(IpAddresses.canonical("::")).isEqualTo("0:0:0:0:0:0:0:0");
        assertThat(IpAddresses.canonical("fe80::")).isEqualTo("fe80:0:0:0:0:0:0:0");
        assertThat(IpAddresses.canonical("64:ff9b::192.0.2.33")).isEqualTo("64:ff9b:0:0:0:0:c000:221");
        // An IPv4-mapped IPv6 address is the IPv4 client: one key for both spellings.
        assertThat(IpAddresses.canonical("::ffff:203.0.113.7")).isEqualTo("203.0.113.7");
    }

    @ParameterizedTest
    @ValueSource(strings = {"face.cafe", "cafe", "beef.dead.be.ef", "localhost", "example.com", "1.2.3", "1.2.3.4.5",
            "256.1.1.1", "01.2.3.4", "0x7f.0.0.1", "1.2.3.-4", "1.2.3.4 x", "[::1]", "fe80::1%eth0", ":::",
            "1::2::3", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7", "12345::", "g::1", ":1::", "1::2:", "",
            "١.2.3.4", "1:2:3:4:5:6:7:1.2.3.4", "for=1.2.3.4", "unknown"})
    void rejectsEverythingElse(String text) {
        assertThat(IpAddresses.parse(text)).as(text).isNull();
    }

    @Test
    void rejectsNull() {
        assertThat(IpAddresses.parse(null)).isNull();
    }

    @Test
    void ipv6ClientsAreLimitedPerSlash64() {
        assertThat(IpAddresses.rateLimitKey("2001:db8:1:2:aaaa::1"))
                .isEqualTo(IpAddresses.rateLimitKey("2001:db8:1:2:ffff:ffff:ffff:ffff"))
                .isEqualTo("2001:db8:1:2:0:0:0:0/64");
        assertThat(IpAddresses.rateLimitKey("2001:db8:1:3::1")).isNotEqualTo(IpAddresses.rateLimitKey("2001:db8:1:2::1"));
        assertThat(IpAddresses.rateLimitKey("203.0.113.7")).isEqualTo("203.0.113.7");
        assertThat(IpAddresses.rateLimitKey("::ffff:203.0.113.7")).isEqualTo("203.0.113.7");
    }

    @Test
    void trustedProxiesMatchCidrBlocks() {
        TrustedProxies proxies = TrustedProxies.parse("127.0.0.1/32, ::1/128 172.30.0.0/20,192.0.2.9");
        assertThat(proxies.contains("127.0.0.1")).isTrue();
        assertThat(proxies.contains("127.0.0.2")).isFalse();
        assertThat(proxies.contains("::1")).isTrue();
        assertThat(proxies.contains("172.30.15.255")).isTrue();
        assertThat(proxies.contains("172.30.16.0")).isFalse();
        assertThat(proxies.contains("192.0.2.9")).isTrue();
        assertThat(proxies.contains("192.0.2.10")).isFalse();
        assertThat(proxies.contains("face.cafe")).isFalse();

        assertThat(TrustedProxies.parse("").isEmpty()).isTrue();
        assertThat(TrustedProxies.parse(null).contains("127.0.0.1")).isFalse();
        assertThat(TrustedProxies.parse("0.0.0.0/0").contains("203.0.113.7")).isTrue();
        assertThat(TrustedProxies.parse("2001:db8::/32").contains("2001:db8:ffff::1")).isTrue();
        assertThat(TrustedProxies.parse("2001:db8::/32").contains("203.0.113.7")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"caddy", "10.0.0.0/33", "10.0.0.0/-1", "10.0.0.0/x", "::1/129", "10.0.0.0/"})
    void malformedTrustedProxyStopsTheStartup(String spec) {
        assertThatIllegalArgumentException().isThrownBy(() -> new ClientIpProperties(spec));
    }

    @Test
    void hostNamesAreNeverLookedUp() throws Exception {
        // The JVM resolver is replaced in tests by one that records every name (META-INF/services).
        InetAddress.getByName("localhost");
        assertThat(RecordingResolverProvider.lookups()).as("the recording resolver is installed").contains("localhost");

        for (String name : new String[] {"face.cafe", "beef.cafe", "dead.beef", "cafe"}) {
            assertThat(IpAddresses.parse(name)).isNull();
            assertThat(IpAddresses.rateLimitKey(name)).isEqualTo(name);
            assertThat(TrustedProxies.parse("10.0.0.0/8").contains(name)).isFalse();
        }
        assertThat(RecordingResolverProvider.lookups()).doesNotContain("face.cafe", "beef.cafe", "dead.beef", "cafe");
    }
}
