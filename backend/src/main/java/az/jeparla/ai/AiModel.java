package az.jeparla.ai;

import az.jeparla.common.persistence.LongIdEntity;
import az.jeparla.product.Audience;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * An AI model of the library (#130, V41): not a real person. Managed by the admin only; never deleted, only
 * deactivated, so images approved earlier keep their history.
 */
@Entity
@Table(name = "ai_models")
public class AiModel extends LongIdEntity {

    @Column(name = "name", nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "audience", nullable = false)
    private Audience audience;

    @Enumerated(EnumType.STRING)
    @Column(name = "skin_tone", nullable = false)
    private SkinTone skinTone;

    @Enumerated(EnumType.STRING)
    @Column(name = "style", nullable = false)
    private ModelStyle style;

    @Column(name = "origin", nullable = false)
    private String origin;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "model", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<AiModelImage> images = new ArrayList<>();

    protected AiModel() {
    }

    public AiModel(String name, Audience audience, SkinTone skinTone, ModelStyle style, String origin, int sortOrder,
            Instant now) {
        change(name, audience, skinTone, style, origin, sortOrder, true, now);
        this.createdAt = now;
    }

    /** Replaces the fields; a deactivated model stops being the default. */
    public void change(String name, Audience audience, SkinTone skinTone, ModelStyle style, String origin,
            int sortOrder, boolean active, Instant now) {
        if (audience == Audience.UNISEX) {
            throw new IllegalArgumentException("A model shows women, men or kids");
        }
        this.name = name;
        this.audience = audience;
        this.skinTone = skinTone;
        this.style = style;
        this.origin = origin;
        this.sortOrder = sortOrder;
        this.active = active;
        if (!active) {
            this.isDefault = false;
        }
        this.updatedAt = now;
    }

    void setDefault(boolean isDefault, Instant now) {
        this.isDefault = isDefault && active;
        this.updatedAt = now;
    }

    void addImage(AiModelImage image) {
        image.setModel(this);
        images.add(image);
    }

    void removeImage(AiModelImage image) {
        images.remove(image);
    }

    /** Offered for new jobs: active and with at least one reference photo. */
    public boolean isSelectable() {
        return active && !images.isEmpty();
    }

    public String getName() {
        return name;
    }

    public Audience getAudience() {
        return audience;
    }

    public SkinTone getSkinTone() {
        return skinTone;
    }

    public ModelStyle getStyle() {
        return style;
    }

    public String getOrigin() {
        return origin;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isDefault() {
        return isDefault;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public List<AiModelImage> getImages() {
        return images;
    }
}
