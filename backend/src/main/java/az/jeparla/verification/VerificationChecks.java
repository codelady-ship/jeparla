package az.jeparla.verification;

import az.jeparla.product.Product;
import az.jeparla.store.Store;
import java.util.Collection;
import org.springframework.stereotype.Component;

/**
 * The status of a Jeparla Verified check follows its documents (#40): VERIFIED only when an admin approved at
 * least one document, otherwise PENDING while one waits for review, REJECTED when every document was refused
 * or sent back, NONE without documents. Nothing else sets DOCUMENTS or EXPERTISE to VERIFIED, so the badge
 * never claims a check that did not happen (CLAUDE.md, honesty).
 */
@Component
class VerificationChecks {

    private final VerificationDocumentRepository documents;

    VerificationChecks(VerificationDocumentRepository documents) {
        this.documents = documents;
    }

    /** Recomputes the store's documents check. Call after a document of the store was added or reviewed. */
    void refresh(Store store) {
        store.setDocumentsStatus(resolve(documents.statusesOfStore(store.getId(), CheckKind.DOCUMENTS)));
    }

    /** Recomputes the product's expertise check. */
    void refresh(Product product) {
        product.setExpertiseStatus(resolve(documents.statusesOfProduct(product.getId())));
    }

    static CheckStatus resolve(Collection<DocumentStatus> statuses) {
        if (statuses.contains(DocumentStatus.VERIFIED)) {
            return CheckStatus.VERIFIED;
        }
        if (statuses.contains(DocumentStatus.PENDING)) {
            return CheckStatus.PENDING;
        }
        return statuses.isEmpty() ? CheckStatus.NONE : CheckStatus.REJECTED;
    }
}
