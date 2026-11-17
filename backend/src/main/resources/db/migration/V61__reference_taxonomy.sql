-- Reference taxonomy for every environment: the jewellery category tree and the standard finenesses
-- (PLAN 5.6, 5.9). Until now they existed only in the demo seed (db/demo), so a production database
-- started with no categories and no finenesses: merchants could not list a product and the
-- categories page was empty.
--
-- Reference data only: no stores, products, prices or users.
-- Safe on a database where an admin already created rows: every insert is ON CONFLICT DO NOTHING on
-- the natural key (categories.slug, finenesses (metal, value)), nothing is updated or deleted, and
-- ids come from the identity columns. A parent is found by its slug, so an existing "uzukler" row
-- made by an admin becomes the parent of the new leaves.
--
-- On an empty database the rows get the ids of the frontend demo fixtures
-- (frontend/src/lib/api/mock/fixtures.ts): categories 1..12 in the order below, finenesses 1..6 for
-- the six the fixtures started with, then 7..10. The demo seed (db/demo/R__demo_seed.sql) finds them
-- by slug and by (metal, value).

-- ------------------------------------------------------------ categories
-- One statement per row, parents first, so identity ids follow this order on an empty database.
INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'uzukler', 'Üzüklər', 'Rings', 'Кольца', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
SELECT id, 'nisan-uzukleri', 'Nişan üzükləri', 'Engagement rings', 'Помолвочные кольца', 2
FROM categories WHERE slug = 'uzukler'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
SELECT id, 'toy-uzukleri', 'Toy üzükləri', 'Wedding rings', 'Обручальные кольца', 3
FROM categories WHERE slug = 'uzukler'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'sirgalar', 'Sırğalar', 'Earrings', 'Серьги', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'boyunbagilar', 'Boyunbağılar', 'Necklaces', 'Колье', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
SELECT id, 'zencirler', 'Zəncirlər', 'Chains', 'Цепочки', 6
FROM categories WHERE slug = 'boyunbagilar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
SELECT id, 'asqilar', 'Asqılar', 'Pendants', 'Подвески', 7
FROM categories WHERE slug = 'boyunbagilar'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'qolbaqlar', 'Qolbaqlar', 'Bracelets', 'Браслеты', 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'destler', 'Dəstlər', 'Sets', 'Комплекты', 9)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'broslar', 'Broşlar', 'Brooches', 'Броши', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'kisi-zergerliyi', 'Kişi zərgərliyi', 'Men''s jewelry', 'Мужские украшения', 11)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, slug, name_az, name_en, name_ru, sort_order)
VALUES (NULL, 'usaq-zergerliyi', 'Uşaq zərgərliyi', 'Kids'' jewelry', 'Детские украшения', 12)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------ finenesses
-- Parts per thousand. sort_order lists gold, then silver, then platinum, each from low to high.
-- 583 is the Soviet 14K hallmark still common in Azerbaijan, next to the international 585.
-- One statement per row so identity ids follow this order on an empty database (the six of the
-- demo fixtures first).
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('GOLD', 375, '375 (9K)', 10)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('GOLD', 585, '585 (14K)', 30)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('GOLD', 750, '750 (18K)', 40)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('GOLD', 999, '999 (24K)', 60)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('SILVER', 925, '925', 120)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('PLATINUM', 950, '950', 210)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('GOLD', 583, '583 (14K)', 20)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('GOLD', 916, '916 (22K)', 50)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('SILVER', 875, '875', 110)
ON CONFLICT (metal, value) DO NOTHING;
INSERT INTO finenesses (metal, value, label, sort_order) VALUES ('SILVER', 999, '999', 130)
ON CONFLICT (metal, value) DO NOTHING;
