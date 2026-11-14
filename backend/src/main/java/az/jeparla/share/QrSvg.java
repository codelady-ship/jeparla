package az.jeparla.share;

import io.nayuki.qrcodegen.QrCode;

/**
 * QR code of a share link as a small SVG (#100), made on the server so the frontend ships no QR library (250 KB
 * script budget). Encoder: Nayuki's {@code qrcodegen} (MIT, one 38 KB jar, no dependencies). The SVG is one path in
 * the brand's dark green ({@code #16251F}, contrast 16:1 on white) on a white square with the 4-module quiet zone of
 * ISO/IEC 18004, scales without blur ({@code viewBox}, {@code crispEdges}), and prints or rasterises to PNG as it is.
 */
public final class QrSvg {

    /** Quiet zone around the symbol, in modules (the standard minimum). */
    static final int BORDER = 4;
    static final String DARK = "#16251F";
    static final String LIGHT = "#FFFFFF";

    private QrSvg() {
    }

    /** The SVG document of a QR code for {@code text} (error correction M or higher, as fits the version). */
    public static String of(String text) {
        QrCode qr = QrCode.encodeText(text, QrCode.Ecc.MEDIUM);
        int size = qr.size + BORDER * 2;
        StringBuilder path = new StringBuilder();
        for (int y = 0; y < qr.size; y++) {
            for (int x = 0; x < qr.size; x++) {
                if (qr.getModule(x, y)) {
                    path.append('M').append(x + BORDER).append(',').append(y + BORDER).append("h1v1h-1z");
                }
            }
        }
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + size + " " + size + "\""
                + " width=\"" + size * 8 + "\" height=\"" + size * 8 + "\" shape-rendering=\"crispEdges\""
                + " role=\"img\" aria-label=\"" + escape(text) + "\">"
                + "<rect width=\"" + size + "\" height=\"" + size + "\" fill=\"" + LIGHT + "\"/>"
                + "<path fill=\"" + DARK + "\" d=\"" + path + "\"/></svg>";
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
