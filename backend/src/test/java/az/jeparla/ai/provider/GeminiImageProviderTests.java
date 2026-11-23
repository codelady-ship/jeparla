package az.jeparla.ai.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The Gemini provider against a local stub server (no real API, no key): the request it sends, the image it returns,
 * and how safety blocks, HTTP errors and timeouts become job codes.
 */
class GeminiImageProviderTests {

    private static final String KEY = "test-gemini-key-not-real";
    private static final String GENERATE = "/v1beta/models/gemini-2.5-flash-image:generateContent";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private HttpServer server;
    private String base;
    private final List<String> requests = new CopyOnWriteArrayList<>();
    private final AtomicReference<String> apiKeyHeader = new AtomicReference<>();
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private final AtomicReference<Answer> answer = new AtomicReference<>();
    private byte[] product;
    private byte[] model;
    private byte[] generated;

    /** What the stub generateContent endpoint does next. */
    private record Answer(int status, String body, long delayMillis) {
    }

    @BeforeEach
    void start() throws IOException {
        product = png(40, 50);
        model = png(30, 30);
        generated = png(80, 100);
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/img/product.png", exchange -> send(exchange, 200, "image/png", product));
        server.createContext("/img/model.png", exchange -> send(exchange, 200, "image/png", model));
        server.createContext("/img/page.html", exchange -> send(exchange, 200, "text/html",
                "<html></html>".getBytes(StandardCharsets.UTF_8)));
        server.createContext("/img/huge.png", exchange -> send(exchange, 200, "image/png", new byte[4096]));
        server.createContext("/v1beta/models/", exchange -> {
            requests.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
            apiKeyHeader.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            try (InputStream in = exchange.getRequestBody()) {
                lastBody.set(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
            Answer next = answer.get();
            if (next.delayMillis() > 0) {
                try {
                    Thread.sleep(next.delayMillis());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            try {
                send(exchange, next.status(), "application/json", next.body().getBytes(StandardCharsets.UTF_8));
            } catch (IOException ignored) {
                // The client gave up (timeout test).
            }
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private static void send(HttpExchange exchange, int status, String type, byte[] body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", type);
        exchange.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
        }
    }

    private static byte[] png(int width, int height) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    private GeminiProperties properties(String key, Duration timeout, int maxInputBytes) {
        return new GeminiProperties(key, "gemini-2.5-flash-image", base + "/v1beta/", new BigDecimal("0.039"),
                timeout, Duration.ofSeconds(5), maxInputBytes, 3);
    }

    private GeminiImageProvider provider() {
        return new GeminiImageProvider(properties(KEY, Duration.ofSeconds(5), 1024 * 1024), url -> Optional.empty());
    }

    private GenerationRequest request(int outputs, List<String> references) {
        return new GenerationRequest(7, "VIRTUAL_TRY_ON", base + "/img/product.png", "Photograph of the item.",
                references, outputs, "4:5", Map.of());
    }

    private static String imageAnswer(byte[] image) {
        return "{\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"Here it is\"},"
                + "{\"inlineData\":{\"mimeType\":\"image/png\",\"data\":\"" + Base64.getEncoder().encodeToString(image)
                + "\"}}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"totalTokenCount\":1500}}";
    }

    private static void assertCode(ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOf(ImageGenerationException.class)
                .satisfies(e -> assertThat(((ImageGenerationException) e).code()).isEqualTo(code))
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(KEY));
    }

    // ------------------------------------------------------------------ settings

    @Test
    void onlyAKeyMakesItConfiguredAndTheKeyIsNeverPrinted() {
        GeminiImageProvider off = new GeminiImageProvider(properties(" ", Duration.ofSeconds(5), 1024),
                url -> Optional.empty());
        assertThat(off.id()).isEqualTo("gemini");
        assertThat(off.configured()).isFalse();
        assertCode(() -> off.generate(request(1, List.of())), ImageGenerationException.NOT_CONFIGURED);
        assertThat(requests).isEmpty();

        GeminiProperties on = properties(KEY, Duration.ofSeconds(5), 1024);
        assertThat(on.configured()).isTrue();
        assertThat(on.toString()).doesNotContain(KEY).contains("(set)");
        assertThatThrownBy(() -> new GeminiProperties(KEY, "../x", base, BigDecimal.ONE, Duration.ofSeconds(1),
                Duration.ofSeconds(1), 1024, 3)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GeminiProperties(KEY, "m", base, BigDecimal.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), 1024, 3)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theEstimateIsThePricePerImageTimesTheOutputs() {
        assertThat(provider().estimatedCost(request(1, List.of()))).isEqualByComparingTo("0.039");
        assertThat(provider().estimatedCost(request(3, List.of()))).isEqualByComparingTo("0.117");
    }

    @Test
    void itIsSelectableAsTheImageProvider() {
        GeminiImageProvider gemini = provider();
        assertThat(new ImageGenerationProviders(List.of(gemini), "gemini").active()).isSameAs(gemini);
    }

    // ------------------------------------------------------------------ success

    @Test
    void sendsThePromptTheProductAndTheModelAndReturnsOneImagePerOutput() throws IOException {
        answer.set(new Answer(200, imageAnswer(generated), 0));

        GenerationResult result = provider().generate(request(2, List.of(base + "/img/model.png")));

        assertThat(result.images()).hasSize(2);
        assertThat(result.images().getFirst().bytes()).isEqualTo(generated);
        assertThat(result.cost()).isNull();
        assertThat(requests).containsExactly("POST " + GENERATE, "POST " + GENERATE);
        assertThat(apiKeyHeader.get()).isEqualTo(KEY);

        JsonNode body = JSON.readTree(lastBody.get());
        JsonNode parts = body.path("contents").get(0).path("parts");
        assertThat(parts).hasSize(3);
        assertThat(parts.get(0).path("text").asString()).startsWith("Photograph of the item.")
                .contains("The next 1 image(s) are reference photos");
        assertThat(parts.get(1).path("inline_data").path("mime_type").asString()).isEqualTo("image/png");
        assertThat(Base64.getDecoder().decode(parts.get(1).path("inline_data").path("data").asString()))
                .isEqualTo(product);
        assertThat(Base64.getDecoder().decode(parts.get(2).path("inline_data").path("data").asString()))
                .isEqualTo(model);
        assertThat(body.path("generationConfig").path("responseModalities").get(0).asString()).isEqualTo("IMAGE");
        assertThat(body.path("generationConfig").path("imageConfig").path("aspectRatio").asString()).isEqualTo("4:5");
        assertThat(lastBody.get()).doesNotContain(KEY);
    }

    @Test
    void anImageOfOurOwnStorageIsReadFromItNotDownloaded() {
        answer.set(new Answer(200, imageAnswer(generated), 0));
        String ours = "https://s3.example/jeparla-public/products/1/2/a.png";
        GeminiImageProvider provider = new GeminiImageProvider(properties(KEY, Duration.ofSeconds(5), 1024 * 1024),
                url -> url.equals(ours) ? Optional.of(product) : Optional.empty());

        provider.generate(new GenerationRequest(1, "AI_PHOTOSHOOT", ours, "p", List.of(), 1, "4:5", Map.of()));

        assertThat(requests).containsExactly("POST " + GENERATE);
    }

    // ------------------------------------------------------------------ failures

    @Test
    void aSafetyBlockIsARefusal() {
        answer.set(new Answer(200, "{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}", 0));
        assertCode(() -> provider().generate(request(1, List.of())), ImageGenerationException.REFUSED);

        answer.set(new Answer(200, "{\"candidates\":[{\"finishReason\":\"IMAGE_SAFETY\"}]}", 0));
        assertCode(() -> provider().generate(request(1, List.of())), ImageGenerationException.REFUSED);
    }

    @Test
    void anAnswerWithoutAnImageAndWithoutABlockIsAProviderError() {
        answer.set(new Answer(200, "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Sorry, no.\"}]},"
                + "\"finishReason\":\"STOP\"}]}", 0));
        assertCode(() -> provider().generate(request(1, List.of())), ImageGenerationException.PROVIDER_ERROR);

        answer.set(new Answer(200, "not json", 0));
        assertCode(() -> provider().generate(request(1, List.of())), ImageGenerationException.PROVIDER_ERROR);
    }

    @Test
    void anHttpErrorIsAProviderErrorWithoutTheProvidersText() {
        answer.set(new Answer(500, "{\"error\":{\"code\":500,\"message\":\"internal secret detail\"}}", 0));
        assertThatThrownBy(() -> provider().generate(request(1, List.of())))
                .isInstanceOf(ImageGenerationException.class)
                .satisfies(e -> assertThat(((ImageGenerationException) e).code())
                        .isEqualTo(ImageGenerationException.PROVIDER_ERROR))
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("secret detail").doesNotContain(KEY));

        answer.set(new Answer(429, "{}", 0));
        assertCode(() -> provider().generate(request(1, List.of())), ImageGenerationException.PROVIDER_ERROR);
    }

    @Test
    void noAnswerInTimeIsATimeout() {
        answer.set(new Answer(200, imageAnswer(generated), 3000));
        GeminiImageProvider slow = new GeminiImageProvider(properties(KEY, Duration.ofMillis(300), 1024 * 1024),
                url -> Optional.empty());
        assertCode(() -> slow.generate(request(1, List.of())), ImageGenerationException.TIMEOUT);
    }

    @Test
    void inputsMustBeHttpImagesWithinTheLimit() {
        answer.set(new Answer(200, imageAnswer(generated), 0));
        GeminiImageProvider provider = new GeminiImageProvider(properties(KEY, Duration.ofSeconds(5), 2048),
                url -> Optional.empty());
        for (String url : List.of("file:///etc/passwd", "/demo/ring.jpg", base + "/img/page.html",
                base + "/img/huge.png", base + "/img/missing.png")) {
            assertCode(() -> provider.generate(new GenerationRequest(1, "AI_PHOTOSHOOT", url, "p", List.of(), 1, "4:5",
                    Map.of())), ImageGenerationException.PROVIDER_ERROR);
        }
        assertThat(requests).isEmpty();
    }
}
