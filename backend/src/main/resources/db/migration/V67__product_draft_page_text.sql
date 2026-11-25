-- Catalog PDF auto-fill: a draft from a PDF page with one photo keeps the page text (cleaned, at most 4000
-- characters), so the product form can suggest the category, metal, fineness and description as well as the name,
-- price and weight it already had. Null for photo drafts and for pages with several photos. Only suggestions: the
-- seller checks every field before anything is saved.
ALTER TABLE product_drafts
    ADD COLUMN page_text VARCHAR(4000);
