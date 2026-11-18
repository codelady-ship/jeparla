package az.jeparla.analytics.dto;

import az.jeparla.analytics.AiReferralCounts;
import java.time.LocalDate;

/** One day's visits from one AI assistant to one kind of page (#62). */
public record AiReferralRowDto(LocalDate day, String source, String page, long visits) {

    public static AiReferralRowDto of(AiReferralCounts.Row row) {
        return new AiReferralRowDto(row.day(), row.source().name(), row.page().name(), row.visits());
    }
}
