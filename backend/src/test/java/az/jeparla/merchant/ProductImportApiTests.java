package az.jeparla.merchant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import az.jeparla.product.Metal;
import az.jeparla.store.SellerKind;
import az.jeparla.support.AuthIntegrationTest;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Product spreadsheet import and bulk status (#109). */
@AuthIntegrationTest
class ProductImportApiTests extends MerchantApiTestBase {

    private static final String IMPORT = "/api/v1/merchant/products/import";

    private static MockHttpServletRequestBuilder csv(String body) {
        return post(IMPORT).contentType(new MediaType("text", "csv")).content(body);
    }

    private String file(long categoryId, short goldValue) {
        return "Kateqoriya;Ad (az);Metal;Əyar;Çəki (q);Qiymət (AZN);Material\n"
                + categoryId + ";Qızıl üzük Lalə;qızıl;" + goldValue + ";4,20;1 250,50;\n"
                + categoryId + ";Qızıl sırğa;GOLD;" + goldValue + ";abc;300;\n"
                + categoryId + ";Muncuqlu bilərzik;;;;25.00;beads\n"
                // Only the category is wrong: the test database has no SILVER 925 fineness, and the fineness is
                // checked before the category, so a silver row would report the fineness instead.
                + "999999;Qızıl qolbaq;GOLD;" + goldValue + ";3.1;90;\n";
    }

    private short goldValue(long finenessId) {
        return jdbc.queryForObject("SELECT value FROM finenesses WHERE id = ?", Short.class, finenessId);
    }

    @Test
    void validRowsBecomeDraftsAndBadRowsAreReportedInTheSellersLanguage() throws Exception {
        Seller seller = seller(SellerKind.MIXED, false);
        long categoryId = category();
        String body = file(categoryId, goldValue(fineness(Metal.GOLD)));
        String key = UUID.randomUUID().toString();

        mvc.perform(csv(body).header("Idempotency-Key", key).header("Accept-Language", "en")
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows").value(4))
                .andExpect(jsonPath("$.created.length()").value(1))
                .andExpect(jsonPath("$.created[0].line").value(2))
                .andExpect(jsonPath("$.errors[*].line").value(Matchers.contains(3, 4, 5)))
                .andExpect(jsonPath("$.errors[0].column").value("weight"))
                .andExpect(jsonPath("$.errors[0].code").value("merchant.import_decimal"))
                .andExpect(jsonPath("$.errors[0].message").value("\"abc\" is not a number. Example: 4,20 or 4.20."))
                // A bijouterie row needs the seller's confirmation that it is not precious metal.
                .andExpect(jsonPath("$.errors[1].code").value("merchant.not_precious_confirmation"))
                .andExpect(jsonPath("$.errors[2].column").value("category"));
        assertThat(jdbc.queryForObject("SELECT weight_grams::text FROM product_variants v JOIN products p"
                + " ON p.id = v.product_id WHERE p.store_id = ?", String.class, seller.storeId())).isEqualTo("4.200");
        assertThat(jdbc.queryForObject("SELECT price::text FROM product_variants v JOIN products p"
                + " ON p.id = v.product_id WHERE p.store_id = ?", String.class, seller.storeId())).isEqualTo("1250.50");
        // An unverified seller's imports stay drafts.
        assertThat(jdbc.queryForList("SELECT status FROM products WHERE store_id = ?", String.class,
                seller.storeId())).containsOnly("DRAFT");

        // The same upload again creates nothing twice; with the confirmation the bijouterie row is added.
        mvc.perform(csv(body).param("notPreciousConfirmed", "true").header("Idempotency-Key", key)
                        .with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.length()").value(2))
                .andExpect(jsonPath("$.created[0].created").value(false))
                .andExpect(jsonPath("$.created[1].created").value(true));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM products WHERE store_id = ?", Integer.class,
                seller.storeId())).isEqualTo(2);
    }

    @Test
    void unreadableFilesAreRefusedWhole() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        mvc.perform(csv("Ad (az);Qiymət (AZN)\nÜzük;10\n").with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.import_column_missing"));
        mvc.perform(csv("Kateqoriya;Ad (az);Qiymət (AZN)\n").with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.import_empty"));
        StringBuilder many = new StringBuilder("category,name_az,price\n");
        for (int i = 0; i <= MerchantBulkService.MAX_ROWS; i++) {
            many.append("1,Üzük ").append(i).append(",10\n");
        }
        mvc.perform(csv(many.toString()).with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.import_too_many_rows"));
        mvc.perform(csv("category,name_az,price\n1,x,1\n").with(buyer(newBuyer())))
                .andExpect(status().isForbidden());
    }

    @Test
    void anExcelWorkbookIsImportedLikeACsvFile() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, false);
        long categoryId = category();
        short gold = goldValue(fineness(Metal.GOLD));
        byte[] template = mvc.perform(get(IMPORT + "/template.xlsx").param("lang", "az").with(seller.token()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(XlsxTable.parse(template, 10).get(0).fields()).contains("Kateqoriya", "Ad (az)");

        byte[] book;
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Products");
            String[] header = {"Kateqoriya", "Ad (az)", "Metal", "Əyar", "Çəki (q)", "Qiymət (AZN)"};
            org.apache.poi.ss.usermodel.Row head = sheet.createRow(0);
            for (int i = 0; i < header.length; i++) {
                head.createCell(i).setCellValue(header[i]);
            }
            org.apache.poi.ss.usermodel.Row row = sheet.createRow(1);
            row.createCell(0).setCellValue(categoryId);
            row.createCell(1).setCellValue("Qızıl üzük");
            row.createCell(2).setCellValue("qızıl");
            row.createCell(3).setCellValue(gold);
            row.createCell(4).setCellValue(4.2);
            row.createCell(5).setCellValue(1250.5);
            wb.write(out);
            book = out.toByteArray();
        }
        mvc.perform(post(IMPORT).contentType(MerchantBulkController.XLSX).content(book)
                        .header("Idempotency-Key", UUID.randomUUID().toString()).with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.length()").value(1))
                .andExpect(jsonPath("$.errors.length()").value(0));
        assertThat(jdbc.queryForObject("SELECT weight_grams::text FROM product_variants v JOIN products p"
                + " ON p.id = v.product_id WHERE p.store_id = ?", String.class, seller.storeId())).isEqualTo("4.200");
        assertThat(jdbc.queryForObject("SELECT price::text FROM product_variants v JOIN products p"
                + " ON p.id = v.product_id WHERE p.store_id = ?", String.class, seller.storeId())).isEqualTo("1250.50");

        mvc.perform(post(IMPORT).contentType(MerchantBulkController.XLSX).content(new byte[] {1, 2, 3})
                        .with(seller.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("merchant.import_xlsx_unreadable"));
    }

    @Test
    void theTemplateIsInTheAskedLanguage() throws Exception {
        Seller seller = seller(SellerKind.PRECIOUS, true);
        mvc.perform(get(IMPORT + "/template").param("lang", "ru").with(seller.token()))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.startsWith("﻿Тип;Категория;Название (az)")));
    }

    @Test
    void bulkStatusChangesOnlyOwnProductsEachOnItsOwn() throws Exception {
        Seller owner = seller(SellerKind.PRECIOUS, true);
        Seller other = seller(SellerKind.PRECIOUS, true);
        long categoryId = category();
        long finenessId = fineness(Metal.GOLD);
        long withPhoto = createProduct(owner, goldProduct(categoryId, finenessId, "500.00"));
        attachPng(owner, withPhoto);
        long withoutPhoto = createProduct(owner, goldProduct(categoryId, finenessId, "600.00"));
        long foreign = createProduct(other, goldProduct(categoryId, finenessId, "700.00"));

        mvc.perform(json(post("/api/v1/merchant/products/bulk-status"),
                        "{\"ids\": [" + withPhoto + ", " + withoutPhoto + ", " + foreign + "], \"status\": \"IN_REVIEW\"}")
                        .with(owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ok").value(true))
                .andExpect(jsonPath("$[0].status").value("IN_REVIEW"))
                .andExpect(jsonPath("$[1].ok").value(false))
                .andExpect(jsonPath("$[1].code").value("merchant.images_required"))
                .andExpect(jsonPath("$[2].ok").value(false))
                .andExpect(jsonPath("$[2].code").value("auth.forbidden"));
        assertThat(jdbc.queryForObject("SELECT status FROM products WHERE id = ?", String.class, foreign))
                .isEqualTo("DRAFT");
    }
}
