package az.jeparla.ai;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * The system prompts of AI Studio, kept in the repository ({@code resources/ai/prompts/<kind>.txt}, #121
 * "Sistem promptları repoda") so every change is reviewed. {@code {name}} placeholders are filled from the job's
 * parameters; a missing parameter becomes a neutral default. The API does not start without a prompt for
 * every {@link AiJobKind}.
 */
@Component
public class AiPrompts {

    private static final Map<String, String> DEFAULTS = Map.of("pose", "the part of the body that wears the item",
            "audience", "adult woman or man");

    private final Map<AiJobKind, String> templates = new EnumMap<>(AiJobKind.class);

    public AiPrompts() {
        for (AiJobKind kind : AiJobKind.values()) {
            templates.put(kind, load(kind));
        }
    }

    private static String load(AiJobKind kind) {
        String path = "/ai/prompts/" + kind.name() + ".txt";
        try (InputStream in = AiPrompts.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Missing AI prompt " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).strip();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** The prompt of {@code kind} with {@code parameters} filled in. */
    public String prompt(AiJobKind kind, Map<String, String> parameters) {
        String text = templates.get(kind);
        for (Map.Entry<String, String> entry : DEFAULTS.entrySet()) {
            String value = parameters.getOrDefault(entry.getKey(), entry.getValue());
            text = text.replace("{" + entry.getKey() + "}", value);
        }
        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            text = text.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return text;
    }
}
