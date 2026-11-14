package az.jeparla.common.net;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** {@link ClientIpFilter} on its own; {@code RateLimitTests} covers it end to end (#132). */
class ClientIpFilterTests {

    /** The Caddy container. */
    private static final String PROXY = "172.30.0.2";

    private final ClientIpFilter filter = new ClientIpFilter(TrustedProxies.parse("127.0.0.1/32,172.30.0.0/24"));

    private HttpServletRequest filtered(MockHttpServletRequest request) throws Exception {
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, new MockHttpServletResponse(), chain);
        return (HttpServletRequest) chain.getRequest();
    }

    private static MockHttpServletRequest from(String peer) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(peer);
        return request;
    }

    @Test
    void anUntrustedPeerIsTheClientWhateverItsHeadersSay() throws Exception {
        MockHttpServletRequest request = from("203.0.113.50");
        request.addHeader("Forwarded", "for=198.51.100.1;proto=https");
        request.addHeader("X-Forwarded-For", "198.51.100.2");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Real-IP", "198.51.100.3");

        HttpServletRequest seen = filtered(request);

        assertThat(seen.getRemoteAddr()).isEqualTo("203.0.113.50");
        assertThat(seen.getRemoteHost()).isEqualTo("203.0.113.50");
        assertThat(seen.getScheme()).isEqualTo("http");
        assertThat(seen.isSecure()).isFalse();
    }

    @Test
    void aTrustedProxyReportsTheClientInXForwardedFor() throws Exception {
        MockHttpServletRequest request = from(PROXY);
        request.addHeader("X-Forwarded-For", "198.51.100.9");
        request.addHeader("X-Forwarded-Proto", "https");

        HttpServletRequest seen = filtered(request);

        assertThat(seen.getRemoteAddr()).isEqualTo("198.51.100.9");
        assertThat(seen.getScheme()).isEqualTo("https");
        assertThat(seen.isSecure()).isTrue();
    }

    @Test
    void theForwardedHeaderIsNeverBelievedEvenFromATrustedProxy() throws Exception {
        // Caddy writes X-Forwarded-For but passes a client's Forwarded header through unchanged.
        MockHttpServletRequest request = from(PROXY);
        request.addHeader("Forwarded", "for=203.0.113.77");
        request.addHeader("X-Forwarded-For", "198.51.100.9");

        assertThat(filtered(request).getRemoteAddr()).isEqualTo("198.51.100.9");

        MockHttpServletRequest onlyForwarded = from(PROXY);
        onlyForwarded.addHeader("Forwarded", "for=\"face.cafe\"");
        assertThat(filtered(onlyForwarded).getRemoteAddr()).isEqualTo(PROXY);
    }

    @Test
    void theRightMostUntrustedAddressIsTheClient() throws Exception {
        // A proxy that appends: everything left of the last untrusted hop came from the client.
        MockHttpServletRequest request = from(PROXY);
        request.addHeader("X-Forwarded-For", "1.2.3.4, 198.51.100.9, 172.30.0.3");
        assertThat(filtered(request).getRemoteAddr()).isEqualTo("198.51.100.9");

        MockHttpServletRequest split = from(PROXY);
        split.addHeader("X-Forwarded-For", "1.2.3.4");
        split.addHeader("X-Forwarded-For", "198.51.100.9");
        assertThat(filtered(split).getRemoteAddr()).isEqualTo("198.51.100.9");

        // Only trusted hops: the left-most one is the client.
        MockHttpServletRequest internal = from(PROXY);
        internal.addHeader("X-Forwarded-For", "127.0.0.1, 172.30.0.3");
        assertThat(filtered(internal).getRemoteAddr()).isEqualTo("127.0.0.1");
    }

    @Test
    void aValueThatIsNotAnIpAddressIsNeverTheClient() throws Exception {
        MockHttpServletRequest garbage = from(PROXY);
        garbage.addHeader("X-Forwarded-For", "face.cafe");
        assertThat(filtered(garbage).getRemoteAddr()).isEqualTo(PROXY);

        MockHttpServletRequest mixed = from(PROXY);
        mixed.addHeader("X-Forwarded-For", "198.51.100.9, unknown");
        assertThat(filtered(mixed).getRemoteAddr()).isEqualTo(PROXY);

        MockHttpServletRequest empty = from(PROXY);
        assertThat(filtered(empty).getRemoteAddr()).isEqualTo(PROXY);
    }

    @Test
    void ipv6AddressesAreCanonical() throws Exception {
        MockHttpServletRequest request = from("2001:DB8::50");
        assertThat(filtered(request).getRemoteAddr()).isEqualTo("2001:db8:0:0:0:0:0:50");

        MockHttpServletRequest proxied = from(PROXY);
        proxied.addHeader("X-Forwarded-For", "2001:db8::9");
        assertThat(filtered(proxied).getRemoteAddr()).isEqualTo("2001:db8:0:0:0:0:0:9");
    }

    @Test
    void withoutTrustedProxiesNothingIsBelieved() throws Exception {
        ClientIpFilter strict = new ClientIpFilter(TrustedProxies.parse(""));
        MockHttpServletRequest request = from("127.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.9");
        MockFilterChain chain = new MockFilterChain();
        strict.doFilter(request, new MockHttpServletResponse(), chain);
        assertThat(((HttpServletRequest) chain.getRequest()).getRemoteAddr()).isEqualTo("127.0.0.1");
    }

    @Test
    void forwardingHeadersAreHiddenFromTheApplication() throws Exception {
        MockHttpServletRequest request = from(PROXY);
        request.addHeader("Forwarded", "for=203.0.113.77");
        request.addHeader("X-Forwarded-For", "198.51.100.9");
        request.addHeader("X-Forwarded-Host", "evil.example");
        request.addHeader("Accept-Language", "az");

        HttpServletRequest seen = filtered(request);

        assertThat(seen.getHeader("Forwarded")).isNull();
        assertThat(seen.getHeader("x-forwarded-for")).isNull();
        assertThat(seen.getHeaders("X-Forwarded-Host").hasMoreElements()).isFalse();
        assertThat(Collections.list(seen.getHeaderNames())).containsExactly("Accept-Language");
        assertThat(seen.getHeader("Accept-Language")).isEqualTo("az");
    }

    private static final String FRONTEND_TOKEN = "frontend-token-for-tests-0123456789abcdef";

    private HttpServletRequest relayed(String token, String visitor) throws Exception {
        ClientIpFilter withRelay = new ClientIpFilter(TrustedProxies.parse("127.0.0.1/32"), FRONTEND_TOKEN);
        MockHttpServletRequest request = from("203.0.113.10");
        if (token != null) {
            request.addHeader(ClientIpFilter.FRONTEND_TOKEN, token);
        }
        request.addHeader(ClientIpFilter.FRONTEND_CLIENT_IP, visitor);
        MockFilterChain chain = new MockFilterChain();
        withRelay.doFilter(request, new MockHttpServletResponse(), chain);
        return (HttpServletRequest) chain.getRequest();
    }

    @Test
    void theFrontendServerNamesItsVisitorOnlyWithTheSharedToken() throws Exception {
        HttpServletRequest seen = relayed(FRONTEND_TOKEN, "198.51.100.20");
        assertThat(seen.getRemoteAddr()).isEqualTo("198.51.100.20");
        assertThat(seen.getHeader(ClientIpFilter.FRONTEND_TOKEN)).isNull();
        assertThat(seen.getHeader(ClientIpFilter.FRONTEND_CLIENT_IP)).isNull();

        assertThat(relayed(null, "198.51.100.20").getRemoteAddr()).isEqualTo("203.0.113.10");
        assertThat(relayed("wrong-token-wrong-token-wrong-token-xx", "198.51.100.20").getRemoteAddr())
                .isEqualTo("203.0.113.10");
        assertThat(relayed(FRONTEND_TOKEN, "face.cafe").getRemoteAddr()).isEqualTo("203.0.113.10");
    }

    @Test
    void withoutAConfiguredTokenTheRelayHeaderIsIgnored() throws Exception {
        MockHttpServletRequest request = from("203.0.113.10");
        request.addHeader(ClientIpFilter.FRONTEND_TOKEN, "");
        request.addHeader(ClientIpFilter.FRONTEND_CLIENT_IP, "198.51.100.20");
        assertThat(filtered(request).getRemoteAddr()).isEqualTo("203.0.113.10");
    }

    @Test
    void aShortFrontendTokenStopsTheStartup() {
        assertThatIllegalArgumentException().isThrownBy(() -> new ClientIpProperties("", "short"));
        assertThat(new ClientIpProperties("", " ").frontendToken()).isNull();
    }
}
