package az.jeparla.common.net;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Sets the client address ({@code getRemoteAddr()}) and scheme of every request, believing
 * forwarding headers only when the TCP peer is a {@link TrustedProxies trusted proxy}.
 *
 * <ul>
 * <li>Peer not trusted: its own address is the client; every forwarding header is ignored.</li>
 * <li>Peer trusted: {@code X-Forwarded-For} is read from the right and the first address that is
 * not a trusted proxy is the client (entries further left were written by the client itself and
 * prove nothing). {@code X-Forwarded-Proto} ({@code http}/{@code https}) sets the scheme.</li>
 * <li>The standard {@code Forwarded} header (RFC 7239) is never believed: the proxy (Caddy) does
 * not write it and would pass a client's copy through unchanged.</li>
 * <li>A request with the frontend server's shared secret in {@value #FRONTEND_TOKEN} names its
 * visitor in {@value #FRONTEND_CLIENT_IP}: the Next.js server calls the API for every visitor, and
 * without this they would all share its one address in rate limits (#41). With no configured token,
 * a wrong token or a value that is not an IP literal, both headers are ignored.</li>
 * </ul>
 *
 * <p>Forwarding headers are hidden from the rest of the application, so nothing downstream can
 * read a client-supplied value by mistake. Replaces Spring's {@code ForwardedHeaderFilter}
 * ({@code server.forward-headers-strategy: framework}), which trusts any sender.
 */
public class ClientIpFilter extends OncePerRequestFilter {

    static final String X_FORWARDED_FOR = "X-Forwarded-For";
    static final String X_FORWARDED_PROTO = "X-Forwarded-Proto";
    public static final String FRONTEND_TOKEN = "X-Jeparla-Frontend-Token";
    public static final String FRONTEND_CLIENT_IP = "X-Jeparla-Client-Ip";

    /** Lowercase names of the headers that are consumed here and hidden downstream. */
    static final Set<String> FORWARDING_HEADERS = Set.of("forwarded", "x-forwarded-for", "x-forwarded-proto",
            "x-forwarded-host", "x-forwarded-port", "x-forwarded-prefix", "x-forwarded-ssl", "x-real-ip",
            "x-jeparla-frontend-token", "x-jeparla-client-ip");

    private final TrustedProxies trustedProxies;
    private final byte[] frontendToken;

    public ClientIpFilter(TrustedProxies trustedProxies) {
        this(trustedProxies, null);
    }

    public ClientIpFilter(TrustedProxies trustedProxies, String frontendToken) {
        this.trustedProxies = trustedProxies;
        this.frontendToken = frontendToken == null ? null : frontendToken.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String peer = IpAddresses.canonical(request.getRemoteAddr());
        String client = peer != null ? peer : request.getRemoteAddr();
        String scheme = request.getScheme();
        if (peer != null && trustedProxies.contains(peer)) {
            client = clientFromForwardedFor(request.getHeaders(X_FORWARDED_FOR), peer);
            String proto = lastValue(request.getHeaders(X_FORWARDED_PROTO));
            if ("https".equalsIgnoreCase(proto) || "http".equalsIgnoreCase(proto)) {
                scheme = proto.toLowerCase(Locale.ROOT);
            }
        }
        String relayed = relayedClient(request);
        if (relayed != null) {
            client = relayed;
        }
        chain.doFilter(new ClientRequest(request, client, scheme), response);
    }

    /** The visitor the frontend server names, or null without a matching token and an IP literal. */
    private String relayedClient(HttpServletRequest request) {
        if (frontendToken == null) {
            return null;
        }
        String token = request.getHeader(FRONTEND_TOKEN);
        if (token == null || !MessageDigest.isEqual(frontendToken, token.strip().getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        return IpAddresses.canonical(request.getHeader(FRONTEND_CLIENT_IP));
    }

    /** Should run for error dispatches too, so the error page sees the same client address. */
    @Override
    protected boolean shouldNotFilterErrorDispatch() {
        return false;
    }

    /**
     * Walks {@code X-Forwarded-For} from the right (the hop closest to us). The first address that
     * is not a trusted proxy is the client. An entry that is not an IP literal stops the walk: the
     * last address vouched for by a trusted hop is used. When every hop is trusted, the left-most
     * one is the client.
     */
    private String clientFromForwardedFor(Enumeration<String> headers, String peer) {
        List<String> hops = new ArrayList<>();
        if (headers != null) {
            while (headers.hasMoreElements()) {
                String header = headers.nextElement();
                if (header != null) {
                    for (String hop : header.split(",")) {
                        hops.add(hop.strip());
                    }
                }
            }
        }
        String client = peer;
        for (int i = hops.size() - 1; i >= 0; i--) {
            String address = IpAddresses.canonical(hops.get(i));
            if (address == null) {
                break;
            }
            client = address;
            if (!trustedProxies.contains(address)) {
                break;
            }
        }
        return client;
    }

    private static String lastValue(Enumeration<String> headers) {
        String last = null;
        if (headers != null) {
            while (headers.hasMoreElements()) {
                String header = headers.nextElement();
                if (header != null) {
                    String[] values = header.split(",");
                    last = values.length == 0 ? null : values[values.length - 1].strip();
                }
            }
        }
        return last;
    }

    private static boolean isForwardingHeader(String name) {
        return name != null && FORWARDING_HEADERS.contains(name.toLowerCase(Locale.ROOT));
    }

    /** The request as the application sees it: resolved client address and scheme, no forwarding headers. */
    private static final class ClientRequest extends HttpServletRequestWrapper {

        private final String client;
        private final String scheme;

        ClientRequest(HttpServletRequest request, String client, String scheme) {
            super(request);
            this.client = client;
            this.scheme = scheme;
        }

        @Override
        public String getRemoteAddr() {
            return client;
        }

        /** The address, never a host name (no reverse DNS). */
        @Override
        public String getRemoteHost() {
            return client;
        }

        @Override
        public String getScheme() {
            return scheme;
        }

        @Override
        public boolean isSecure() {
            return "https".equals(scheme) || super.isSecure();
        }

        @Override
        public String getHeader(String name) {
            return isForwardingHeader(name) ? null : super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            return isForwardingHeader(name) ? Collections.emptyEnumeration() : super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = new ArrayList<>();
            Enumeration<String> all = super.getHeaderNames();
            while (all != null && all.hasMoreElements()) {
                String name = all.nextElement();
                if (!isForwardingHeader(name)) {
                    names.add(name);
                }
            }
            return Collections.enumeration(names);
        }
    }
}
