package az.jeparla.ai.provider;

import az.jeparla.common.storage.ImageProbe;
import az.jeparla.common.storage.ImageUrls;
import az.jeparla.common.storage.ObjectStorage;
import jakarta.annotation.PreDestroy;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Google Gemini image model as the AI Studio provider ({@code jeparla.ai.image-provider=gemini}, docs/ai-providers.md).
 * One {@code generateContent} call per requested output: the repository prompt, the product photo and the AI model's
 * reference photos go as inline images, the answer's first inline image is the result.
 *
 * <p>Input images are read from the public bucket when the URL is one of ours (no hairpin request through the
 * VM's own domain), otherwise downloaded over http(s) with a size and time limit; only JPEG, PNG and WebP (by magic
 * number) are sent. Failures become {@link ImageGenerationException} codes; the provider's own text is never passed
 * on, and the key is sent only in the {@code x-goog-api-key} header, never logged.
 */
@Component
public class GeminiImageProvider implements ImageGenerationProvider {

    public static final String ID = "gemini";

    /** An image answer is a few MB of base64; anything far larger is not one. */
    static final int MAX_RESPONSE_BYTES = 64 * 1024 * 1024;

    /** Finish reasons that mean the provider's policy stopped the image (a retry will not help). */
    static final Set<String> REFUSAL_REASONS = Set.of("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII",
            "RECITATION", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT", "IMAGE_RECITATION");

    private static final Logger log = LoggerFactory.getLogger(GeminiImageProvider.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final GeminiProperties properties;
    private final Function<String, Optional<byte[]>> fromStorage;
    private final HttpClient http;

    @Autowired
    public GeminiImageProvider(GeminiProperties properties, ObjectStorage storage, ImageUrls urls) {
        this(properties, url -> urls.key(url).flatMap(key -> storage.readPublic(key, properties.maxInputBytes())));
    }

    /**
     * @param fromStorage reads an input image URL from our own storage, or empty to download it
     */
    GeminiImageProvider(GeminiProperties properties, Function<String, Optional<byte[]>> fromStorage) {
        this.properties = properties;
        this.fromStorage = fromStorage;
        this.http = HttpClient.newBuilder()
                .connectTimeout(properties.downloadTimeout().compareTo(properties.timeout()) < 0
                        ? properties.downloadTimeout() : properties.timeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @PreDestroy
    void close() {
        http.close();
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public boolean configured() {
        return properties.configured();
    }

    @Override
    public BigDecimal estimatedCost(GenerationRequest request) {
        return properties.costPerImage().multiply(BigDecimal.valueOf(request.outputs()));
    }

    @Override
    public GenerationResult generate(GenerationRequest request) {
        if (!configured()) {
            throw new ImageGenerationException(ImageGenerationException.NOT_CONFIGURED,
                    "Gemini has no API key (JEPARLA_GEMINI_API_KEY)");
        }
        List<InputImage> inputs = new ArrayList<>();
        inputs.add(input(request.sourceImageUrl()));
        request.referenceImageUrls().stream().limit(properties.maxReferenceImages())
                .forEach(url -> inputs.add(input(url)));
        String body = body(request, inputs);
        List<GenerationResult.GeneratedImage> images = new ArrayList<>();
        for (int i = 0; i < request.outputs(); i++) {
            images.add(new GenerationResult.GeneratedImage(call(request.jobId(), body)));
        }
        // Gemini reports tokens, not a price: the estimate stays the attempt's cost.
        return new GenerationResult(images, null);
    }

    // ------------------------------------------------------------------ request

    /** One input image: its type by magic number and its bytes. */
    record InputImage(String mimeType, byte[] bytes) {
    }

    String body(GenerationRequest request, List<InputImage> inputs) {
        ObjectNode root = JSON.createObjectNode();
        ObjectNode content = root.putArray("contents").addObject();
        content.put("role", "user");
        ArrayNode parts = content.putArray("parts");
        parts.addObject().put("text", promptText(request.prompt(), inputs.size() - 1));
        for (InputImage image : inputs) {
            ObjectNode inline = parts.addObject().putObject("inline_data");
            inline.put("mime_type", image.mimeType());
            inline.put("data", Base64.getEncoder().encodeToString(image.bytes()));
        }
        ObjectNode config = root.putObject("generationConfig");
        config.putArray("responseModalities").add("IMAGE");
        if (request.aspectRatio() != null && !request.aspectRatio().isBlank()) {
            config.putObject("imageConfig").put("aspectRatio", request.aspectRatio());
        }
        return JSON.writeValueAsString(root);
    }

    /** The repository prompt plus which input image is which. */
    static String promptText(String prompt, int references) {
        if (references <= 0) {
            return prompt + "\n\nInput image: the first and only image is the item.";
        }
        return prompt + "\n\nInput images: the first image is the item. The next " + references
                + " image(s) are reference photos of the AI-generated model: keep the same face, skin tone, hair"
                + " and body proportions.";
    }

    private InputImage input(String url) {
        byte[] bytes = fromStorage.apply(url).orElseGet(() -> download(url));
        if (bytes.length > properties.maxInputBytes()) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                    "Gemini input image is over the size limit");
        }
        String type = ImageProbe.probe(bytes).map(ImageProbe.ImageInfo::contentType)
                .orElseThrow(() -> new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                        "Gemini input is not a JPEG, PNG or WebP image"));
        return new InputImage(type, bytes);
    }

    private byte[] download(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR, "Gemini input URL is invalid");
        }
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                    "Gemini input URL is not an absolute http(s) URL");
        }
        HttpRequest request = HttpRequest.newBuilder(uri).GET().timeout(properties.downloadTimeout())
                .header("Accept", "image/jpeg, image/png, image/webp").build();
        // The future bounds the whole answer (headers and body); the handler bounds its size.
        HttpResponse<byte[]> response = await(http.sendAsync(request, limited(properties.maxInputBytes())),
                properties.downloadTimeout(), "input image");
        if (response.statusCode() != 200) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                    "Gemini input image answered HTTP " + response.statusCode());
        }
        String contentType = response.headers().firstValue("Content-Type").orElse("");
        if (!contentType.isEmpty() && !contentType.startsWith("image/")
                && !contentType.startsWith("application/octet-stream")) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                    "Gemini input image has a non-image type");
        }
        return response.body();
    }

    // ------------------------------------------------------------------ call

    private byte[] call(long jobId, String body) {
        URI uri = URI.create(properties.endpoint() + "/models/" + properties.model() + ":generateContent");
        HttpRequest request = HttpRequest.newBuilder(uri)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .timeout(properties.timeout())
                .header("Content-Type", "application/json; charset=utf-8")
                .header("Accept", "application/json")
                .header("x-goog-api-key", properties.apiKey())
                .build();
        HttpResponse<byte[]> response = await(http.sendAsync(request, limited(MAX_RESPONSE_BYTES)),
                properties.timeout(), "generateContent");
        int status = response.statusCode();
        if (status != 200) {
            // The body may echo the request; only the status is logged.
            log.info("Gemini answered HTTP {} for AI job {}", status, jobId);
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR, "Gemini answered HTTP " + status);
        }
        return image(jobId, response.body());
    }

    /** The first inline image of an answer, or the matching failure. */
    static byte[] image(long jobId, byte[] answer) {
        JsonNode root;
        try {
            root = JSON.readTree(answer);
        } catch (JacksonException e) {
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR, "Gemini answer is not JSON");
        }
        String blocked = root.path("promptFeedback").path("blockReason").asString("");
        if (!blocked.isEmpty()) {
            log.info("Gemini blocked the prompt of AI job {}: {}", jobId, blocked);
            throw new ImageGenerationException(ImageGenerationException.REFUSED, "Gemini blocked the prompt: " + blocked);
        }
        String finish = "";
        for (JsonNode candidate : root.path("candidates")) {
            if (finish.isEmpty()) {
                finish = candidate.path("finishReason").asString("");
            }
            for (JsonNode part : candidate.path("content").path("parts")) {
                JsonNode inline = part.has("inlineData") ? part.get("inlineData") : part.path("inline_data");
                String data = inline.path("data").asString("");
                if (!data.isEmpty()) {
                    try {
                        return Base64.getDecoder().decode(data);
                    } catch (IllegalArgumentException e) {
                        throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                                "Gemini image is not valid base64");
                    }
                }
            }
        }
        if (REFUSAL_REASONS.contains(finish)) {
            log.info("Gemini refused the image of AI job {}: {}", jobId, finish);
            throw new ImageGenerationException(ImageGenerationException.REFUSED, "Gemini refused the image: " + finish);
        }
        throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                "Gemini returned no image (finish reason " + (finish.isEmpty() ? "none" : finish) + ")");
    }

    // ------------------------------------------------------------------ helpers

    private static <T> T await(CompletableFuture<T> pending, Duration timeout, String what) {
        try {
            return pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw new ImageGenerationException(ImageGenerationException.TIMEOUT, "Interrupted waiting for Gemini " + what, e);
        } catch (TimeoutException e) {
            pending.cancel(true);
            throw new ImageGenerationException(ImageGenerationException.TIMEOUT,
                    "No answer for Gemini " + what + " within " + timeout, e);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof HttpTimeoutException) {
                throw new ImageGenerationException(ImageGenerationException.TIMEOUT,
                        "No answer for Gemini " + what + " within " + timeout, cause);
            }
            throw new ImageGenerationException(ImageGenerationException.PROVIDER_ERROR,
                    "Gemini " + what + " request failed: " + (cause == null ? "unknown" : cause.getClass().getSimpleName()),
                    cause);
        }
    }

    /** A body handler that keeps at most {@code maxBytes}; a larger body fails the request. */
    static HttpResponse.BodyHandler<byte[]> limited(int maxBytes) {
        return info -> new LimitedBody(maxBytes);
    }

    /** Fails a request inside the HTTP client when its body is over the limit. */
    static final class TooLargeException extends IOException {
        TooLargeException() {
            super("body over the size limit");
        }
    }

    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {

        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();
        private final int maxBytes;
        private Flow.Subscription subscription;

        LimitedBody(int maxBytes) {
            this.maxBytes = maxBytes;
        }

        @Override
        public CompletionStage<byte[]> getBody() {
            return result;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            subscription.request(Long.MAX_VALUE);
        }

        @Override
        public void onNext(List<ByteBuffer> items) {
            if (result.isDone()) {
                return;
            }
            for (ByteBuffer item : items) {
                if ((long) out.size() + item.remaining() > maxBytes) {
                    subscription.cancel();
                    result.completeExceptionally(new TooLargeException());
                    return;
                }
                byte[] chunk = new byte[item.remaining()];
                item.get(chunk);
                out.writeBytes(chunk);
            }
        }

        @Override
        public void onError(Throwable error) {
            result.completeExceptionally(error);
        }

        @Override
        public void onComplete() {
            result.complete(out.toByteArray());
        }
    }
}
