package az.jeparla.admin;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The {@code details} JSON object of an audit entry, built from pairs: {@code AuditDetails.of("from", a, "to", b)}.
 * Strings are escaped, so values typed by people (slugs, names, synonyms) cannot break the JSON; numbers and
 * booleans stay JSON numbers and booleans, enums become their name, null stays null.
 */
public final class AuditDetails {

    private AuditDetails() {
    }

    /** {@code pairs}: key, value, key, value ... */
    public static String of(Object... pairs) {
        if (pairs.length % 2 != 0) {
            throw new IllegalArgumentException("Audit details come in key/value pairs");
        }
        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            values.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        StringBuilder json = new StringBuilder("{");
        values.forEach((key, value) -> {
            if (json.length() > 1) {
                json.append(',');
            }
            quote(json, key);
            json.append(':');
            value(json, value);
        });
        return json.append('}').toString();
    }

    private static void value(StringBuilder json, Object value) {
        if (value == null) {
            json.append("null");
        } else if (value instanceof Number || value instanceof Boolean) {
            json.append(value);
        } else if (value instanceof Enum<?> e) {
            quote(json, e.name());
        } else {
            quote(json, value.toString());
        }
    }

    private static void quote(StringBuilder json, String text) {
        json.append('"');
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '"' -> json.append("\\\"");
                case '\\' -> json.append("\\\\");
                case '\n' -> json.append("\\n");
                case '\r' -> json.append("\\r");
                case '\t' -> json.append("\\t");
                default -> {
                    if (c < 0x20) {
                        json.append(String.format("\\u%04x", (int) c));
                    } else {
                        json.append(c);
                    }
                }
            }
        }
        json.append('"');
    }
}
