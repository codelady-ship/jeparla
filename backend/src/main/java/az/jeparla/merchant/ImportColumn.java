package az.jeparla.merchant;

import az.jeparla.common.i18n.SearchText;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

/**
 * Columns of the product import template (#109). A header cell matches a column by its key ({@code name_az})
 * or by its label in any of the three languages ({@code import.column.<key>} in the message files: "Ad (az)",
 * "Name (az)", "Название (az)"), letters folded, so a seller can fill the template in their language.
 */
enum ImportColumn {
    KIND("kind"),
    CATEGORY("category"),
    NAME_AZ("name_az"),
    NAME_EN("name_en"),
    NAME_RU("name_ru"),
    DESCRIPTION_AZ("description_az"),
    METAL("metal"),
    FINENESS("fineness"),
    MATERIAL("material"),
    WEIGHT("weight"),
    PRICE("price"),
    SIZE("size"),
    SKU("sku"),
    STOCK("stock");

    private final String key;

    ImportColumn(String key) {
        this.key = key;
    }

    String key() {
        return key;
    }

    String messageKey() {
        return "import.column." + key;
    }

    /** The column whose key or one of whose labels is {@code header} (folded). */
    static Optional<ImportColumn> match(String header, Function<ImportColumn, List<String>> labels) {
        String folded = SearchText.fold(header);
        for (ImportColumn column : values()) {
            if (SearchText.fold(column.key.replace('_', ' ')).equals(folded)) {
                return Optional.of(column);
            }
            for (String label : labels.apply(column)) {
                if (SearchText.fold(label).equals(folded)) {
                    return Optional.of(column);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * A decimal as sellers type it: "4,20" and "4.20" are the same, spaces between thousands are allowed
     * ("1 250,50"). A text with both a comma and a point, or more than one of them, is ambiguous: empty.
     */
    static Optional<BigDecimal> decimal(String text) {
        if (text == null) {
            return Optional.empty();
        }
        String value = text.replace(" ", "").replace(" ", "").replace(" ", "").strip();
        if (value.isEmpty()) {
            return Optional.empty();
        }
        int commas = value.length() - value.replace(",", "").length();
        int points = value.length() - value.replace(".", "").length();
        if (commas + points > 1) {
            return Optional.empty();
        }
        value = value.replace(',', '.');
        if (!value.matches("\\d+(\\.\\d+)?")) {
            return Optional.empty();
        }
        return Optional.of(new BigDecimal(value));
    }

    /** An enum constant by its name, case and spacing ignored ("gold", "Stainless steel"). */
    static <E extends Enum<E>> Optional<E> constant(Class<E> type, String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String name = text.strip().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
        for (E value : type.getEnumConstants()) {
            if (value.name().equals(name)) {
                return Optional.of(value);
            }
        }
        return Optional.empty();
    }
}
