package az.jeparla.merchant;

import az.jeparla.merchant.CsvTable.Row;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.NumberToTextConverter;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * Reads the first sheet of an Excel .xlsx file for the product import (#109) into the same rows as
 * {@link CsvTable}: the header first, blank rows skipped, every row keeping its sheet row number (1-based) so an
 * error names the line the seller sees in Excel. Apache POI (Apache-2.0) only reads cell values: formulas are not
 * evaluated (their cached value is used), macros and external links are ignored.
 *
 * <p>Numbers are written as Excel shows them with 15 significant digits ({@link NumberToTextConverter}), so
 * {@code 4.2} stays {@code "4.2"} and is parsed to {@code BigDecimal} by the import, like a CSV cell; no
 * floating-point value is kept or used for money or weight.
 */
final class XlsxTable {

    /** The import accepts this many columns at most; anything to the right is ignored. */
    private static final int MAX_COLUMNS = 40;

    private XlsxTable() {
    }

    static {
        // Refuse zip bombs: an entry may not inflate more than 100 times its packed size, nor exceed 20 MB.
        ZipSecureFile.setMinInflateRatio(0.01);
        ZipSecureFile.setMaxEntrySize(20L * 1024 * 1024);
    }

    /**
     * All non-blank rows of the first sheet.
     *
     * @throws IllegalArgumentException when the bytes are not a readable .xlsx workbook
     */
    static List<Row> parse(byte[] bytes, int maxRows) {
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            if (workbook.getNumberOfSheets() == 0) {
                return List.of();
            }
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter(Locale.ROOT);
            List<Row> rows = new ArrayList<>();
            for (org.apache.poi.ss.usermodel.Row source : sheet) {
                if (rows.size() > maxRows + 1) {
                    // Enough to report "too many rows" without reading a huge sheet.
                    break;
                }
                int last = Math.min(Math.max(source.getLastCellNum(), 0), MAX_COLUMNS);
                List<String> fields = new ArrayList<>(last);
                for (int i = 0; i < last; i++) {
                    fields.add(text(source.getCell(i), formatter));
                }
                Row row = new Row(source.getRowNum() + 1, fields);
                if (!row.blank()) {
                    rows.add(row);
                }
            }
            return rows;
        } catch (IOException | RuntimeException e) {
            throw new IllegalArgumentException("not a readable xlsx workbook", e);
        }
    }

    /** An empty workbook with the header row in bold and the columns sized to it (the Excel template). */
    static byte[] template(List<String> headers) {
        try (XSSFWorkbook book = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = book.createSheet("Jeparla");
            CellStyle bold = book.createCellStyle();
            Font font = book.createFont();
            font.setBold(true);
            bold.setFont(font);
            org.apache.poi.ss.usermodel.Row header = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(bold);
                sheet.setColumnWidth(i, Math.min(255, Math.max(12, headers.get(i).length() + 4)) * 256);
            }
            sheet.createFreezePane(0, 1);
            book.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String text(Cell cell, DataFormatter formatter) {
        if (cell == null) {
            return "";
        }
        CellType type = cell.getCellType() == CellType.FORMULA ? cell.getCachedFormulaResultType() : cell.getCellType();
        return switch (type) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? formatter.formatCellValue(cell)
                    : NumberToTextConverter.toText(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }
}
