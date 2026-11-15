package az.jeparla.product;

import az.jeparla.auth.CurrentUser;
import az.jeparla.common.dto.MoneyDto;
import az.jeparla.common.error.ApiException;
import az.jeparla.product.dto.FavoriteDto;
import az.jeparla.product.dto.FavoriteImportRequest;
import az.jeparla.product.dto.ProductSummaryDto;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saved products of the signed-in buyer (#41, PLAN 5.11) on the {@code favorites} table. The user is always the
 * token's subject, never a parameter, so nobody reads or changes another user's list. Adding and removing are
 * idempotent. Only listed products can be saved; a saved product that is hidden later stays saved but is left out
 * of the list until it is listed again.
 */
@Service
@PreAuthorize("hasRole('USER')")
public class FavoriteService {

    /** Most products one account keeps saved. */
    static final int MAX_FAVORITES = 500;

    private final FavoriteRepository favorites;
    private final ProductCatalogService catalog;
    private final Clock clock;

    public FavoriteService(FavoriteRepository favorites, ProductCatalogService catalog, Clock clock) {
        this.favorites = favorites;
        this.catalog = catalog;
        this.clock = clock;
    }

    /** The user's listed saved products, newest first, with today's and the saved price. */
    @Transactional(readOnly = true)
    public List<FavoriteDto> list() {
        List<Favorite> rows = favorites.findByUserIdNewestFirst(CurrentUser.id());
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<Long, ProductSummaryDto> listed = catalog.byIds(rows.stream().map(f -> f.getProduct().getId()).toList())
                .stream().collect(Collectors.toMap(ProductSummaryDto::id, Function.identity()));
        return rows.stream()
                .filter(f -> listed.containsKey(f.getProduct().getId()))
                .map(f -> new FavoriteDto(listed.get(f.getProduct().getId()), f.getCreatedAt(),
                        f.getSavedPrice() == null ? null : MoneyDto.of(f.getSavedPrice(), f.getSavedCurrency())))
                .toList();
    }

    /**
     * Saves a listed product (404 otherwise) with its current price; saving it again changes nothing (the first
     * saved price stays). 409 {@code favorites.limit} over {@value #MAX_FAVORITES} products.
     */
    @Transactional
    public void add(long productId) {
        long userId = CurrentUser.id();
        Product product = catalog.requireListed(productId);
        if (favorites.existsByUserIdAndProductId(userId, productId)) {
            return;
        }
        if (favorites.countByUserId(userId) >= MAX_FAVORITES) {
            throw new ApiException(HttpStatus.CONFLICT, "favorites.limit");
        }
        insert(userId, product);
    }

    /** Removes a saved product; unknown or not saved ones are fine (idempotent). */
    @Transactional
    public void remove(long productId) {
        favorites.deleteByUserIdAndProductId(CurrentUser.id(), productId);
    }

    /**
     * Merges a guest's saved list after sign-in: listed products only, already saved ones and anything over the
     * limit skipped. Returns the merged list.
     */
    @Transactional
    public List<FavoriteDto> importAll(List<Long> productIds) {
        return importAll(productIds, List.of());
    }

    /**
     * {@link #importAll(List)} that keeps the price each product had when the guest saved it in the browser
     * (#112): a product the account does not have yet is saved with that price and time, so the "since you added
     * it" change survives the sign-in. Products already in the account keep their own first saved price.
     */
    @Transactional
    public List<FavoriteDto> importAll(List<Long> productIds, List<FavoriteImportRequest.SavedPrice> prices) {
        long userId = CurrentUser.id();
        if (productIds.isEmpty()) {
            return list();
        }
        Map<Long, FavoriteImportRequest.SavedPrice> saved = new HashMap<>();
        for (FavoriteImportRequest.SavedPrice price : prices) {
            saved.putIfAbsent(price.productId(), price);
        }
        Instant now = clock.instant();
        long count = favorites.countByUserId(userId);
        // Listed products only, in the order sent; byIds never throws for hidden or unknown ids.
        for (ProductSummaryDto product : catalog.byIds(productIds.stream().distinct().toList())) {
            if (count >= MAX_FAVORITES) {
                break;
            }
            FavoriteImportRequest.SavedPrice guest = saved.get(product.id());
            if (guest != null) {
                Instant at = guest.savedAt().isAfter(now) ? now : guest.savedAt();
                count += favorites.insertSavedIfAbsent(userId, product.id(), new BigDecimal(guest.amount()),
                        guest.currency(), at);
            } else {
                count += favorites.insertIfAbsent(userId, product.id(), new BigDecimal(product.priceFrom().amount()),
                        product.priceFrom().currency());
            }
        }
        return list();
    }

    private void insert(long userId, Product product) {
        ProductVariant cheapest = product.cheapestVariant().orElseThrow(ApiException::notFound);
        favorites.insertIfAbsent(userId, product.getId(), cheapest.getPrice(),
                cheapest.getCurrency().getCurrencyCode());
    }
}
