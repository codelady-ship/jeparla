package az.jeparla.product;

import az.jeparla.common.persistence.TimestampedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

/**
 * Fineness of a metal in parts per thousand (375, 585, 750, 916, 999, 925 ...). Data, not an
 * enum: admins add new ones (PLAN 4). Unique per metal.
 */
@Entity
@Table(name = "finenesses")
public class Fineness extends TimestampedEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "metal", nullable = false)
    private Metal metal;

    /** Parts per thousand, 1..1000 ({@code SMALLINT}). */
    @Column(name = "value", nullable = false)
    private short value;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    protected Fineness() {
    }

    public Fineness(Metal metal, int value, String label, int sortOrder) {
        this.metal = metal;
        this.value = toShort(value);
        this.label = label;
        this.sortOrder = sortOrder;
    }

    private static short toShort(int value) {
        if (value <= 0 || value > 1000) {
            throw new IllegalArgumentException("Fineness must be 1..1000, got " + value);
        }
        return (short) value;
    }

    public Metal getMetal() {
        return metal;
    }

    public int getValue() {
        return value;
    }

    /** Admin correction of a fineness no product uses yet (the service checks that). */
    public void setMetalAndValue(Metal metal, int value) {
        this.metal = java.util.Objects.requireNonNull(metal, "metal");
        this.value = toShort(value);
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
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
