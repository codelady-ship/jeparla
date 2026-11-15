package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import az.jeparla.merchant.CsvTable.Row;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

/** Excel import (#109): the first sheet becomes the same rows as a CSV file, numbers as exact decimal text. */
class XlsxTableTests {

    private static byte[] workbook(Object[][] cells) throws IOException {
        try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = book.createSheet("Məhsullar");
            for (int r = 0; r < cells.length; r++) {
                if (cells[r] == null) {
                    continue;
                }
                org.apache.poi.ss.usermodel.Row row = sheet.createRow(r);
                for (int c = 0; c < cells[r].length; c++) {
                    Object value = cells[r][c];
                    if (value instanceof String text) {
                        row.createCell(c).setCellValue(text);
                    } else if (value instanceof Number number) {
                        row.createCell(c).setCellValue(number.doubleValue());
                    }
                }
            }
            book.createSheet("Second").createRow(0).createCell(0).setCellValue("ignored");
            book.write(out);
            return out.toByteArray();
        }
    }

    @Test
    void theFirstSheetIsReadWithSheetRowNumbers() throws IOException {
        List<Row> rows = XlsxTable.parse(workbook(new Object[][] {
            {"category", "name_az", "price", "weight"},
            {"uzukler", "Qızıl üzük", 1250.5, 4.2},
            null,
            {"", "", "", ""},
            {"uzukler", "Gümüş üzük", "99,90", "3,25"},
        }), 200);

        assertThat(rows).hasSize(3);
        assertThat(rows.get(0).fields()).containsExactly("category", "name_az", "price", "weight");
        assertThat(rows.get(1).line()).isEqualTo(2);
        assertThat(rows.get(1).field(1)).isEqualTo("Qızıl üzük");
        // Numbers come out as Excel shows them, so the import parses them to BigDecimal exactly.
        assertThat(new BigDecimal(rows.get(1).field(2))).isEqualByComparingTo("1250.50");
        assertThat(rows.get(1).field(3)).isEqualTo("4.2");
        assertThat(rows.get(2).line()).as("blank rows are skipped, the line stays the sheet row").isEqualTo(5);
        assertThat(rows.get(2).field(2)).isEqualTo("99,90");
    }

    @Test
    void floatingPointNoiseDoesNotReachTheImport() throws IOException {
        List<Row> rows = XlsxTable.parse(workbook(new Object[][] {{"price"}, {0.1 + 0.2}}), 200);
        assertThat(rows.get(1).field(0)).isEqualTo("0.3");
    }

    @Test
    void otherFilesAreRefused() {
        assertThatThrownBy(() -> XlsxTable.parse("a,b\n1,2".getBytes(StandardCharsets.UTF_8), 200))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void readingStopsSoonAfterTheRowLimit() throws IOException {
        Object[][] cells = new Object[50][];
        for (int i = 0; i < cells.length; i++) {
            cells[i] = new Object[] {"row " + i};
        }
        assertThat(XlsxTable.parse(workbook(cells), 10)).hasSizeLessThanOrEqualTo(13);
    }

    @Test
    void theTemplateHasTheHeaderRow() throws IOException {
        byte[] template = XlsxTable.template(List.of("Kateqoriya", "Ad (az)", "Qiymət (AZN)"));
        List<Row> rows = XlsxTable.parse(template, 200);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).fields()).containsExactly("Kateqoriya", "Ad (az)", "Qiymət (AZN)");
    }
}
