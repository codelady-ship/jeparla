package az.jeparla.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import az.jeparla.auth.AuthController;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Calls the auth endpoints like the frontend does, each test from its own client IP. */
public final class AuthTestClient {

    private static final AtomicInteger IPS = new AtomicInteger();

    private final MockMvc mockMvc;
    private final String ip;

    public AuthTestClient(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
        this.ip = nextIp();
    }

    /** A fresh client address, so rate limits of one test never affect another. */
    public static String nextIp() {
        int n = IPS.incrementAndGet();
        return "10." + (n >> 16 & 255) + "." + (n >> 8 & 255) + "." + (n & 255);
    }

    public static RequestPostProcessor from(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    public String ip() {
        return ip;
    }

    public static String uniqueEmail() {
        return "user" + TestData.next() + "@jeparla.test";
    }

    /** A unique +99450XXXXXXX number in the 50 operator range. */
    public static String uniquePhone() {
        return String.format("+99450%07d", TestData.next());
    }

    public MockHttpServletResponse register(String name, String email, String password) throws Exception {
        return send(post("/api/v1/auth/register"),
                "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    public MockHttpServletResponse registerMerchant(String name, String phone, String password) throws Exception {
        return send(post("/api/v1/auth/register/merchant"),
                "{\"name\":\"" + name + "\",\"phone\":\"" + phone + "\",\"password\":\"" + password + "\"}");
    }

    public MockHttpServletResponse login(String login, String password) throws Exception {
        return send(post("/api/v1/auth/login"), "{\"login\":\"" + login + "\",\"password\":\"" + password + "\"}");
    }

    public MockHttpServletResponse refresh(String refreshToken) throws Exception {
        MockHttpServletRequestBuilder request = post("/api/v1/auth/refresh").with(from(ip));
        if (refreshToken != null) {
            request.cookie(new Cookie(AuthController.REFRESH_COOKIE, refreshToken));
        }
        return mockMvc.perform(request).andReturn().getResponse();
    }

    public MockHttpServletResponse logout(String refreshToken) throws Exception {
        MockHttpServletRequestBuilder request = post("/api/v1/auth/logout").with(from(ip));
        if (refreshToken != null) {
            request.cookie(new Cookie(AuthController.REFRESH_COOKIE, refreshToken));
        }
        return mockMvc.perform(request).andReturn().getResponse();
    }

    private MockHttpServletResponse send(MockHttpServletRequestBuilder request, String json) throws Exception {
        return mockMvc.perform(request.with(from(ip)).contentType(MediaType.APPLICATION_JSON).content(json))
                .andReturn().getResponse();
    }

    public static String accessToken(MockHttpServletResponse response) throws Exception {
        return JsonPath.read(response.getContentAsString(), "$.accessToken");
    }

    /** Value of the refresh cookie the response sets (empty when it clears it). */
    public static String refreshCookie(MockHttpServletResponse response) {
        Cookie cookie = response.getCookie(AuthController.REFRESH_COOKIE);
        return cookie == null ? null : cookie.getValue();
    }
}
