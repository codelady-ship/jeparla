package az.jeparla.ai;

import az.jeparla.product.Audience;
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
 * every {@link AiJobKind}. A KIDS piece on a model uses its own prompt ({@code VIRTUAL_TRY_ON_KIDS.txt}, #121).
 */
@Component
public class AiPrompts {

    private static final Map<String, String> DEFAULTS = Map.of("pose", "the part of the body that wears the item",
            "audience", "adult woman");

    private final Map<AiJobKind, String> templates = new EnumMap<>(AiJobKind.class);
    private final String kidsTryOn;

    public AiPrompts() {
        for (AiJobKind kind : AiJobKind.values()) {
            templates.put(kind, load(kind.name()));
        }
        kidsTryOn = load(AiJobKind.VIRTUAL_TRY_ON.name() + "_KIDS");
    }

    private static String load(String name) {
        String path = "/ai/prompts/" + name + ".txt";
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
        boolean kids = Audience.KIDS.name().equals(parameters.get(AiJobParameters.AUDIENCE_CODE));
        String text = kind == AiJobKind.VIRTUAL_TRY_ON && kids ? kidsTryOn : templates.get(kind);
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
