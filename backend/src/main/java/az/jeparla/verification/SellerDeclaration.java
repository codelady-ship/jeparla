package az.jeparla.verification;

import az.jeparla.auth.User;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.i18n.LanguageConverter;
import az.jeparla.common.persistence.LongIdEntity;
import az.jeparla.store.Store;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.net.InetAddress;
import java.time.Instant;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Evidence that a seller confirmed the declaration before uploading a document (#138, V15): the text exactly as
 * it was shown, its version and language, who, when and from which IP. Append-only (a database trigger refuses
 * changes and deletes).
 */
@Entity
@Immutable
@Table(name = "seller_declarations")
public class SellerDeclaration extends LongIdEntity {

    /** NULL after the account is deleted; {@link #userLabel} keeps who it was. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", updatable = false)
    private User user;

    @Column(name = "user_label", nullable = false, updatable = false)
    private String userLabel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "store_id", nullable = false, updatable = false)
    private Store store;

    @Column(name = "text_version", nullable = false, updatable = false)
    private String textVersion;

    @Convert(converter = LanguageConverter.class)
    @Column(name = "language", nullable = false, updatable = false)
    private Language language;

    @Column(name = "text", nullable = false, updatable = false)
    private String text;

    @JdbcTypeCode(SqlTypes.INET)
    @Column(name = "ip_address", updatable = false)
    private InetAddress ipAddress;

    @Column(name = "confirmed_at", nullable = false, updatable = false)
    private Instant confirmedAt;

    protected SellerDeclaration() {
    }

    public SellerDeclaration(User user, String userLabel, Store store, String textVersion, Language language,
            String text, InetAddress ipAddress, Instant confirmedAt) {
        this.user = user;
        this.userLabel = userLabel;
        this.store = store;
        this.textVersion = textVersion;
        this.language = language;
        this.text = text;
        this.ipAddress = ipAddress;
        this.confirmedAt = confirmedAt;
    }

    public User getUser() {
        return user;
    }

    public String getUserLabel() {
        return userLabel;
    }

    public Store getStore() {
        return store;
    }

    public String getTextVersion() {
        return textVersion;
    }

    public Language getLanguage() {
        return language;
    }

    public String getText() {
        return text;
    }

    public InetAddress getIpAddress() {
        return ipAddress;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }
}
