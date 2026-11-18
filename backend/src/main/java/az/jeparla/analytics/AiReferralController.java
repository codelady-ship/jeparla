package az.jeparla.analytics;

import az.jeparla.analytics.dto.AiReferralRowDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** AI referral statistics (#62): the anonymous counter the site server calls, and the admin's read. */
@RestController
@Tag(name = "Analytics: AI referrers", description = "Visits from AI assistants' answers, counted separately")
public class AiReferralController {

    private final AiReferralService service;

    public AiReferralController(AiReferralService service) {
        this.service = service;
    }

    @PostMapping("/api/v1/visits/ai")
    @Operation(summary = "Count a visit from an AI assistant",
            description = "Sent by the site server for a page load whose Referer or utm_source names an AI "
                    + "assistant (ChatGPT, Perplexity, Gemini, Copilot, Claude ...). Counted per day, assistant "
                    + "and page kind only; never for crawlers, prefetches, over referral-ip, or again from the same "
                    + "address within referral-visit's window. Always 204.")
    @ApiResponse(responseCode = "204", description = "Counted or ignored")
    public ResponseEntity<Void> visit(
            @Parameter(description = "Referrer URL or host, or utm_source, e.g. https://chatgpt.com/")
            @RequestParam(required = false) String source,
            @Parameter(description = "Landing page kind: home, product, store, category, prices, guide, other")
            @RequestParam(required = false) String page,
            @RequestHeader(name = HttpHeaders.USER_AGENT, required = false) String userAgent,
            @RequestHeader(name = "Sec-Purpose", required = false) String secPurpose,
            @RequestHeader(name = "Purpose", required = false) String purpose,
            HttpServletRequest request) {
        service.visit(new AiReferralService.Hit(source, page, userAgent, secPurpose != null ? secPurpose : purpose,
                request.getRemoteAddr()));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/admin/stats/ai-referrals")
    @Operation(summary = "Visits from AI assistants (admin)",
            description = "Daily counters per assistant and landing page kind for the last `days` days (1-366, "
                    + "Baku days, today included). Days without visits have no rows.")
    @ApiResponse(responseCode = "200", description = "Counters, oldest day first")
    public List<AiReferralRowDto> stats(@RequestParam(defaultValue = "30") int days) {
        return service.lastDays(days).stream().map(AiReferralRowDto::of).toList();
    }
}
