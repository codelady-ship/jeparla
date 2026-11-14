package az.jeparla.merchant;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;

/**
 * Takes product photos out of a seller's catalog PDF (#129) with Apache PDFBox. Only two things are read: the
 * images embedded in each page and the page text (for suggestions). PDFBox does not run the JavaScript, forms
 * or actions a PDF may carry, and nothing here follows links or opens attachments.
 *
 * <p>Limits against hostile files: at most {@value #MAX_PAGES} pages, no encrypted files, an image is decoded
 * only when its declared size is at most {@value #MAX_PIXELS} pixels, images under {@value #MIN_SIDE} px on a
 * side (icons, logos, decorations) are skipped, the same image object is taken once (a logo on every page),
 * and at most {@value #MAX_IMAGES} images per file. A page without a usable embedded image (a scanned or
 * vector page) is rendered at {@value #RENDER_DPI} DPI instead. Every result is a JPEG at most
 * {@value #MAX_OUTPUT_SIDE} px on its longest side.
 */
final class CatalogPdf {

    static final int MAX_PAGES = 30;
    static final int MAX_IMAGES = 60;
    static final int MIN_SIDE = 200;
    static final long MAX_PIXELS = 40_000_000L;
    static final int RENDER_DPI = 110;
    static final int MAX_OUTPUT_SIDE = 2000;
    private static final int MAX_FORM_DEPTH = 3;

    /** One photo: JPEG bytes, its size, the 1-based page and the text of that page. */
    record Photo(byte[] jpeg, int width, int height, int page, String pageText, boolean onlyOneOnPage) {
    }

    /** The file is not a readable PDF, is encrypted or has too many pages. */
    static final class Refused extends Exception {

        private final String code;

        Refused(String code, Throwable cause) {
            super(code, cause);
            this.code = code;
        }

        String code() {
            return code;
        }
    }

    private CatalogPdf() {
    }

    static List<Photo> photos(byte[] pdf) throws Refused {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            if (document.isEncrypted()) {
                throw new Refused("merchant.pdf_encrypted", null);
            }
            int pages = document.getNumberOfPages();
            if (pages > MAX_PAGES) {
                throw new Refused("merchant.pdf_pages", null);
            }
            PDFTextStripper text = new PDFTextStripper();
            PDFRenderer renderer = new PDFRenderer(document);
            Map<COSBase, Boolean> seen = new IdentityHashMap<>();
            List<Photo> photos = new ArrayList<>();
            for (int i = 0; i < pages && photos.size() < MAX_IMAGES; i++) {
                PDPage page = document.getPage(i);
                text.setStartPage(i + 1);
                text.setEndPage(i + 1);
                String pageText = text.getText(document);
                List<BufferedImage> images = new ArrayList<>();
                collect(page.getResources(), seen, images, 0);
                if (images.isEmpty()) {
                    BufferedImage rendered = render(renderer, page, i);
                    if (rendered != null) {
                        images.add(rendered);
                    }
                }
                for (BufferedImage image : images) {
                    if (photos.size() >= MAX_IMAGES) {
                        break;
                    }
                    BufferedImage rgb = fitted(image);
                    photos.add(new Photo(jpeg(rgb), rgb.getWidth(), rgb.getHeight(), i + 1, pageText,
                            images.size() == 1));
                }
            }
            return photos;
        } catch (IOException | RuntimeException e) {
            throw new Refused("merchant.pdf_invalid", e);
        }
    }

    private static void collect(PDResources resources, Map<COSBase, Boolean> seen, List<BufferedImage> images,
            int depth) throws IOException {
        if (resources == null || depth > MAX_FORM_DEPTH) {
            return;
        }
        for (COSName name : resources.getXObjectNames()) {
            PDXObject object;
            try {
                object = resources.getXObject(name);
            } catch (IOException e) {
                continue;
            }
            if (object == null || seen.put(object.getCOSObject(), Boolean.TRUE) != null) {
                continue;
            }
            if (object instanceof PDImageXObject image) {
                long pixels = (long) image.getWidth() * image.getHeight();
                if (image.getWidth() < MIN_SIDE || image.getHeight() < MIN_SIDE || pixels > MAX_PIXELS) {
                    continue;
                }
                try {
                    BufferedImage decoded = image.getImage();
                    if (decoded != null) {
                        images.add(decoded);
                    }
                } catch (IOException | RuntimeException e) {
                    // A format without a decoder here (JBIG2, JPEG 2000) or a broken stream: skip this image.
                }
            } else if (object instanceof PDFormXObject form) {
                collect(form.getResources(), seen, images, depth + 1);
            }
        }
    }

    /** The whole page as an image, or null when it is unreasonably large. */
    private static BufferedImage render(PDFRenderer renderer, PDPage page, int index) throws IOException {
        PDRectangle box = page.getCropBox();
        double scale = RENDER_DPI / 72.0;
        if (box.getWidth() * scale > 5000 || box.getHeight() * scale > 5000) {
            return null;
        }
        return renderer.renderImageWithDPI(index, RENDER_DPI, ImageType.RGB);
    }

    /** An RGB copy at most {@link #MAX_OUTPUT_SIDE} px on its longest side (JPEG has no alpha). */
    static BufferedImage fitted(BufferedImage image) {
        double scale = Math.min(1.0, (double) MAX_OUTPUT_SIDE / Math.max(image.getWidth(), image.getHeight()));
        int width = Math.max(1, (int) Math.round(image.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(image.getHeight() * scale));
        BufferedImage rgb = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, width, height);
            g.drawImage(image, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    static byte[] jpeg(BufferedImage rgb) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(rgb, "jpg", out)) {
            throw new IOException("No JPEG writer");
        }
        return out.toByteArray();
    }
}
