package az.jeparla.product;

import static az.jeparla.common.persistence.Decimals.weight;

import az.jeparla.common.persistence.CreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * Stones of a product (PLAN 5.2): one row describes {@code stoneCount} identical stones, carat
 * is per stone ({@code NUMERIC(8,3)}). A certificate number needs its lab (CHECK).
 */
@Entity
@Table(name = "product_stones")
public class ProductStone extends CreatedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "stone_type", nullable = false)
    private StoneType stoneType;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin", nullable = false)
    private StoneOrigin origin = StoneOrigin.NATURAL;

    @Column(name = "shape")
    private String shape;

    @Column(name = "carat", precision = 8, scale = 3)
    private BigDecimal carat;

    @Column(name = "stone_count", nullable = false)
    private int stoneCount = 1;

    @Column(name = "color")
    private String color;

    @Column(name = "clarity")
    private String clarity;

    @Column(name = "cut")
    private String cut;

    @Column(name = "certificate_lab")
    private String certificateLab;

    @Column(name = "certificate_number")
    private String certificateNumber;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected ProductStone() {
    }

    public ProductStone(StoneType stoneType, StoneOrigin origin, BigDecimal carat, int stoneCount) {
        this.stoneType = stoneType;
        this.origin = origin;
        this.carat = weight(carat);
        this.stoneCount = stoneCount;
    }

    void attachTo(Product product) {
        this.product = product;
    }

    /** Diamond grading: shape, colour, clarity and cut (free text, e.g. ROUND, D, VS1, EXCELLENT). */
    public void setGrading(String shape, String color, String clarity, String cut) {
        this.shape = shape;
        this.color = color;
        this.clarity = clarity;
        this.cut = cut;
    }

    public void setCertificate(String lab, String number) {
        this.certificateLab = lab;
        this.certificateNumber = number;
    }

    public Product getProduct() {
        return product;
    }

    public StoneType getStoneType() {
        return stoneType;
    }

    public StoneOrigin getOrigin() {
        return origin;
    }

    public String getShape() {
        return shape;
    }

    public BigDecimal getCarat() {
        return carat;
    }

    public int getStoneCount() {
        return stoneCount;
    }

    public String getColor() {
        return color;
    }

    public String getClarity() {
        return clarity;
    }

    public String getCut() {
        return cut;
    }

    public String getCertificateLab() {
        return certificateLab;
    }

    public String getCertificateNumber() {
        return certificateNumber;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
