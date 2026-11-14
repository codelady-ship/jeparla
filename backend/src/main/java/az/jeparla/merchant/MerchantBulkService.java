package az.jeparla.merchant;

import az.jeparla.common.error.ApiException;
import az.jeparla.common.i18n.Language;
import az.jeparla.common.i18n.SearchText;
import az.jeparla.merchant.CsvTable.Row;
import az.jeparla.merchant.dto.BulkStatusResultDto;
import az.jeparla.merchant.dto.DescriptionRequest;
import az.jeparla.merchant.dto.ImportResultDto;
import az.jeparla.merchant.dto.LocalizedTextRequest;
import az.jeparla.merchant.dto.MerchantProductDto;
import az.jeparla.merchant.dto.ProductRequest;
import az.jeparla.merchant.dto.VariantRequest;
import az.jeparla.product.Category;
import az.jeparla.product.CategoryRepository;
import az.jeparla.product.FashionMaterial;
import az.jeparla.product.Fineness;
import az.jeparla.product.FinenessRepository;
import az.jeparla.product.MaterialKind;
import az.jeparla.product.Metal;
import az.jeparla.product.PricingMode;
import az.jeparla.product.ProductStatus;
import az.jeparla.product.StockStatus;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Bulk work for sellers with many products (#109).
 *
 * <p><b>Spreadsheet import.</b> A CSV file (Excel and Google Sheets save one; {@code ,} {@code ;} or TAB) with a
 * header row of the template columns ({@link ImportColumn}, in any of the three languages) and at most
 * {@value #MAX_ROWS} products, one variant each. Every row is checked and created on its own, in its own
 * transaction, through {@link MerchantProductService#create}: the same rules, ownership and audit as the form,
 * and the product is always a DRAFT (an unverified seller cannot publish anything this way). A bad row is
 * reported with its line, column and a message in the seller's language and never stops the others. Money and
 * weight are parsed to {@link BigDecimal}: "4,20" and "4.20" are the same. With an Idempotency-Key every row gets
 * its own key derived from it and its line, so a repeated upload creates nothing twice. Prices are FIXED; a
 * METAL_LINKED rule is set later in the editor (it needs the labour and margin fields).
 *
 * <p><b>Bulk status.</b> The status change of one product, for many: e.g. send the selected drafts to review.
 */
@Service
@PreAuthorize("hasRole('MERCHANT')")
public class MerchantBulkService {

    static final int MAX_ROWS = 200;
    static final int MAX_CHARS = 1_000_000;
    private static final Set<ImportColumn> REQUIRED = Set.of(ImportColumn.CATEGORY, ImportColumn.NAME_AZ,
            ImportColumn.PRICE);

    /** Metal words sellers write, folded, in az, en and ru. */
    private static final Map<String, Metal> METAL_WORDS = Map.ofEntries(
            Map.entry("qizil", Metal.GOLD), Map.entry("gold", Metal.GOLD), Map.entry("золото", Metal.GOLD),
            Map.entry("gumus", Metal.SILVER), Map.entry("silver", Metal.SILVER), Map.entry("серебро", Metal.SILVER),
            Map.entry("platin", Metal.PLATINUM), Map.entry("platinum", Metal.PLATINUM),
            Map.entry("платина", Metal.PLATINUM), Map.entry("palladium", Metal.PALLADIUM),
            Map.entry("palladi", Metal.PALLADIUM), Map.entry("палладий", Metal.PALLADIUM));

    /** Kind words, folded: the template labels of the two kinds in az, en and ru. */
    private static final Map<String, MaterialKind> KIND_WORDS = Map.ofEntries(
            Map.entry("qiymetli", MaterialKind.PRECIOUS), Map.entry("precious", MaterialKind.PRECIOUS),
            Map.entry("драгоценный", MaterialKind.PRECIOUS), Map.entry("bijuteriya", MaterialKind.FASHION),
            Map.entry("bijouterie", MaterialKind.FASHION), Map.entry("fashion", MaterialKind.FASHION),
            Map.entry("бижутерия", MaterialKind.FASHION), Map.entry("el isi", MaterialKind.FASHION),
            Map.entry("handmade", MaterialKind.FASHION), Map.entry("ручная работа", MaterialKind.FASHION));

    private final MerchantStores merchantStores;
    private final MerchantProductService products;
    private final CategoryRepository categories;
    private final FinenessRepository finenesses;
    private final Validator validator;
    private final MessageSource messages;
    private final TransactionTemplate eachRow;

    public MerchantBulkService(MerchantStores merchantStores, MerchantProductService products,
            CategoryRepository categories, FinenessRepository finenesses, Validator validator,
            MessageSource messages, PlatformTransactionManager transactions) {
        this.merchantStores = merchantStores;
        this.products = products;
        this.categories = categories;
        this.finenesses = finenesses;
        this.validator = validator;
        this.messages = messages;
        this.eachRow = new TransactionTemplate(transactions);
        this.eachRow.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ------------------------------------------------------------------ import

    /** The empty template: one header row with the column labels in {@code language}, {@code ;} separated. */
    public String template(Language language) {
        Locale locale = Locale.forLanguageTag(language.code());
        return "﻿" + Arrays.stream(ImportColumn.values())
                .map(column -> messages.getMessage(column.messageKey(), null, locale))
                .collect(Collectors.joining(";")) + "\r\n";
    }

    /**
     * Imports the CSV text. 400 for a file that cannot be read at all (empty, too large, an unclosed quote, a
     * required column missing, more than {@value #MAX_ROWS} rows); otherwise 200 with the created rows and errors.
     *
     * @param notPreciousConfirmed the seller confirms that the bijouterie (FASHION) rows are not precious metal
     */
    public ImportResultDto importCsv(String csv, UUID idempotencyKey, boolean notPreciousConfirmed) {
        eachRow.executeWithoutResult(status -> merchantStores.ownWritable());
        if (csv == null || csv.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.import_empty");
        }
        if (csv.length() > MAX_CHARS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.import_too_large");
        }
        List<Row> rows;
        try {
            rows = CsvTable.parse(csv);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.import_malformed");
        }
        if (rows.size() < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.import_empty");
        }
        if (rows.size() - 1 > MAX_ROWS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.import_too_many_rows").withArgs(MAX_ROWS);
        }
        Map<ImportColumn, Integer> columns = columns(rows.get(0));
        for (ImportColumn required : REQUIRED) {
            if (!columns.containsKey(required)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "merchant.import_column_missing", required.key())
                        .withArgs(label(required));
            }
        }
        List<ImportResultDto.CreatedRow> created = new ArrayList<>();
        List<ImportResultDto.RowError> errors = new ArrayList<>();
        for (Row row : rows.subList(1, rows.size())) {
            try {
                ProductRequest request = request(row, columns, notPreciousConfirmed);
                validate(request);
                UUID key = idempotencyKey == null ? null : UUID.nameUUIDFromBytes(
                        (idempotencyKey + ":" + row.line()).getBytes(StandardCharsets.UTF_8));
                Created<MerchantProductDto> result = eachRow.execute(status -> products.create(request, key));
                created.add(new ImportResultDto.CreatedRow(row.line(), result.body().id(), result.created()));
            } catch (RowProblem problem) {
                errors.add(new ImportResultDto.RowError(row.line(), problem.column == null ? null
                        : problem.column.key(), problem.code, text(problem.code, problem.args)));
            } catch (ApiException e) {
                ImportColumn column = column(e.field());
                errors.add(new ImportResultDto.RowError(row.line(), column == null ? e.field() : column.key(),
                        e.code(), text(e.code(), e.args())));
            }
        }
        return new ImportResultDto(rows.size() - 1, created, errors);
    }

    private Map<ImportColumn, Integer> columns(Row header) {
        Map<ImportColumn, Integer> columns = new EnumMap<>(ImportColumn.class);
        for (int i = 0; i < header.fields().size(); i++) {
            int index = i;
            ImportColumn.match(header.field(i), this::labels).ifPresent(column -> columns.putIfAbsent(column, index));
        }
        return columns;
    }

    private List<String> labels(ImportColumn column) {
        return Arrays.stream(Language.values())
                .map(language -> messages.getMessage(column.messageKey(), null, column.key(),
                        Locale.forLanguageTag(language.code())))
                .toList();
    }

    private ProductRequest request(Row row, Map<ImportColumn, Integer> columns, boolean notPreciousConfirmed) {
        String material = value(row, columns, ImportColumn.MATERIAL);
        String metal = value(row, columns, ImportColumn.METAL);
        MaterialKind kind = kind(value(row, columns, ImportColumn.KIND), metal, material);
        Long categoryId = category(value(row, columns, ImportColumn.CATEGORY));
        LocalizedTextRequest name = new LocalizedTextRequest(value(row, columns, ImportColumn.NAME_AZ),
                blankToNull(value(row, columns, ImportColumn.NAME_EN)),
                blankToNull(value(row, columns, ImportColumn.NAME_RU)));
        String descriptionAz = value(row, columns, ImportColumn.DESCRIPTION_AZ);
        DescriptionRequest description = descriptionAz.isBlank() ? null : new DescriptionRequest(descriptionAz, null,
                null);
        BigDecimal weight = optionalDecimal(row, columns, ImportColumn.WEIGHT);
        BigDecimal price = optionalDecimal(row, columns, ImportColumn.PRICE);
        if (price == null) {
            throw new RowProblem(ImportColumn.PRICE, "merchant.import_required", label(ImportColumn.PRICE));
        }
        String stockText = value(row, columns, ImportColumn.STOCK);
        StockStatus stock = stockText.isBlank() ? StockStatus.IN_STOCK
                : ImportColumn.constant(StockStatus.class, stockText).orElseThrow(
                        () -> new RowProblem(ImportColumn.STOCK, "merchant.import_value", stockText));
        Metal parsedMetal = null;
        Long finenessId = null;
        FashionMaterial parsedMaterial = null;
        Boolean confirmed = null;
        if (kind == MaterialKind.PRECIOUS) {
            parsedMetal = metal(metal);
            finenessId = fineness(parsedMetal, value(row, columns, ImportColumn.FINENESS));
        } else {
            parsedMaterial = ImportColumn.constant(FashionMaterial.class, material).orElseThrow(
                    () -> new RowProblem(ImportColumn.MATERIAL, "merchant.import_value", material));
            if (!notPreciousConfirmed) {
                throw new RowProblem(ImportColumn.KIND, "merchant.not_precious_confirmation");
            }
            confirmed = true;
        }
        String sku = value(row, columns, ImportColumn.SKU);
        String size = value(row, columns, ImportColumn.SIZE);
        VariantRequest variant = new VariantRequest(null, sku.isBlank() ? null : sku, finenessId, weight,
                size.isBlank() ? null : size, PricingMode.FIXED, price, null, stock);
        return new ProductRequest(kind, categoryId, name, description, parsedMetal, parsedMaterial, confirmed,
                List.of(variant), List.of());
    }

    private void validate(ProductRequest request) {
        Set<ConstraintViolation<ProductRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            ConstraintViolation<ProductRequest> first = violations.stream()
                    .min((a, b) -> a.getPropertyPath().toString().compareTo(b.getPropertyPath().toString()))
                    .orElseThrow();
            ImportColumn column = column(first.getPropertyPath().toString());
            throw new RowProblem(column, "merchant.import_invalid", column == null ? first.getPropertyPath().toString()
                    : label(column));
        }
    }

    private static MaterialKind kind(String text, String metal, String material) {
        if (!text.isBlank()) {
            Optional<MaterialKind> named = ImportColumn.constant(MaterialKind.class, text);
            if (named.isPresent()) {
                return named.get();
            }
            MaterialKind word = KIND_WORDS.get(SearchText.fold(text));
            if (word == null) {
                throw new RowProblem(ImportColumn.KIND, "merchant.import_value", text);
            }
            return word;
        }
        return metal.isBlank() && !material.isBlank() ? MaterialKind.FASHION : MaterialKind.PRECIOUS;
    }

    private Long category(String text) {
        if (text.isBlank()) {
            throw new RowProblem(ImportColumn.CATEGORY, "merchant.import_required", label(ImportColumn.CATEGORY));
        }
        if (text.matches("\\d{1,18}")) {
            return Long.valueOf(text);
        }
        return categories.findBySlug(text.strip().toLowerCase(Locale.ROOT)).map(Category::getId)
                .orElseThrow(() -> new RowProblem(ImportColumn.CATEGORY, "merchant.import_category", text));
    }

    private Metal metal(String text) {
        if (text.isBlank()) {
            throw new RowProblem(ImportColumn.METAL, "merchant.import_required", label(ImportColumn.METAL));
        }
        return ImportColumn.constant(Metal.class, text)
                .or(() -> Optional.ofNullable(METAL_WORDS.get(SearchText.fold(text))))
                .orElseThrow(() -> new RowProblem(ImportColumn.METAL, "merchant.import_value", text));
    }

    private Long fineness(Metal metal, String text) {
        if (text.isBlank()) {
            throw new RowProblem(ImportColumn.FINENESS, "merchant.import_required", label(ImportColumn.FINENESS));
        }
        if (!text.strip().matches("\\d{3,4}")) {
            throw new RowProblem(ImportColumn.FINENESS, "merchant.import_value", text);
        }
        return finenesses.findByMetalAndValue(metal, Short.parseShort(text.strip())).filter(Fineness::isActive)
                .map(Fineness::getId)
                .orElseThrow(() -> new RowProblem(ImportColumn.FINENESS, "merchant.import_fineness", text, metal));
    }

    private static BigDecimal optionalDecimal(Row row, Map<ImportColumn, Integer> columns, ImportColumn column) {
        String text = value(row, columns, column);
        if (text.isBlank()) {
            return null;
        }
        return ImportColumn.decimal(text)
                .orElseThrow(() -> new RowProblem(column, "merchant.import_decimal", text));
    }

    private static String value(Row row, Map<ImportColumn, Integer> columns, ImportColumn column) {
        Integer index = columns.get(column);
        return index == null ? "" : row.field(index);
    }

    private static String blankToNull(String value) {
        return value.isBlank() ? null : value;
    }

    /** The template column of a request field ("variants[0].price" is the price column). */
    private static ImportColumn column(String field) {
        if (field == null) {
            return null;
        }
        if (field.startsWith("category")) {
            return ImportColumn.CATEGORY;
        }
        if (field.startsWith("name")) {
            return field.endsWith("en") ? ImportColumn.NAME_EN : field.endsWith("ru") ? ImportColumn.NAME_RU
                    : ImportColumn.NAME_AZ;
        }
        if (field.startsWith("description")) {
            return ImportColumn.DESCRIPTION_AZ;
        }
        if (field.equals("metal")) {
            return ImportColumn.METAL;
        }
        if (field.equals("material") || field.equals("notPreciousConfirmed") || field.equals("materialKind")) {
            return field.equals("material") ? ImportColumn.MATERIAL : ImportColumn.KIND;
        }
        if (field.contains("finenessId")) {
            return ImportColumn.FINENESS;
        }
        if (field.contains("weightGrams")) {
            return ImportColumn.WEIGHT;
        }
        if (field.contains("price")) {
            return ImportColumn.PRICE;
        }
        if (field.contains("sku")) {
            return ImportColumn.SKU;
        }
        if (field.contains("size")) {
            return ImportColumn.SIZE;
        }
        return null;
    }

    private String label(ImportColumn column) {
        return messages.getMessage(column.messageKey(), null, column.key(), LocaleContextHolder.getLocale());
    }

    private String text(String code, Object[] args) {
        Locale locale = LocaleContextHolder.getLocale();
        return messages.getMessage("error." + code, args, code, locale);
    }

    // ------------------------------------------------------------------ bulk status

    /** Changes the status of each product on its own; the result says per product what happened. */
    public List<BulkStatusResultDto> changeStatus(List<Long> ids, ProductStatus target) {
        List<BulkStatusResultDto> results = new ArrayList<>();
        for (Long id : ids.stream().distinct().toList()) {
            try {
                MerchantProductDto product = eachRow.execute(status -> products.changeStatus(id, target));
                results.add(new BulkStatusResultDto(id, true, product.status(), null, null));
            } catch (ApiException e) {
                results.add(new BulkStatusResultDto(id, false, null, e.code(), text(e.code(), e.args())));
            } catch (AccessDeniedException e) {
                // Another seller's product: the same 403 as one by one, without stopping the others.
                results.add(new BulkStatusResultDto(id, false, null, "auth.forbidden",
                        text("auth.forbidden", null)));
            }
        }
        return results;
    }

    /** A problem of one import row: the column, the message code and its arguments. */
    private static final class RowProblem extends RuntimeException {

        private final transient ImportColumn column;
        private final String code;
        private final transient Object[] args;

        RowProblem(ImportColumn column, String code, Object... args) {
            super(code, null, false, false);
            this.column = column;
            this.code = code;
            this.args = args;
        }
    }
}
