package az.jeparla.merchant;

import java.util.ArrayList;
import java.util.List;

/**
 * A small RFC 4180 reader for the product import (#109): quoted fields with doubled quotes and line breaks,
 * CRLF or LF, a UTF-8 byte order mark. The delimiter is the one of {@code , ; TAB} that the header line uses
 * most (Excel saves CSV with {@code ;} in the Azerbaijani and Russian locales). Empty lines are skipped; every
 * record keeps the line it started on, so an error can name it.
 */
final class CsvTable {

    /** One record: its first line in the file (1-based) and its fields. */
    record Row(int line, List<String> fields) {

        String field(int index) {
            return index < fields.size() ? fields.get(index).strip() : "";
        }

        boolean blank() {
            return fields.stream().allMatch(String::isBlank);
        }
    }

    private CsvTable() {
    }

    /** All non-blank records, the header first; 400-style errors are the caller's (an unclosed quote throws). */
    static List<Row> parse(String text) {
        String csv = text.startsWith("﻿") ? text.substring(1) : text;
        char delimiter = delimiter(csv);
        List<Row> rows = new ArrayList<>();
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        int line = 1;
        int rowLine = 1;
        for (int i = 0; i < csv.length(); i++) {
            char c = csv.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < csv.length() && csv.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    if (c == '\n') {
                        line++;
                    }
                    field.append(c);
                }
            } else if (c == '"' && field.isEmpty()) {
                quoted = true;
            } else if (c == delimiter) {
                fields.add(field.toString());
                field.setLength(0);
            } else if (c == '\r' || c == '\n') {
                if (c == '\r' && i + 1 < csv.length() && csv.charAt(i + 1) == '\n') {
                    i++;
                }
                fields.add(field.toString());
                field.setLength(0);
                add(rows, new Row(rowLine, List.copyOf(fields)));
                fields.clear();
                line++;
                rowLine = line;
            } else {
                field.append(c);
            }
        }
        if (quoted) {
            throw new IllegalArgumentException("Unclosed quote in the record of line " + rowLine);
        }
        if (!field.isEmpty() || !fields.isEmpty()) {
            fields.add(field.toString());
            add(rows, new Row(rowLine, List.copyOf(fields)));
        }
        return rows;
    }

    private static void add(List<Row> rows, Row row) {
        if (!row.blank()) {
            rows.add(row);
        }
    }

    /** The delimiter the first line uses most: {@code ;}, TAB or {@code ,} (the default). */
    static char delimiter(String csv) {
        int end = csv.indexOf('\n');
        String header = end < 0 ? csv : csv.substring(0, end);
        int commas = count(header, ',');
        int semicolons = count(header, ';');
        int tabs = count(header, '\t');
        if (semicolons > commas && semicolons >= tabs) {
            return ';';
        }
        if (tabs > commas && tabs > semicolons) {
            return '\t';
        }
        return ',';
    }

    private static int count(String text, char c) {
        int n = 0;
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '"') {
                quoted = !quoted;
            } else if (ch == c && !quoted) {
                n++;
            }
        }
        return n;
    }
}
