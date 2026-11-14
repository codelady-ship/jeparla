package az.jeparla.verification.dto;

import az.jeparla.verification.StoreSuspensionRequest;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * A request to suspend a store over a suspected forged document (#138), for the second admin who confirms or
 * dismisses it. {@code requestedBy}/{@code decidedBy} are user ids (null after the account was deleted).
 */
@Schema(name = "StoreSuspension", requiredProperties = {"id", "storeId", "storeName", "status", "requestedAt"})
public record StoreSuspensionDto(long id, long storeId, String storeName, UUID documentId,
        StoreSuspensionRequest.Status status, Long requestedBy, Instant requestedAt, String note, Long decidedBy,
        Instant decidedAt, String decisionNote) {

    public static StoreSuspensionDto of(StoreSuspensionRequest request) {
        return new StoreSuspensionDto(request.getId(), request.getStore().getId(), request.getStore().getName(),
                request.getDocument() == null ? null : request.getDocument().getId(), request.getStatus(),
                request.getRequestedBy() == null ? null : request.getRequestedBy().getId(), request.getRequestedAt(),
                request.getNote(), request.getDecidedBy() == null ? null : request.getDecidedBy().getId(),
                request.getDecidedAt(), request.getDecisionNote());
    }
}
