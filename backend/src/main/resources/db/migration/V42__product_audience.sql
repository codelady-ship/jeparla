-- Audience of a product (#121): who the piece is for. It picks the AI model (#130) and the prompt of an on-model
-- image (a KIDS product only ever on an AI child model, with its own prompt). UNISEX by default; existing products
-- in the "Kişi zərgərliyi" / "Uşaq zərgərliyi" categories (or below them) become MEN / KIDS.

ALTER TABLE products
    ADD COLUMN audience TEXT NOT NULL DEFAULT 'UNISEX',
    ADD CONSTRAINT products_audience CHECK (audience IN ('WOMEN', 'MEN', 'KIDS', 'UNISEX'));

WITH RECURSIVE tree AS (SELECT id, slug AS root_slug
                        FROM categories
                        WHERE parent_id IS NULL
                        UNION ALL
                        SELECT c.id, t.root_slug
                        FROM categories c
                                 JOIN tree t ON c.parent_id = t.id)
UPDATE products p
SET audience = CASE t.root_slug WHEN 'kisi-zergerliyi' THEN 'MEN' ELSE 'KIDS' END
FROM tree t
WHERE p.category_id = t.id
  AND t.root_slug IN ('kisi-zergerliyi', 'usaq-zergerliyi');
