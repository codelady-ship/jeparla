package az.jeparla.collection;

import az.jeparla.common.i18n.LocalizedText;
import az.jeparla.common.persistence.TimestampedEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * An occasion collection (#115, V63): "Nişan", "Toy", "Hədiyyə" ... Sellers tag their products with it, the
 * public page {@code /collections/{slug}} lists the tagged listed products. Admin-managed, so all three names are
 * required; a collection is hidden ({@code active = false}), not deleted, and keeps its tags while hidden.
 */
@Entity
@Table(name = "collections")
public class OccasionCollection extends TimestampedEntity {

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "az", column = @Column(name = "name_az", nullable = false)),
            @AttributeOverride(name = "en", column = @Column(name = "name_en", nullable = false)),
            @AttributeOverride(name = "ru", column = @Column(name = "name_ru", nullable = false))
    })
    private LocalizedText name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    protected OccasionCollection() {
    }

    public OccasionCollection(String slug, LocalizedText name, int sortOrder) {
        this.slug = slug;
        this.name = name;
        this.sortOrder = sortOrder;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public LocalizedText getName() {
        return name;
    }

    public void setName(LocalizedText name) {
        this.name = name;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
