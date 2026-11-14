package az.jeparla.merchant.dto;

import az.jeparla.share.ReferralSource;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Visits through the seller's shared links and the WhatsApp clicks of those visitors (#100), from the aggregated
 * daily counters (no visitor data exists). Days are business days in Asia/Baku.
 *
 * @param days    the window asked for (30 or 90)
 * @param from    first day counted: the window's first day, or the day the store was created when that is later
 *                (there was nothing to count before)
 * @param to      today
 * @param visits  counted visits in the window
 * @param whatsappClicks WhatsApp clicks of visitors who came through a shared link
 * @param sources one entry per source with at least one visit or click, most visits first
 * @param daily   one entry per day from {@code from} to {@code to}, oldest first, zeros included
 */
@Schema(name = "ReferralStats",
        requiredProperties = {"days", "from", "to", "visits", "whatsappClicks", "sources", "daily"})
public record ReferralStatsDto(
        int days,
        @Schema(format = "date") String from,
        @Schema(format = "date") String to,
        long visits,
        long whatsappClicks,
        List<BySource> sources,
        List<ByDay> daily) {

    @Schema(name = "ReferralStatsBySource", requiredProperties = {"source", "visits", "whatsappClicks"})
    public record BySource(ReferralSource source, long visits, long whatsappClicks) {
    }

    @Schema(name = "ReferralStatsByDay", requiredProperties = {"day", "visits", "whatsappClicks"})
    public record ByDay(@Schema(format = "date") String day, long visits, long whatsappClicks) {
    }
}
