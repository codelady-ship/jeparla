package az.jeparla.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import az.jeparla.ai.dto.AiJobRequest;
import az.jeparla.ai.dto.AiModelDto;
import az.jeparla.ai.dto.AiStatusDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.Audience;
import az.jeparla.product.FirstOriginalPhotoAttached;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

/** The on-model job after the first photo (#121), with the model the seller picked at upload (#315). */
class AutoTryOnTests {

    private final AiStudioService studio = mock(AiStudioService.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);

    AutoTryOnTests() {
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
    }

    private AutoTryOn autoTryOn(boolean auto, boolean configured) {
        when(studio.status()).thenReturn(new AiStatusDto(configured, configured ? "gemini" : "none", 10, 0, 3, false));
        AiProperties properties = new AiProperties(10, 3, BigDecimal.TEN, "USD", Duration.ofMinutes(5),
                Duration.ofMinutes(10), ZoneId.of("Asia/Baku"), auto);
        return new AutoTryOn(studio, properties, transactions);
    }

    private static AiModelDto model(long id) {
        return new AiModelDto(id, "Model " + id, Audience.WOMEN, SkinTone.MEDIUM, ModelStyle.CLASSIC, "test", true,
                false, 0, List.of(), List.of());
    }

    @Test
    void pickedModelIsQueuedEvenWithAutomaticTryOnOff() {
        autoTryOn(false, true).onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, 7L));

        ArgumentCaptor<AiJobRequest> request = ArgumentCaptor.forClass(AiJobRequest.class);
        verify(studio).create(request.capture(), any(UUID.class));
        assertThat(request.getValue()).isEqualTo(new AiJobRequest(5L, 50L, AiJobKind.VIRTUAL_TRY_ON, 7L));
    }

    @Test
    void noPickAndAutomaticTryOnOffQueuesNothing() {
        autoTryOn(false, true).onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, null));

        verify(studio, never()).create(any(), any());
    }

    @Test
    void noPickWithAutomaticTryOnUsesTheFirstFittingModel() {
        when(studio.models(isNull(), eq(5L))).thenReturn(List.of(model(3), model(4)));

        autoTryOn(true, true).onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, null));

        verify(studio).create(eq(new AiJobRequest(5L, 50L, AiJobKind.VIRTUAL_TRY_ON, 3L)), any(UUID.class));
    }

    @Test
    void withoutAProviderNothingIsQueuedEvenWhenPicked() {
        autoTryOn(true, false).onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, 7L));

        verify(studio, never()).create(any(), any());
    }

    @Test
    void aRefusedPickLeavesTheUploadAlone() {
        when(studio.create(any(), any())).thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "ai.model_mismatch"));

        autoTryOn(false, true).onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, 7L));

        verify(studio).create(any(), any());
    }

    @Test
    void theSamePhotoAlwaysGetsTheSameKey() {
        AutoTryOn auto = autoTryOn(false, true);
        auto.onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, 7L));
        auto.onFirstOriginalPhoto(new FirstOriginalPhotoAttached(5, 50, 7L));

        ArgumentCaptor<UUID> keys = ArgumentCaptor.forClass(UUID.class);
        verify(studio, org.mockito.Mockito.times(2)).create(any(), keys.capture());
        assertThat(keys.getAllValues().get(0)).isEqualTo(keys.getAllValues().get(1));
    }
}
