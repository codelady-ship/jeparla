package az.jeparla.admin;

/** What an audited action changed. Values of the {@code audit_logs_target_type} CHECK. */
public enum AuditTargetType {
    STORE,
    PRODUCT,
    CHECK,
    USER,
    CATALOG,
    PRICE,
    REPORT,
    /** A verification document (#40, #138); the id is its UUID. */
    DOCUMENT
}
