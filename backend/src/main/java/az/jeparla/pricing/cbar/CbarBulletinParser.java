package az.jeparla.pricing.cbar;

import az.jeparla.product.Metal;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.EnumMap;
import java.util.Map;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/**
 * Reads the bank metals of a CBAR daily bulletin ({@code https://www.cbar.az/currencies/dd.MM.yyyy.xml}).
 * Verified format (November 2026):
 *
 * <pre>{@code
 * <ValCurs Date="06.11.2026" Name="AZN məzənnələri" Description="...">
 *   <ValType Type="Bank metalları">
 *     <Valute Code="XAU"><Nominal>1 t.u.</Nominal><Name>Qızıl</Name><Value>6877.435</Value></Valute>
 *     ... XAG, XPT, XPD
 *   </ValType>
 *   <ValType Type="Xarici valyutalar"> ... </ValType>
 * </ValCurs>
 * }</pre>
 *
 * Values are AZN per troy ounce ("t.u." = troy unsiya). Strict: the whole bulletin is refused when
 * any metal is missing, repeated, not per troy ounce, not a plain positive decimal with at most 4
 * places, or when the date is missing, in the future or too old. A partly valid bulletin is never
 * applied (PLAN 5.10: a wrong price is an S1 bug).
 */
public final class CbarBulletinParser {

    /** CBAR codes of the bank metals (ISO 4217). */
    static final Map<String, Metal> METAL_CODES = Map.of(
            "XAU", Metal.GOLD, "XAG", Metal.SILVER, "XPT", Metal.PLATINUM, "XPD", Metal.PALLADIUM);

    /** "1 troy unsiya". */
    static final String TROY_OUNCE_NOMINAL = "1 t.u.";

    /** Holidays (Novruz, Ramazan and Qurban bayramı with bridge days) are well below this. */
    static final int MAX_BULLETIN_AGE_DAYS = 30;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.uuuu")
            .withResolverStyle(ResolverStyle.STRICT);

    /** Plain decimal, no sign, exponent or grouping; NUMERIC(14,4) holds 10 integer digits. */
    private static final Pattern VALUE = Pattern.compile("\\d{1,10}(\\.\\d{1,4})?");

    private CbarBulletinParser() {
    }

    /**
     * @param xml       the response body
     * @param requested the date asked for (today in Asia/Baku)
     * @throws CbarFeedException (not retryable) when the bulletin is not valid
     */
    public static CbarBulletin parse(byte[] xml, LocalDate requested) {
        Element root = read(xml).getDocumentElement();
        if (!"ValCurs".equals(root.getTagName())) {
            throw invalid("root element is <" + root.getTagName() + ">, expected <ValCurs>");
        }
        LocalDate date = date(root.getAttribute("Date"));
        if (date.isAfter(requested)) {
            throw invalid("bulletin date " + date + " is after the requested date " + requested);
        }
        if (date.isBefore(requested.minusDays(MAX_BULLETIN_AGE_DAYS))) {
            throw invalid("bulletin date " + date + " is more than " + MAX_BULLETIN_AGE_DAYS + " days before "
                    + requested);
        }

        Map<Metal, BigDecimal> prices = new EnumMap<>(Metal.class);
        NodeList valutes = root.getElementsByTagName("Valute");
        for (int i = 0; i < valutes.getLength(); i++) {
            Element valute = (Element) valutes.item(i);
            Metal metal = METAL_CODES.get(valute.getAttribute("Code").trim());
            if (metal == null) {
                continue;
            }
            String code = valute.getAttribute("Code").trim();
            String nominal = normalizeSpace(childText(valute, "Nominal", code));
            if (!TROY_OUNCE_NOMINAL.equals(nominal)) {
                throw invalid(code + " nominal is '" + nominal + "', expected '" + TROY_OUNCE_NOMINAL + "'");
            }
            BigDecimal value = value(childText(valute, "Value", code), code);
            if (prices.put(metal, value) != null) {
                throw invalid(code + " appears more than once");
            }
        }
        for (Map.Entry<String, Metal> code : METAL_CODES.entrySet()) {
            if (!prices.containsKey(code.getValue())) {
                throw invalid(code.getKey() + " (" + code.getValue() + ") is missing");
            }
        }
        return new CbarBulletin(date, prices);
    }

    private static Document read(byte[] xml) {
        if (xml == null || xml.length == 0) {
            throw invalid("empty response");
        }
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // No DTDs, external entities or XInclude: the body is untrusted input (XXE).
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setNamespaceAware(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            // Fatal errors throw; nothing is printed to stderr.
            builder.setErrorHandler(new DefaultHandler());
            return builder.parse(new ByteArrayInputStream(xml));
        } catch (ParserConfigurationException e) {
            throw new IllegalStateException("XML parser does not support the secure settings", e);
        } catch (SAXException | IOException e) {
            throw new CbarFeedException("CBAR bulletin is not well-formed XML: " + e.getMessage(), false, e);
        }
    }

    private static LocalDate date(String raw) {
        if (raw == null || raw.isBlank()) {
            throw invalid("ValCurs has no Date");
        }
        try {
            return LocalDate.parse(raw.trim(), DATE);
        } catch (DateTimeParseException e) {
            throw invalid("ValCurs Date '" + raw + "' is not dd.MM.yyyy");
        }
    }

    private static String childText(Element valute, String tag, String code) {
        String text = null;
        for (Node child = valute.getFirstChild(); child != null; child = child.getNextSibling()) {
            if (child instanceof Element element && tag.equals(element.getTagName())) {
                if (text != null) {
                    throw invalid(code + " has more than one <" + tag + ">");
                }
                text = element.getTextContent();
            }
        }
        if (text == null) {
            throw invalid(code + " has no <" + tag + ">");
        }
        return text;
    }

    private static BigDecimal value(String raw, String code) {
        String text = raw.trim();
        if (!VALUE.matcher(text).matches()) {
            throw invalid(code + " value '" + text + "' is not a plain decimal with at most 4 places");
        }
        BigDecimal value = new BigDecimal(text);
        if (value.signum() <= 0) {
            throw invalid(code + " value " + text + " is not positive");
        }
        return value;
    }

    private static String normalizeSpace(String text) {
        return text.trim().replaceAll("\\s+", " ");
    }

    private static CbarFeedException invalid(String reason) {
        return new CbarFeedException("CBAR bulletin refused: " + reason, false);
    }
}
