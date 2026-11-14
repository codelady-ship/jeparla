package az.jeparla.ai.dto;

/**
 * Whether AI Studio can take jobs, and the store's quota today.
 *
 * @param configured  false while no provider is configured: job requests answer 503 ai.not_configured
 * @param provider    id of the active provider ({@code none} when off)
 * @param dailyLimit  jobs and retries per store and day
 * @param usedToday   used by this store today (Asia/Baku)
 * @param maxAttempts attempts per job
 */
public record AiStatusDto(boolean configured, String provider, int dailyLimit, int usedToday, int maxAttempts) {
}
