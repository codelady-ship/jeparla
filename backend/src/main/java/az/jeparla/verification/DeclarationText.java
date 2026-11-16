package az.jeparla.verification;

import az.jeparla.common.i18n.Language;
import java.util.Locale;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;

/**
 * The declaration a precious-metal seller confirms before every document upload (#138): the documents are
 * genuine, the product details are accurate, and false or forged documents may lead to liability under the law
 * of the Republic of Azerbaijan, including the Criminal Code. The wording is
 * docs/legal/sellers-liability.md, section 2b, kept in the message files ({@value #KEY}) in az, en and ru.
 *
 * <p>Final text of 2026-11-16 (#57, docs/legal/analysis.md; drafted without a licensed lawyer, a review is
 * recommended before a commission-based launch). A new wording needs a new {@link #VERSION}; a seller who
 * confirmed an older version is asked again (409 {@code verification.declaration_outdated}).
 */
@Component
public class DeclarationText {

    /** Version of the wording in the message files; the declarations table keeps it with every confirmation. */
    public static final String VERSION = "precious-2026-11-16";

    /** The wording is final (#57, 2026-11-16); the API field {@code draft} stays for existing clients. */
    public static final boolean DRAFT = false;

    static final String KEY = "seller.precious.declaration";

    private final MessageSource messages;

    public DeclarationText(MessageSource messages) {
        this.messages = messages;
    }

    /** The text in {@code language}, exactly as it is shown and stored. */
    public String text(Language language) {
        return messages.getMessage(KEY, null, Locale.forLanguageTag(language.code()));
    }
}
