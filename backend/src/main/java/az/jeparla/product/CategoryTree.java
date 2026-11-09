package az.jeparla.product;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The category tree as the public sees it (#37). A category is <b>visible</b> when it and all its
 * ancestors are active: an admin hides a branch by deactivating its root. Products of a hidden
 * category are hidden everywhere in the public API (lists, product page, favorites, compare, counts)
 * until the category is active again or the product moves to a visible one.
 *
 * <p>Built from all categories in one query; the table is small (admin-managed).
 */
public final class CategoryTree {

    private static final Comparator<Category> ORDER =
            Comparator.comparingInt(Category::getSortOrder).thenComparing(Category::getId);

    private final Map<Long, Category> byId = new HashMap<>();
    private final Map<Long, List<Category>> children = new HashMap<>();
    private final List<Category> visible;
    private final Set<Long> visibleIds;

    public CategoryTree(Collection<Category> categories) {
        for (Category category : categories) {
            byId.put(category.getId(), category);
        }
        for (Category category : categories) {
            Long parentId = parentId(category);
            if (parentId != null) {
                children.computeIfAbsent(parentId, id -> new ArrayList<>()).add(category);
            }
        }
        this.visible = categories.stream().filter(this::computeVisible).sorted(ORDER).toList();
        this.visibleIds = new LinkedHashSet<>(visible.stream().map(Category::getId).toList());
    }

    /** Visible categories by sort order, then id. */
    public List<Category> visible() {
        return visible;
    }

    /** Ids of the visible categories. */
    public Set<Long> visibleIds() {
        return visibleIds;
    }

    public boolean isVisible(long categoryId) {
        return visibleIds.contains(categoryId);
    }

    /** The visible category with this slug, or empty when it does not exist or is hidden. */
    public Optional<Category> visibleBySlug(String slug) {
        return visible.stream().filter(c -> c.getSlug().equals(slug)).findFirst();
    }

    /** Ids of a visible category and all its visible descendants. */
    public Set<Long> subtreeIds(Category root) {
        Set<Long> ids = new LinkedHashSet<>();
        List<Category> queue = new ArrayList<>(List.of(root));
        while (!queue.isEmpty()) {
            Category current = queue.removeFirst();
            if (isVisible(current.getId()) && ids.add(current.getId())) {
                queue.addAll(children.getOrDefault(current.getId(), List.of()));
            }
        }
        return ids;
    }

    /** The category id and the ids of its ancestors, nearest first. */
    public List<Long> selfAndAncestorIds(long categoryId) {
        List<Long> ids = new ArrayList<>();
        Category current = byId.get(categoryId);
        while (current != null && !ids.contains(current.getId())) {
            ids.add(current.getId());
            Long parentId = parentId(current);
            current = parentId == null ? null : byId.get(parentId);
        }
        return ids;
    }

    /** Parent id without initializing a lazy parent proxy (all categories are loaded anyway). */
    public static Long parentId(Category category) {
        return category.getParent() == null ? null : category.getParent().getId();
    }

    private boolean computeVisible(Category category) {
        Set<Long> seen = new LinkedHashSet<>();
        Category current = category;
        while (current != null) {
            if (!current.isActive() || !seen.add(current.getId())) {
                return false;
            }
            Long parentId = parentId(current);
            current = parentId == null ? null : byId.get(parentId);
        }
        return true;
    }
}
