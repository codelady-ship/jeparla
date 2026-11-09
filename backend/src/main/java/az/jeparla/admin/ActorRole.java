package az.jeparla.admin;

/** Role of whoever did an audited action. SYSTEM: scheduled jobs (metal prices, retention). */
public enum ActorRole {
    ADMIN,
    MERCHANT,
    USER,
    SYSTEM
}
