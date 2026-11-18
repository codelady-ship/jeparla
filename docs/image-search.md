# Şəkillə axtarış (#163)

Alıcı bəyəndiyi zərgərliyin şəklini (ekran görüntüsü, kamera ilə foto) yükləyir və bütün mağazaların ictimai
kataloqunda oxşar modelləri görür. Mətn axtarışı eyni dialoqda qalır.

## Hazırkı vəziyyət

- Default `JEPARLA_IMAGE_SEARCH_PROVIDER=none` (sahibin qərarı: pullu xarici API yoxdur): header-də kamera düyməsi
  "hələ qoşulmayıb" izahı ilə görünür, `POST /api/v1/search/image` `503 search.image_not_configured` qaytarır.
  Nümunə və ya uydurma nəticə göstərilmir.
- Pulsuz lokal provayder hazırdır: `JEPARLA_IMAGE_SEARCH_PROVIDER=local` (aşağıda, "Lokal model"). Açmaq sahibin
  qərarıdır (#282).
- Kod provayderdən asılı deyil: `az.jeparla.search.embedding.ImageEmbeddingProvider`
  (`id`, `configured`, `model`, `embed(bytes, contentType)`, `minSimilarity`), seçim `ImageEmbeddingProviders`-dədir.
  Səhv id ilə tətbiq başlamır.

## Lokal model: `JEPARLA_IMAGE_SEARCH_PROVIDER=local`

- Model: **DINOv2 ViT-S/14** ([facebook/dinov2-small](https://huggingface.co/facebook/dinov2-small), Meta,
  **Apache-2.0**, kommersiya istifadəsinə icazə var). ONNX faylı transformers.js ixracıdır
  ([Xenova/dinov2-small](https://huggingface.co/Xenova/dinov2-small), commit `c2bb04a5`), `onnx/model.onnx`,
  88 MB, SHA-256 `83141175ec78...` (kodda tam). CLIP/SigLIP əvəzinə DINOv2: mətnsiz, "eyni əşya başqa fotoda"
  oxşarlığında güclüdür, kiçikdir (22M parametr).
- Fayl repoya düşmür: provayder seçiləndə tətbiq başlayandan sonra fonda `JEPARLA_MODELS_DIR`-ə (prod-da
  `models-data` volume) bir dəfə endirilir və SHA-256 ilə yoxlanılır; uyğun gəlməsə model yüklənmir, axtarış
  "qoşulmayıb" qalır. CI heç nə endirmir (testlər saxta encoder ilə).
- Hazırlıq: qısa tərəf 256 px, mərkəzdən 224x224, ImageNet normallaşdırması. Embedding: class token + patch
  token-lərin ortası (768 ədəd), L2 normallaşdırılmış. `model()` = `dinov2-small@83141175ec78`.
- Minimum oxşarlıq 0.25 (provayderin `minSimilarity`).
- ONNX Runtime 1.22 (MIT), CPU, `JEPARLA_IMAGE_SEARCH_THREADS=2`. Ölçmə (2026-11-18, Windows x64 masaüstü, CPU
  digər işlərlə 100% yüklü): model ~0.2-0.4 s / şəkil, proses RSS pik ~540 MB (heap daxil). ARM VM-də p95 ölçməsi
  sahibin yoxlamasıdır (#282). Studiya prosessoru ilə birlikdə açılanda `JEPARLA_API_MEM_LIMIT=4g`
  (`docs/ai-providers.md`).
- Yoxlama (demo kataloq, 16 məhsul): kataloqda studiya fotoları, sorğu kimi orijinal fotolar (başqa fon) və onların
  təsadüfi kəsilmiş, fırladılmış, parlaqlığı dəyişdirilmiş variantları, 48 sorğu: düzgün məhsul 46 dəfə 1-ci,
  48 dəfə ilk 3-də. Eyni əşyanın oxşarlığı 0.27-0.93, başqa əşyaların ən yüksəyi 0.77. 30 real cüt şəkil
  testi (#163 meyarı) VM-də sahibin işidir.

## Nəticə filtrləri

`POST /api/v1/search/image` multipart sahələri və ya query parametrləri ilə: `category` (slug, alt kateqoriyalar
daxil), `metal`, `fineness` (təkrar və ya vergüllə), `minPrice`, `maxPrice`, `store` (slug, təkrar), `city`.
Mənası `GET /api/v1/products` ilə eynidir (`ProductCatalogService.byIdsMatching`). Filtr ən oxşar 300 məhsulu
daraldır və sıranı saxlayır: filtr oxşar olmayan məhsulu nəticəyə gətirmir. Brauzer filtr dəyişəndə eyni (kəsilmiş,
kiçildilmiş) şəkli yenidən göndərir; şəkil yalnız səhifənin yaddaşındadır.

## Brauzerdə kəsmə

Şəkil seçiləndən sonra "Çərçivəyə al" addımı: alıcı əşyanı çərçivəyə salır (siçan, barmaq və ya klaviatura ilə
ox düymələri), sonra axtarır. Kəsilmiş hissə 768 px-ə kiçildilir və JPEG kimi yenidən kodlanır (EXIF silinir).
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
