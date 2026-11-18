-- Jeparla demo catalog (#33): the same stores and 60 products as the frontend demo fixtures
-- (frontend/src/lib/api/mock/fixtures.ts), with the same ids, slugs, names and prices. The
-- categories and finenesses are not demo data: the versioned migration V61__reference_taxonomy.sql
-- creates them in every environment, and this seed finds them by slug and by (metal, value).
--
-- DEMO DATA ONLY. Loaded only with the `demo` Spring profile (application-demo.yml adds
-- classpath:db/demo to the Flyway locations); production never reads this folder.
-- Everything is invented: store names, addresses, phone numbers (+994 50 000 00 0X), tax ids
-- (000000000X) and metal prices are not real. Demo merchants cannot sign in.
--
-- Deterministic: no random values, fixed timestamps. Runs once on an empty catalog; when any
-- store, product or quote already exists it does nothing (recreate the database to load a changed
-- seed). Categories and finenesses do not count: V61 always creates them first. A repeatable
-- migration, so new versioned migrations still apply in order before it.
--
-- Rules mirrored from fixtures.ts, for product index i = 0..59 (id = i + 1):
--   category  = leaf[i % 10] of (2, 3, 4, 6, 7, 8, 9, 10, 11, 12); store = i % 6 + 1
--               (category and fineness numbers are fixture ids, mapped to database rows through
--               demo_category and demo_fineness)
--   metal     = PLATINUM 950 if i % 20 = 7, SILVER 925 if i % 4 = 1,
--               else GOLD (585, 750, 585, 375, 999)[i % 5]
--   weight    = 1.2 + ((i * 37) % 90) / 10 grams
--   stone     = one diamond when metal <> SILVER and (category 2 or 9, or i % 6 = 0)
--   pricing   = FIXED if i % 3 = 2, else METAL_LINKED with labor 12.00/g + 20.00, markup 15 %,
--               stone price (250, 650, 1400)[i % 3]; FIXED = METAL_LINKED price rounded to tens
--   price     = round((w * fineness / 1000 * gram + w * 12 + 20 + stone) * 1.15, 2), gram price of
--               the demo quote = round(ounce / 31.1034768, 4) (frontend/src/lib/pricing.ts)
--   stock     = OUT_OF_STOCK if i % 11 = 10, MADE_TO_ORDER if i % 7 = 6, else IN_STOCK
--   published = 2026-10-(1 + i % 30) 09:00 UTC; variant id = id * 10, SKU JP-0001 ...
--
-- Demo photos are the free photos in frontend/public/demo (credits in docs/credits.md). Several
-- products share one photo, but storage_key is unique, so each key carries a URL fragment
-- ("demo/ring-gold-1.jpg#12-0"): the fragment is never sent to the server, so every key still
-- resolves to the same static file.

DO
$$
BEGIN
    IF EXISTS (SELECT 1 FROM stores) OR EXISTS (SELECT 1 FROM products) OR EXISTS (SELECT 1 FROM metal_price_snapshots)
    THEN
        RAISE NOTICE 'Jeparla demo seed skipped: the catalog is not empty';
        RETURN;
    END IF;

    -- ------------------------------------------------------------ reference taxonomy (V61)
    -- Fixture id -> database row. On an empty database the ids are the same (V61 inserts in the
    -- fixture order), but the seed does not rely on it.
    CREATE TEMP TABLE demo_category ON COMMIT DROP AS
    SELECT fx.fx_id, c.id, c.slug
    FROM (VALUES (1, 'uzukler'), (2, 'nisan-uzukleri'), (3, 'toy-uzukleri'), (4, 'sirgalar'),
                 (5, 'boyunbagilar'), (6, 'zencirler'), (7, 'asqilar'), (8, 'qolbaqlar'), (9, 'destler'),
                 (10, 'broslar'), (11, 'kisi-zergerliyi'), (12, 'usaq-zergerliyi')) AS fx (fx_id, slug)
             JOIN categories c ON c.slug = fx.slug;

    CREATE TEMP TABLE demo_fineness ON COMMIT DROP AS
    SELECT fx.fx_id, f.id
    FROM (VALUES (1, 'GOLD', 375), (2, 'GOLD', 585), (3, 'GOLD', 750), (4, 'GOLD', 999), (5, 'SILVER', 925),
                 (6, 'PLATINUM', 950)) AS fx (fx_id, metal, value)
             JOIN finenesses f ON f.metal = fx.metal AND f.value = fx.value;

    IF (SELECT count(*) FROM demo_category) <> 12 OR (SELECT count(*) FROM demo_fineness) <> 6 THEN
        RAISE EXCEPTION 'Jeparla demo seed: reference categories or finenesses of V61 are missing';
    END IF;

    -- ------------------------------------------------------------ demo merchants
    -- password_hash is not a BCrypt hash, so no password matches: these accounts cannot sign in.
    INSERT INTO users (email, password_hash, display_name, email_verified, preferred_locale, created_at, updated_at)
    SELECT 'demo-merchant-' || n || '@jeparla.test', 'DEMO-ACCOUNT-NO-LOGIN', 'Demo merchant ' || n, FALSE, 'az',
           TIMESTAMPTZ '2026-09-01 09:00:00+04', TIMESTAMPTZ '2026-09-01 09:00:00+04'
    FROM generate_series(1, 6) AS n
    ON CONFLICT DO NOTHING;

    INSERT INTO user_roles (user_id, role_id, created_at)
    SELECT u.id, r.id, TIMESTAMPTZ '2026-09-01 09:00:00+04'
    FROM users u
             JOIN roles r ON r.name = 'MERCHANT'
    WHERE u.email LIKE 'demo-merchant-%@jeparla.test'
    ON CONFLICT DO NOTHING;

    -- ------------------------------------------------------------ metal quotes
    -- Demo CBAR-style quotes for the last business day of the fixtures (AZN per troy ounce).
    INSERT INTO metal_price_snapshots (metal, quote_date, price_per_ounce, price_per_gram, currency, source, status,
                                       fetched_at, created_at)
    SELECT metal, DATE '2026-11-03', ounce, round(ounce / 31.1034768, 4), 'AZN', 'CBAR', 'APPLIED',
           TIMESTAMPTZ '2026-11-03 10:05:00+04', TIMESTAMPTZ '2026-11-03 10:05:00+04'
    FROM (VALUES ('GOLD', 7000.00),
                 ('SILVER', 85.00),
                 ('PLATINUM', 2900.00),
                 ('PALLADIUM', 2500.00)) AS q (metal, ounce);

    -- ------------------------------------------------------------ stores
    INSERT INTO stores (id, owner_id, slug, name, description_az, description_en, description_ru, city, address,
                        whatsapp, phone, opening_hours, legal_type, tax_id, status, seller_status, documents_status,
                        identity_status, approved_at, created_at, updated_at)
    SELECT s.id,
           (SELECT u.id FROM users u WHERE u.email = 'demo-merchant-' || s.id || '@jeparla.test'),
           s.slug, s.name, s.az, s.en, s.ru, s.city,
           s.city || ', nümunə küçəsi ' || s.id,
           '+99450000000' || s.id, '+99450000000' || s.id,
           'Mo-Sa 10:00-20:00', 'COMPANY', lpad(s.id::text, 10, '0'), 'APPROVED',
           s.seller, s.documents, 'NONE',
           TIMESTAMPTZ '2026-09-01 09:00:00+04', TIMESTAMPTZ '2026-09-01 09:00:00+04',
           TIMESTAMPTZ '2026-09-01 09:00:00+04'
    FROM (VALUES (1, 'ayzer-zerger', 'Ayzər Zərgər', 'Bakı', 'VERIFIED', 'VERIFIED',
                  'Klassik qızıl və nişan üzükləri.', 'Classic gold and engagement rings.',
                  'Классическое золото и помолвочные кольца.'),
                 (2, 'lale-atelye', 'Lalə Atelye', 'Bakı', 'VERIFIED', 'VERIFIED',
                  'Əl işi gümüş və minimal dizayn.', 'Handmade silver and minimal design.',
                  'Серебро ручной работы и минималистичный дизайн.'),
                 (3, 'nergiz-gold', 'Nərgiz Gold', 'Gəncə', 'VERIFIED', 'PENDING',
                  'Gündəlik qızıl zərgərlik.', 'Everyday gold jewelry.',
                  'Золотые украшения на каждый день.'),
                 (4, 'xezer-inci', 'Xəzər İnci', 'Sumqayıt', 'VERIFIED', 'VERIFIED',
                  'İnci və rəngli daşlar.', 'Pearls and coloured stones.',
                  'Жемчуг и цветные камни.'),
                 (5, 'semender-zerger', 'Səməndər Zərgər', 'Bakı', 'VERIFIED', 'PENDING',
                  'Brilyantlı dəstlər.', 'Diamond sets.',
                  'Комплекты с бриллиантами.'),
                 (6, 'yeni-ulduz', 'Yeni Ulduz', 'Lənkəran', 'PENDING', 'NONE',
                  'Yeni açılmış mağaza.', 'Newly opened store.',
                  'Недавно открытый магазин.'))
             AS s (id, slug, name, city, seller, documents, az, en, ru);

    -- One demo store declares its own terms (#108, #174), as in fixtures.ts; the others have none.
    UPDATE stores
    SET service_resize     = TRUE,
        service_returns    = TRUE,
        return_policy      = '14 gün ərzində, çek və qablaşdırma ilə dəyişdirmə.',
        made_to_order      = TRUE,
        made_to_order_days = 10
    WHERE id = 1;

    -- ------------------------------------------------------------ products (computed once)
    CREATE TEMP TABLE demo_product ON COMMIT DROP AS
    WITH base AS (SELECT i,
                         i + 1                                                    AS id,
                         (ARRAY [2, 3, 4, 6, 7, 8, 9, 10, 11, 12])[i % 10 + 1]     AS category_id,
                         i % 6 + 1                                                AS store_id,
                         CASE
                             WHEN i % 20 = 7 THEN 6
                             WHEN i % 4 = 1 THEN 5
                             ELSE (ARRAY [2, 3, 2, 1, 4])[i % 5 + 1] END            AS fineness_id,
                         round(1.2 + ((i * 37) % 90) / 10.0, 3)                   AS weight
                  FROM generate_series(0, 59) AS i),
         alloy AS (SELECT b.*,
                          dc.id                                                                AS db_category_id,
                          f.id                                                                 AS db_fineness_id,
                          f.metal,
                          f.value                                                              AS fineness_value,
                          f.metal <> 'SILVER' AND (b.category_id IN (2, 9) OR b.i % 6 = 0)    AS with_stone,
                          CASE WHEN b.i % 3 = 2 THEN 'FIXED' ELSE 'METAL_LINKED' END            AS pricing_mode
                   FROM base b
                            JOIN demo_category dc ON dc.fx_id = b.category_id
                            JOIN demo_fineness df ON df.fx_id = b.fineness_id
                            JOIN finenesses f ON f.id = df.id),
         stone AS (SELECT m.*,
                          CASE WHEN m.with_stone THEN (ARRAY [250.00, 650.00, 1400.00])[m.i % 3 + 1] ELSE 0.00 END
                              AS stone_price
                   FROM alloy m),
         linked AS (SELECT s.*,
                           q.id                                                   AS snapshot_id,
                           round((s.weight * s.fineness_value / 1000 * q.price_per_gram
                                      + s.weight * 12.00 + 20.00 + s.stone_price) * 115 / 100, 2) AS linked_price
                    FROM stone s
                             JOIN metal_price_snapshots q
                                  ON q.metal = s.metal AND q.quote_date = DATE '2026-11-03' AND q.source = 'CBAR')
    SELECT l.*,
           CASE WHEN l.pricing_mode = 'FIXED' THEN round(l.linked_price / 10, 0) * 10 ELSE l.linked_price END AS price,
           CASE
               WHEN l.i % 11 = 10 THEN 'OUT_OF_STOCK'
               WHEN l.i % 7 = 6 THEN 'MADE_TO_ORDER'
               ELSE 'IN_STOCK' END                                                          AS stock_status,
           TIMESTAMPTZ '2026-10-01 09:00:00+00' + (l.i % 30) * INTERVAL '1 day'               AS published_at,
           (ARRAY ['Leyla', 'Nur', 'Səma', 'Xəzər', 'Ay işığı'])[l.i % 5 + 1]                  AS col_az,
           (ARRAY ['Leyla', 'Nur', 'Sama', 'Khazar', 'Moonlight'])[l.i % 5 + 1]               AS col_en,
           (ARRAY ['Лейла', 'Нур', 'Сама', 'Хазар', 'Лунный свет'])[l.i % 5 + 1]              AS col_ru
    FROM linked l;

    -- Singular product nouns per leaf category and the metal words, as in fixtures.ts.
    CREATE TEMP TABLE demo_noun ON COMMIT DROP AS
    SELECT *
    FROM (VALUES (2, 'nişan üzüyü', 'engagement ring', 'помолвочное кольцо', 'ring'),
                 (3, 'toy üzüyü', 'wedding ring', 'обручальное кольцо', 'ring'),
                 (4, 'sırğa', 'earrings', 'серьги', 'earrings'),
                 (6, 'zəncir', 'chain', 'цепочка', 'necklace'),
                 (7, 'asqı', 'pendant', 'подвеска', 'necklace'),
                 (8, 'qolbaq', 'bracelet', 'браслет', 'bracelet'),
                 (9, 'dəst', 'set', 'комплект', 'necklace'),
                 (10, 'broş', 'brooch', 'брошь', 'necklace'),
                 (11, 'kişi üzüyü', 'men''s ring', 'мужское кольцо', 'ring'),
                 (12, 'uşaq sırğası', 'kids'' earrings', 'детские серьги', 'earrings'))
             AS n (category_id, az, en, ru, photo_kind);

    CREATE TEMP TABLE demo_metal_word ON COMMIT DROP AS
    SELECT *
    FROM (VALUES ('GOLD', 'qızıl', 'gold', 'из золота'),
                 ('SILVER', 'gümüş', 'silver', 'из серебра'),
                 ('PLATINUM', 'platin', 'platinum', 'из платины'),
                 ('PALLADIUM', 'palladium', 'palladium', 'из палладия'))
             AS w (metal, az, en, ru);

    CREATE TEMP TABLE demo_product_name ON COMMIT DROP AS
    SELECT p.id,
           p.col_az || ' — ' || w.az || ' ' || n.az || ' ' || p.fineness_value AS name_az,
           p.col_en || ' — ' || w.en || ' ' || n.en || ' ' || p.fineness_value AS name_en,
           p.col_ru || ' — ' || n.ru || ' ' || w.ru || ' ' || p.fineness_value AS name_ru,
           n.photo_kind
    FROM demo_product p
             JOIN demo_noun n ON n.category_id = p.category_id
             JOIN demo_metal_word w ON w.metal = p.metal;

    INSERT INTO products (id, store_id, category_id, slug, name_az, name_en, name_ru, description_az, description_en,
                          description_ru, metal, status, expertise_status, submitted_at, published_at, created_at,
                          updated_at)
    SELECT p.id, p.store_id, p.db_category_id,
           c.slug || '-' || lower(p.metal) || '-' || p.fineness_value || '-' || p.id,
           nm.name_az, nm.name_en, nm.name_ru,
           nm.name_az || '. Nümunə məhsul, real deyil.',
           nm.name_en || '. Demo product, not real.',
           nm.name_ru || '. Демонстрационный товар, не настоящий.',
           p.metal, 'APPROVED', 'NONE', p.published_at, p.published_at, p.published_at, p.published_at
    FROM demo_product p
             JOIN demo_product_name nm ON nm.id = p.id
             JOIN categories c ON c.id = p.db_category_id;

    INSERT INTO product_variants (id, product_id, store_id, sku, fineness_id, weight_grams, size, price, currency,
                                  pricing_mode, labor_per_gram, labor_fixed, stone_price, markup_percent, stock_status,
                                  price_updated_at, metal_snapshot_id, created_at, updated_at)
    SELECT p.id * 10, p.id, p.store_id,
           'JP-' || lpad(p.id::text, 4, '0'),
           p.db_fineness_id, p.weight,
           CASE WHEN p.category_id IN (2, 3, 11) THEN '17' END,
           p.price, 'AZN', p.pricing_mode,
           -- METAL_LINKED inputs; zero for FIXED variants (V5).
           CASE WHEN p.pricing_mode = 'METAL_LINKED' THEN 12.00 ELSE 0 END,
           CASE WHEN p.pricing_mode = 'METAL_LINKED' THEN 20.00 ELSE 0 END,
           CASE WHEN p.pricing_mode = 'METAL_LINKED' THEN p.stone_price ELSE 0 END,
           CASE WHEN p.pricing_mode = 'METAL_LINKED' THEN 15.00 ELSE 0 END,
           p.stock_status,
           TIMESTAMPTZ '2026-11-03 10:05:00+04',
           CASE WHEN p.pricing_mode = 'METAL_LINKED' THEN p.snapshot_id END,
           p.published_at, p.published_at
    FROM demo_product p;

    INSERT INTO product_stones (product_id, stone_type, origin, shape, carat, stone_count, color, clarity, cut,
                                certificate_lab, sort_order, created_at)
    SELECT p.id, 'DIAMOND',
           CASE WHEN p.i % 3 = 0 THEN 'LAB_GROWN' ELSE 'NATURAL' END,
           (ARRAY ['ROUND', 'OVAL', 'PRINCESS'])[p.i % 3 + 1],
           (ARRAY [0.10, 0.25, 0.50])[p.i % 3 + 1],
           1,
           (ARRAY ['D', 'F', 'G'])[p.i % 3 + 1],
           (ARRAY ['VS1', 'VVS2', 'SI1'])[p.i % 3 + 1],
           'EXCELLENT',
           CASE WHEN p.i % 2 = 0 THEN 'GIA' END,
           0, p.published_at
    FROM demo_product p
    WHERE p.with_stone
    ORDER BY p.id;

    -- ------------------------------------------------------------ images
    -- Photo pools per kind and tone (GOLD uses gold photos, every other metal silver ones).
    CREATE TEMP TABLE demo_photo ON COMMIT DROP AS
    SELECT *
    FROM (VALUES ('ring', 'gold', 0, 'ring-gold-1', 71936),
                 ('ring', 'silver', 0, 'ring-silver-1', 52362),
                 ('ring', 'silver', 1, 'ring-silver-3', 39684),
                 ('earrings', 'gold', 0, 'earrings-gold-1', 49094),
                 ('earrings', 'gold', 1, 'earrings-gold-2', 64251),
                 ('earrings', 'gold', 2, 'earrings-gold-3', 32781),
                 ('earrings', 'silver', 0, 'earrings-silver-1', 48239),
                 ('necklace', 'gold', 0, 'necklace-gold-1', 128523),
                 ('necklace', 'gold', 1, 'necklace-gold-2', 69717),
                 ('necklace', 'gold', 2, 'necklace-gold-3', 66841),
                 ('necklace', 'silver', 0, 'necklace-silver-1', 42452),
                 ('necklace', 'silver', 1, 'necklace-silver-2', 124348),
                 ('necklace', 'silver', 2, 'necklace-silver-3', 45551),
                 ('bracelet', 'gold', 0, 'bracelet-gold-2', 50363),
                 ('bracelet', 'gold', 1, 'bracelet-gold-3', 39995),
                 ('bracelet', 'silver', 0, 'bracelet-silver-1', 81001))
             AS ph (kind, tone, idx, file, size_bytes);

    -- pick(n) = pool[n % pool size]; every third product gets a second shot when the pool has one.
    WITH pool AS (SELECT p.id, p.i, nm.name_az, nm.name_en, nm.name_ru, nm.photo_kind AS kind,
                         CASE WHEN p.metal = 'GOLD' THEN 'gold' ELSE 'silver' END AS tone
                  FROM demo_product p
                           JOIN demo_product_name nm ON nm.id = p.id),
         sized AS (SELECT pool.*, (SELECT count(*) FROM demo_photo ph WHERE ph.kind = pool.kind AND ph.tone = pool.tone)
                                      AS pool_size
                   FROM pool),
         shot AS (SELECT s.*, 0 AS sort_order, s.i AS n
                  FROM sized s
                  UNION ALL
                  SELECT s.*, 1, s.i + 1
                  FROM sized s
                  WHERE s.i % 3 = 0 AND s.pool_size > 1)
    INSERT INTO product_images (product_id, storage_key, alt_az, alt_en, alt_ru, width, height, content_type,
                                size_bytes, ai_generated, sort_order, created_at)
    SELECT shot.id,
           'demo/' || ph.file || '.jpg#' || shot.id || '-' || shot.sort_order,
           shot.name_az, shot.name_en, shot.name_ru,
           800, 1000, 'image/jpeg', ph.size_bytes, FALSE, shot.sort_order,
           TIMESTAMPTZ '2026-09-01 09:00:00+04'
    FROM shot
             JOIN demo_photo ph ON ph.kind = shot.kind AND ph.tone = shot.tone AND ph.idx = shot.n % shot.pool_size
    ORDER BY shot.id, shot.sort_order;

    -- ------------------------------------------------------------ identity sequences
    -- Store and product ids were given explicitly (the same as the fixtures): new rows continue after
    -- them. Categories and finenesses got theirs from the identity columns (V61).
    PERFORM setval(pg_get_serial_sequence('stores', 'id'), (SELECT max(id) FROM stores));
    PERFORM setval(pg_get_serial_sequence('products', 'id'), (SELECT max(id) FROM products));
    PERFORM setval(pg_get_serial_sequence('product_variants', 'id'), (SELECT max(id) FROM product_variants));
END
$$;

-- ------------------------------------------------------------ occasion tags (#115)
-- The demo products' occasion tags, the same rule as fixtures.ts (PRODUCT_OCCASIONS), for product index
-- i = id - 1 and fixture category c = leaf[i % 10]:
--   nisan     c = 2                      toy       c in (3, 9)
--   hediyye   c in (4, 7, 8, 9, 10) and i % 3 <> 1
--   gundelik  c in (4, 6, 8) and i % 3 <> 0
--   kisi-ucun c = 11                     usaq-ucun c = 12
-- The collections are reference data (V63). A block of its own, so a demo database made before #115 gets the
-- tags too: it runs only while no product has a tag, and tags only the demo products (ids 1..60 with their
-- fixture slugs).
DO
$$
BEGIN
    IF EXISTS (SELECT 1 FROM collection_products) THEN
        RETURN;
    END IF;

    INSERT INTO collection_products (collection_id, product_id, created_at)
    SELECT col.id, d.id, TIMESTAMPTZ '2026-10-01 09:00:00+00'
    FROM (SELECT p.id,
                 p.id - 1                                                       AS i,
                 (ARRAY [2, 3, 4, 6, 7, 8, 9, 10, 11, 12])[(p.id - 1) % 10 + 1] AS c
          FROM products p
          WHERE p.id BETWEEN 1 AND 60
            AND p.slug LIKE '%-' || p.id) AS d
             JOIN collections col ON
        (col.slug = 'nisan' AND d.c = 2)
            OR (col.slug = 'toy' AND d.c IN (3, 9))
            OR (col.slug = 'hediyye' AND d.c IN (4, 7, 8, 9, 10) AND d.i % 3 <> 1)
            OR (col.slug = 'gundelik' AND d.c IN (4, 6, 8) AND d.i % 3 <> 0)
            OR (col.slug = 'kisi-ucun' AND d.c = 11)
            OR (col.slug = 'usaq-ucun' AND d.c = 12)
    ON CONFLICT DO NOTHING;
END
$$;
