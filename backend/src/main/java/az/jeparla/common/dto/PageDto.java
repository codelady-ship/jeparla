package az.jeparla.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * Page of a list ({@code Page<T>} in frontend/src/types/api.ts). {@code page} is zero-based; a
 * page after the last one is empty but keeps the totals.
 */
@Schema(requiredProperties = {"content", "page", "size", "totalElements", "totalPages"})
public record PageDto<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <E, T> PageDto<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageDto<>(page.getContent().stream().map(mapper).toList(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }

    public static <T> PageDto<T> empty(int page, int size) {
        return new PageDto<>(List.of(), page, size, 0, 0);
    }
}
