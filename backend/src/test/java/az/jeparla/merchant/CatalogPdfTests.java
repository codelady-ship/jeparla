package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.List;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Photos and suggestions out of a catalog PDF (#129). No Spring context, no storage. */
class CatalogPdfTests {

    private static BufferedImage photo(int width, int height, Color color) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, width, height);
        g.dispose();
        return image;
    }

    /** Page 1: one product photo, a logo too small to be a product, and its text; page 2: text only. */
    static byte[] catalog(int pages) throws Exception {
        try (PDDocument document = new PDDocument()) {
            PDImageXObject product = LosslessFactory.createFromImage(document, photo(600, 400, Color.ORANGE));
            PDImageXObject logo = LosslessFactory.createFromImage(document, photo(80, 80, Color.BLACK));
            for (int i = 0; i < pages; i++) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.drawImage(logo, 20, 760, 40, 40);
                    if (i == 0) {
                        content.drawImage(product, 50, 300, 300, 200);
                    }
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
                    content.newLineAtOffset(50, 250);
                    content.showText(i == 0 ? "Lale ring" : "Contacts");
                    content.newLineAtOffset(0, -20);
                    content.showText(i == 0 ? "4,20 gr" : "Baku");
                    content.newLineAtOffset(0, -20);
                    content.showText(i == 0 ? "1 250,50 AZN" : "");
                    content.endText();
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void embeddedPhotosAreTakenAndAPageWithoutOneIsRendered() throws Exception {
        List<CatalogPdf.Photo> photos = CatalogPdf.photos(catalog(2));
        assertThat(photos).hasSize(2);
        CatalogPdf.Photo first = photos.get(0);
        assertThat(first.page()).isEqualTo(1);
        assertThat(first.width()).isEqualTo(600);
        assertThat(first.height()).isEqualTo(400);
        assertThat(first.onlyOneOnPage()).isTrue();
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(first.jpeg()));
        assertThat(decoded.getWidth()).isEqualTo(600);
        // The logo is on every page and too small: never a draft. Page 2 has no photo, so it is rendered.
        assertThat(photos.get(1).page()).isEqualTo(2);
        assertThat(photos.get(1).width()).isGreaterThan(800);

        DraftSuggestions suggestions = DraftSuggestions.of(first.pageText());
        assertThat(suggestions.name()).isEqualTo("Lale ring");
        assertThat(suggestions.price()).isEqualByComparingTo("1250.50");
        assertThat(suggestions.weight()).isEqualByComparingTo("4.200");
    }

    @Test
    void tooManyPagesAndNonPdfFilesAreRefused() throws Exception {
        assertThatThrownBy(() -> CatalogPdf.photos(catalog(CatalogPdf.MAX_PAGES + 1)))
                .isInstanceOf(CatalogPdf.Refused.class).hasMessage("merchant.pdf_pages");
        assertThatThrownBy(() -> CatalogPdf.photos("%PDF-1.7 not really".getBytes()))
                .isInstanceOf(CatalogPdf.Refused.class).hasMessage("merchant.pdf_invalid");
    }

    @Test
    void bigImagesAreScaledDownToJpeg() throws Exception {
        BufferedImage fitted = CatalogPdf.fitted(photo(4000, 1000, Color.WHITE));
        assertThat(fitted.getWidth()).isEqualTo(CatalogPdf.MAX_OUTPUT_SIDE);
        assertThat(fitted.getHeight()).isEqualTo(500);
        assertThat(CatalogPdf.jpeg(fitted)).startsWith((byte) 0xFF, (byte) 0xD8);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Üzük 990 ₼            | 990.00",
            "Qiymət: 1 250,50 AZN   | 1250.50",
            "45 manat               | 45.00",
            "AZN 300                | 300.00",
            "₼ 99,9                 | 99.90"})
    void pricesInManat(String text, String expected) {
        assertThat(DraftSuggestions.price(text)).contains(new BigDecimal(expected));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Çəki 4,2 q      | 4.200",
            "3.25 gr         | 3.250",
            "5 g             | 5.000",
            "Вес 4,2 г       | 4.200",
            "3 qram          | 3.000"})
    void weightsInGrams(String text, String expected) {
        assertThat(DraftSuggestions.weight(text)).contains(new BigDecimal(expected));
    }

    @Test
    void noSuggestionWithoutAMatch() {
        assertThat(DraftSuggestions.price("Model 585, ölçü 17")).isEmpty();
        assertThat(DraftSuggestions.weight("Qızıl üzük 585")).isEmpty();
        assertThat(DraftSuggestions.of("").name()).isNull();
    }
}
