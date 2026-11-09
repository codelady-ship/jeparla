package az.jeparla.contract;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;
import tools.jackson.databind.JsonNode;

/**
 * Compares a backend response with the frontend mock's JSON for the same call.
 *
 * <ul>
 *   <li><b>Shape:</b> the same JSON type at every path, the same keys in every object, the same array
 *       lengths. A field that is {@code null} on one side must be {@code null} on the other.</li>
 *   <li><b>Values</b> (unless shape only): equal, where decimal strings are compared as numbers
 *       ({@code "0.10"} = {@code "0.100"}) and ISO date-times as instants
 *       ({@code "2026-11-03T10:05:00+04:00"} = {@code "2026-11-03T06:05:00Z"}).</li>
 * </ul>
 *
 * In shape-only mode arrays may differ in length; every element is checked against the first
 * expected element.
 */
final class JsonContract {

    private final boolean valuesToo;
    private final Predicate<String> ignoredValue;
    private final List<String> differences = new ArrayList<>();

    private JsonContract(boolean valuesToo, Predicate<String> ignoredValue) {
        this.valuesToo = valuesToo;
        this.ignoredValue = ignoredValue;
    }

    /** Differences between {@code expected} (mock) and {@code actual} (backend); empty when they match. */
    static List<String> differences(JsonNode expected, JsonNode actual, boolean valuesToo,
            Predicate<String> ignoredValue) {
        JsonContract contract = new JsonContract(valuesToo, ignoredValue);
        contract.compare("$", expected, actual);
        return contract.differences;
    }

    private void compare(String path, JsonNode expected, JsonNode actual) {
        if (differences.size() > 50) {
            return;
        }
        String expectedType = type(expected);
        String actualType = type(actual);
        if (!expectedType.equals(actualType)) {
            differences.add(path + ": mock " + expectedType + " " + expected + ", backend " + actualType + " " + actual);
            return;
        }
        switch (expectedType) {
            case "object" -> compareObjects(path, expected, actual);
            case "array" -> compareArrays(path, expected, actual);
            case "null" -> {
            }
            default -> compareValues(path, expected, actual);
        }
    }

    private void compareObjects(String path, JsonNode expected, JsonNode actual) {
        Set<String> expectedKeys = new TreeSet<>(expected.propertyNames());
        Set<String> actualKeys = new TreeSet<>(actual.propertyNames());
        if (!expectedKeys.equals(actualKeys)) {
            Set<String> missing = new TreeSet<>(expectedKeys);
            missing.removeAll(actualKeys);
            Set<String> extra = new TreeSet<>(actualKeys);
            extra.removeAll(expectedKeys);
            differences.add(path + ": keys missing in backend " + missing + ", extra in backend " + extra);
        }
        for (String key : expectedKeys) {
            if (actualKeys.contains(key)) {
                compare(path + "." + key, expected.get(key), actual.get(key));
            }
        }
    }

    private void compareArrays(String path, JsonNode expected, JsonNode actual) {
        if (valuesToo) {
            if (expected.size() != actual.size()) {
                differences.add(path + ": mock has " + expected.size() + " elements, backend " + actual.size());
            }
            for (int i = 0; i < Math.min(expected.size(), actual.size()); i++) {
                compare(path + "[" + i + "]", expected.get(i), actual.get(i));
            }
            return;
        }
        if (expected.isEmpty() != actual.isEmpty()) {
            differences.add(path + ": one side is empty (mock " + expected.size() + ", backend " + actual.size() + ")");
        }
        if (!expected.isEmpty()) {
            for (int i = 0; i < actual.size(); i++) {
                compare(path + "[" + i + "]", expected.get(0), actual.get(i));
            }
        }
    }

    private void compareValues(String path, JsonNode expected, JsonNode actual) {
        if (!valuesToo || ignoredValue.test(path)) {
            return;
        }
        boolean equal = switch (type(expected)) {
            case "number" -> expected.decimalValue().compareTo(actual.decimalValue()) == 0;
            case "string" -> sameString(expected.stringValue(), actual.stringValue());
            default -> expected.equals(actual);
        };
        if (!equal) {
            differences.add(path + ": mock " + expected + ", backend " + actual);
        }
    }

    private static boolean sameString(String expected, String actual) {
        if (expected.equals(actual)) {
            return true;
        }
        BigDecimal expectedNumber = decimal(expected);
        BigDecimal actualNumber = decimal(actual);
        if (expectedNumber != null && actualNumber != null) {
            return expectedNumber.compareTo(actualNumber) == 0;
        }
        OffsetDateTime expectedTime = dateTime(expected);
        OffsetDateTime actualTime = dateTime(actual);
        return expectedTime != null && actualTime != null && expectedTime.toInstant().equals(actualTime.toInstant());
    }

    private static BigDecimal decimal(String value) {
        if (!value.matches("-?\\d+(\\.\\d+)?")) {
            return null;
        }
        return new BigDecimal(value);
    }

    private static OffsetDateTime dateTime(String value) {
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String type(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return "null";
        }
        if (node.isObject()) {
            return "object";
        }
        if (node.isArray()) {
            return "array";
        }
        if (node.isString()) {
            return "string";
        }
        if (node.isNumber()) {
            return "number";
        }
        if (node.isBoolean()) {
            return "boolean";
        }
        return node.getNodeType().toString();
    }
}
