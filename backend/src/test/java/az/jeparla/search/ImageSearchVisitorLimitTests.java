package az.jeparla.search;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.common.error.GlobalExceptionHandler;
import az.jeparla.common.net.ClientIpFilter;
import az.jeparla.common.net.TrustedProxies;
import az.jeparla.common.ratelimit.InMemoryRateLimitCounter;
import az.jeparla.common.ratelimit.RateLimitProperties;
import az.jeparla.common.ratelimit.RateLimitProperties.Limit;
import az.jeparla.common.ratelimit.RateLimitService;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * The photo search limit counts each visitor, not the frontend server that calls the API for all of them (#222):
 * the request goes through the same {@link ClientIpFilter} as sign-in and text search, so a visitor named with
 * the shared frontend token has its own counter, and a request without the token counts for its TCP peer.
 * No database: the embedding service is a stub, the counters are in memory.
 */
class ImageSearchVisitorLimitTests {

    private static final int LIMIT = 2;
    private static final String FRONTEND_TOKEN = "frontend-token-for-tests-0123456789abcdef";
    private static final String FRONTEND_SERVER = "203.0.113.10";
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13};

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        ImageSearchService search = mock(ImageSearchService.class);
        when(search.search(any())).thenReturn(List.of());
        RateLimitService rateLimits = new RateLimitService(
                new RateLimitProperties(RateLimitProperties.Store.MEMORY,
                        Map.of("image-search-ip", new Limit(LIMIT, null))),
                null, new InMemoryRateLimitCounter(Clock.systemUTC()), Clock.systemUTC());
        StaticMessageSource messages = new StaticMessageSource();
        messages.setUseCodeAsDefaultMessage(true);
        mvc = MockMvcBuilders.standaloneSetup(new ImageSearchController(search, rateLimits))
                .setControllerAdvice(new GlobalExceptionHandler(messages))
                .addFilters(new ClientIpFilter(TrustedProxies.parse(""), FRONTEND_TOKEN))
                .build();
    }

    private ResultActions searchFor(String visitor, String token) throws Exception {
        return mvc.perform(multipart("/api/v1/search/image")
                .file(new MockMultipartFile("image", "a.png", "image/png", PNG))
                .with(request -> {
                    request.setRemoteAddr(FRONTEND_SERVER);
                    if (token != null) {
                        request.addHeader(ClientIpFilter.FRONTEND_TOKEN, token);
                    }
                    if (visitor != null) {
                        request.addHeader(ClientIpFilter.FRONTEND_CLIENT_IP, visitor);
                    }
                    return request;
                }));
    }

    @Test
    void eachVisitorNamedByTheFrontendServerHasItsOwnLimit() throws Exception {
        for (int i = 0; i < LIMIT; i++) {
            searchFor("198.51.100.20", FRONTEND_TOKEN).andExpect(status().isOk());
        }
        searchFor("198.51.100.20", FRONTEND_TOKEN).andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
        // Another visitor behind the same frontend server is not blocked by the first one.
        searchFor("198.51.100.21", FRONTEND_TOKEN).andExpect(status().isOk());
        // Nor is the frontend server's own address.
        searchFor(null, null).andExpect(status().isOk());
    }

    @Test
    void withoutTheSharedTokenTheNamedVisitorIsIgnored() throws Exception {
        for (int i = 0; i < LIMIT; i++) {
            searchFor("198.51.100." + (30 + i), "wrong-token-wrong-token-wrong-token-xx").andExpect(status().isOk());
        }
        // Both requests counted for the TCP peer, whatever visitor they claimed.
        searchFor("198.51.100.40", null).andExpect(status().isTooManyRequests());
    }
}
