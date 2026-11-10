package az.jeparla.admin;

import az.jeparla.common.error.ApiException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

/** Paging of the admin lists: zero-based page, 1-100 rows, otherwise 400 {@code admin.page}. */
final class AdminPages {

    static final int MAX_PAGE_SIZE = 100;

    private AdminPages() {
    }

    static PageRequest of(int page, int size, Sort sort) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "admin.page");
        }
        return PageRequest.of(page, size, sort);
    }
}
