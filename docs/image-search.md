# Şəkillə axtarış (#163)

Alıcı bəyəndiyi zərgərliyin şəklini (ekran görüntüsü, kamera ilə foto) yükləyir və bütün mağazaların ictimai
kataloqunda oxşar modelləri görür. Mətn axtarışı eyni dialoqda qalır.

## Hazırkı vəziyyət

- Model qoşulmayıb (sahibin qərarı: pullu xarici API yoxdur). `JEPARLA_IMAGE_SEARCH_PROVIDER=none` default-dur:
  header-də kamera düyməsi "hələ qoşulmayıb" izahı ilə görünür, `POST /api/v1/search/image`
  `503 search.image_not_configured` qaytarır. Nümunə və ya uydurma nəticə göstərilmir.
- Kod provayderdən asılı deyil: `az.jeparla.search.embedding.ImageEmbeddingProvider`
  (`id`, `configured`, `model`, `embed(bytes, contentType)`), seçim `ImageEmbeddingProviders`-dədir. Səhv id ilə
  tətbiq başlamır.

## Axın

1. Brauzer şəkli seçir (telefonda kamera və qalereya, kompüterdə fayl və sürüşdürüb atma), canvas ilə ən çox
   768 px-ə kiçildir və JPEG kimi yenidən kodlayır: EXIF (yer, cihaz) bu zaman silinir. Şəkil kodu yalnız kamera
   düyməsi basılanda yüklənir (lazy), header-in JS büdcəsi dəyişmir.
2. `POST /api/v1/search/image` (multipart, hissə `image`): rate limit `image-search-ip` (30 / 10 dəq.) və daxil
   olubsa `image-search-account` (60 / saat), ölçü limiti 5 MB, magic-number yoxlaması (JPEG, PNG, WebP; müştərinin
   `Content-Type`-ına inanılmır), ən çox 6000 px.
3. Şəkil yalnız yaddaşda embedding-ə çevrilir; saxlanılmır, loglara yazılmır (logda yalnız növ və xəta səbəbi).
4. Embedding ictimai kataloqda görünən (mətn axtarışı ilə eyni qayda, `SearchSql.LISTED_PRODUCT`) məhsulların
   orijinal şəkilləri ilə müqayisə olunur (kosinus); məhsul ən yaxın şəkli ilə sıralanır, ən çox 24 nəticə.
   Cavabda yalnız sıra var, "oxşarlıq faizi" yoxdur (dürüstlük qaydası). Çox uzaq nəticələr atılır: boş cavab
   təsadüfi nəticədən yaxşıdır.

## Embedding-lərin doldurulması

- `product_image_embeddings` (V43): `(image_id, model)` üzrə bir `REAL[]`. Şəkil silinəndə embedding də silinir.
- `ImageEmbeddingJob` (ShedLock, hər `embed-delay`, default 5 dəq.) cari modelin embedding-i olmayan hər ictimai
  orijinal şəkli doldurur: yeni şəkil bir neçə dəqiqəyə axtarışa düşür, model dəyişəndə kataloq yenidən hesablanır.
  AI ilə yaradılmış şəkillər (`ai_generated`) daxil edilmir. Model yoxdursa iş boşdur.
- `pgvector` hələ yoxdur: `postgres:16-alpine` image-ində extension yoxdur. Bir neçə min şəkil API-də yaddaşda
  müqayisə olunur. Kataloq böyüyəndə (təxminən 50 000 şəkildən çox və ya p95 > 1.5 s) `pgvector/pgvector:pg16`
  image-inə keçid və `vector` sütunu + HNSW indeksi ayrıca miqrasiya ilə edilir.

## Model qoşmaq

1. Açıq lisenziyalı, kommersiya istifadəsinə icazəli vizual model seçin (CLIP və ya SigLIP ailəsi), ONNX formatında,
   Oracle ARM VM-də CPU ilə. Lisenziya və mənbə bu sənədə yazılır.
2. Model faylı repoya düşmür: deploy zamanı yüklənir, versiyası və SHA-256-sı `model()` dəyərində və burada qeyd
   olunur (`siglip-base-patch16-224@<sha256 ilk 12 simvol>`).
3. `ImageEmbeddingProvider` bean-ı yazın (`id()` env dəyəri ilə eyni), `embed` şəkli loglamamalı və saxlamamalıdır.
4. `JEPARLA_IMAGE_SEARCH_PROVIDER=<id>` ilə deploy edin; ilk iş bütün kataloqu doldurur.
5. Keyfiyyət yoxlaması (#163 qəbul meyarı): ən azı 30 cüt şəkil (kataloq şəkli və başqa bucaqdan / ekran görüntüsü),
   həmin məhsul ilk 10 nəticədə olmalıdır; faiz və p95 cavab müddəti PR-da hesabat kimi yazılır.
