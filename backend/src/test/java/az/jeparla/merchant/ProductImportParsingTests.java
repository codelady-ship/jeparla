package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.product.FashionMaterial;
import az.jeparla.product.Metal;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** CSV reading and value parsing of the product import (#109). No Spring context, no database. */
class ProductImportParsingTests {

    @Test
    void excelSemicolonsQuotesLineBreaksAndBlankLines() {
        String csv = "﻿Kateqoriya;Ad (az);Qiymət (AZN)\r\n"
                + "rings;\"Üzük; \"\"Lalə\"\"\";1 250,50\r\n"
                + "\r\n"
                + "rings;\"İki\nsətir\";99\n";
        List<CsvTable.Row> rows = CsvTable.parse(csv);
        assertThat(rows).hasSize(3);
        assertThat(rows.get(0).fields()).containsExactly("Kateqoriya", "Ad (az)", "Qiymət (AZN)");
        assertThat(rows.get(1).line()).isEqualTo(2);
        assertThat(rows.get(1).fields()).containsExactly("rings", "Üzük; \"Lalə\"", "1 250,50");
        assertThat(rows.get(2).line()).isEqualTo(4);
        assertThat(rows.get(2).field(1)).isEqualTo("İki\nsətir");
        assertThat(rows.get(2).field(7)).isEmpty();
    }

    @Test
    void theDelimiterComesFromTheHeader() {
        assertThat(CsvTable.delimiter("a,b,c\n1;2")).isEqualTo(',');
        assertThat(CsvTable.delimiter("a;b;c")).isEqualTo(';');
        assertThat(CsvTable.delimiter("a\tb\tc")).isEqualTo('\t');
        assertThat(CsvTable.delimiter("\"a;b\",c")).isEqualTo(',');
    }

    @Test
    void anUnclosedQuoteIsRefused() {
        assertThatThrownBy(() -> CsvTable.parse("a,b\n\"x,y\n")).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "4,20      | 4.20",
            "4.20      | 4.20",
            "1 250,50  | 1250.50",
            "0,125     | 0.125",
            "12        | 12"})
    void decimalsAreExactWithACommaOrAPoint(String text, String expected) {
        assertThat(ImportColumn.decimal(text)).contains(new BigDecimal(expected));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"1,250.50", "1.2.3", "abc", "-5", "4,2,0", "1e3"})
    void ambiguousOrInvalidNumbersAreRefused(String text) {
        assertThat(ImportColumn.decimal(text)).isEmpty();
    }

    @Test
    void headersMatchInAnyLanguageAndConstantsIgnoreCase() {
        Map<ImportColumn, List<String>> labels = Map.of(ImportColumn.PRICE, List.of("Qiymət (AZN)", "Цена (AZN)"));
        assertThat(ImportColumn.match("qiymet (azn)", c -> labels.getOrDefault(c, List.of())))
                .contains(ImportColumn.PRICE);
        assertThat(ImportColumn.match("ЦЕНА (AZN)", c -> labels.getOrDefault(c, List.of())))
                .contains(ImportColumn.PRICE);
        assertThat(ImportColumn.match("name_az", c -> List.of())).contains(ImportColumn.NAME_AZ);
        assertThat(ImportColumn.match("Colour", c -> List.of())).isEmpty();
        assertThat(ImportColumn.constant(Metal.class, "gold")).contains(Metal.GOLD);
        assertThat(ImportColumn.constant(FashionMaterial.class, "Stainless steel"))
                .contains(FashionMaterial.STAINLESS_STEEL);
    }
}
