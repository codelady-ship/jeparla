# Tapşırıq: Jeparla layihəsini araşdır, planla və GitHub issue-larına çevir

## 0. Kontekst
Jeparla — Azərbaycanda (sonra bütün dünyada) qızıl, gümüş və brilyant zərgərlik mağazalarını
bir platformada toplayan çoxmağazalı kataloq/marketplace-dir. Köhnə sənədlərdə layihə
"Golden.az", "GoldenLux", "Golden Lux" adları ilə keçir — HAMISINI "Jeparla" ilə əvəz et
("Golden Verified" → "Jeparla Verified"). "Planera" başqa layihədir, ona aid heç nə götürmə.

Sənin işin: (A) istinad saytlarını araşdırmaq, (B) tələbləri sətir-sətir təhlil edib
ziddiyyətləri göstərmək, (C) hər şeyi epic + issue strukturuna salıb GitHub-da yaratmaq.

## 1. İş metodu (https://github.com/codelady-ship/replica-skill əsasında, uyğunlaşdırılıb)
Biz heç bir saytı klonlamırıq — bir neçə saytdan ilham alıb ÖZ məhsulumuzu qururuq.
Replica-skill-dən yalnız metodu və alətləri götür:

- Planlama qovluğu: `docs/research/` (replica/ əvəzinə). Fayllar bir-birini oxuyur:
  - `recon.md` — istinad saytlarının ekranları, axınları (F01, F02...), komponentləri,
    "Jeparla-ya nə götürürük" sütunu. Şablon: replica-recon/recon-map.md
  - `features.csv` — funksiya matrisi: feature, area, priority(must/should/could),
    reference(hansı saytdan ilham), jeparla(no/partial/yes), notes. Hər must-have
    ən azı bir issue-ya bağlanır.
  - `design/tokens.json` + `tokens.css` + Tailwind mapping + `components.md`
    (hər komponent: variantlar, ölçülər, state-lər, a11y, harada istifadə olunur).
  - `test-plan.md` (F01-H1 happy path, F01-E3 edge, F01-N2 negativ), `bugs.md`.
  - `brand.json` — sweep üçün qadağan adlar: "Golden.az, GoldenLux, Golden Lux, Planera"
    və istinad brendlərinin adları/rəngləri (məs. Tiffany mavisi).
- Repoya kopyalanacaq alətlər (MIT, `tools/`): `replica-design/contrast.py`
  (WCAG AA, CI-da işləsin — həm light, həm dark tokenlər), `replica-brand/sweep.py`
  (köhnə ad qalıbsa CI fail), `replica-test/e2e.example.spec.ts` və
  `bug-report.md` şablonları, istəyə görə `replica-diff/parity.py` (features.csv üzrə
  hazırlıq faizi).
- Clean-room qaydaları (pozulmaz):
  - Yalnız ictimai səhifələr, insan sürəti ilə oxumaq; scraping, bot, login arxası yoxdur.
  - İstinad saytlarının kodu, şəkilləri, loqoları, ikonları, mətni, şriftləri, imza
    rəngləri götürülmür. Ekran görüntüləri yalnız `docs/research/screens/`-də və
    `.gitignore`-dadır — repoya və sayta düşmür.
  - İkonlar açıq setdən (Lucide), şriftlər açıq (Ə, İ, Ş, Ç, Ğ, Ö, Ü dəstəkləyən).
  - Saxta rəy, saxta "trusted by", saxta istifadəçi sayı yoxdur.
- Replica-skill-in default stack-ini (Supabase, Stripe, Drizzle) GÖTÜRMƏ — bizim stack bölmə 3-dədir.
  Ordan götürülən qaydalar: hər cədvəldə created_at/updated_at timestamptz (UTC),
  on delete qaydası açıq yazılır, filtr/sort sütunlarına indeks, status üçün CHECK,
  icazə yoxlaması hər sorğuda + "ikinci istifadəçi heç nə görmür" testi,
  ilk iş "vertical slice" (mağaza məhsul əlavə edir → kataloqda görünür → WhatsApp).
- Hər ekran üçün "done" meyarı: bütün state-lər (boş, loading skeleton, dolu, xəta,
  icazə yoxdur, uzun mətn), 390px və 1440px, yalnız klaviatura ilə keçilir, konsol
  xətası yoxdur, axe a11y yoxlaması, dark mode, 3 dil.
- Bug severity: S1 (məlumat itkisi, təhlükəsizlik, səhv qiymət, əsas axın bloklanıb),
  S2, S3, S4. Açıq S1/S2 ilə deploy yoxdur.
- Deploy preflight: testlər yaşıl, sweep təmiz, contrast təmiz, must-have-lar hazır,
  build keçir, məxfilik siyasəti və şərtlər səhifəsi var.

## 2. İstinad saytları və nəyi öyrənirik
| Sayt | Nə üçün baxırıq |
| --- | --- |
| mejuri.com | Minimalist məhsul kartı, ağ fon, sadə PDP, gündəlik zərgərlik təqdimatı |
| missoma.com | Trend, gənc auditoriya, məhsul təqdimatı, "styled with" bloku |
| pandora.net | Böyük kataloq, filtr və kateqoriya naviqasiyası |
| swarovski.com | Zərif animasiyalar, hədiyyə bölmələri, parıltılı vizual |
| tiffany.com | Premium hiss, şəkil keyfiyyəti, boşluq — RƏNGİ YOX |
| catbirdnyc.com | Butik/əl işi atmosferi, mağaza hekayəsi (mağaza profili üçün) |
| brilliantearth.com | Brilyant filtrləri (forma, karat, rəng, təmizlik, kəsim), sertifikat göstərmə |
| farfetch.com, etsy.com | Çoxsatıcılı model: mağaza səhifəsi, satıcıya etibar elementləri |
| zalando.com | Kataloq rahatlığı, filtr UX |
| vinted.com | Sadə addım-addım məhsul əlavə etmə |
| webflow.com/made-in-webflow/jewelry | Əlavə vizual ilham |
Yekun üslub: Mejuri/Missoma minimalizmi + Catbird butik hissi + Brilliant Earth funksionallığı,
Jeparla-nın öz rəngləri ilə.

## 3. Texnologiya (dəyişmə, yalnız versiyaları yoxla)
- Frontend: Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui; Vitest + Playwright + axe
- Backend: Java 21, Spring Boot 4, Spring Security, Spring Data JPA, PostgreSQL 16 + Flyway, Redis
- Fayllar: S3 uyğun storage (şəkillər public, sənədlər private)
- Docker, OpenAPI, GitHub Actions CI
- İş qaydası: hər iş issue ilə başlayır, PR yalnız CI yaşıl olanda merge olunur

### 3a. Repo strukturu və PULSUZ deploy (Planera modeli)
Planera reposundakı kimi (https://github.com/codelady-ship/planera — `render.yaml`,
`docker-compose.yml`, `.github/workflows/ci.yml`, `backend/src/main/resources/application.yml`-ə bax
və eyni üsulu təkrarla):
- Bir repo, iki ayrı tətbiq: `frontend/` (Next.js) və `backend/` (Spring Boot, Dockerfile).
  CI path filtrləri: frontend dəyişikliyi backend deploy-unu işə salmır və əksinə
  (`buildFilter: paths: backend/**`).
- Frontend backend-ə yalnız REST API ilə müraciət edir (`NEXT_PUBLIC_API_URL`); CORS backend-də.

| Hissə | Pulsuz yer | Qeyd |
| --- | --- | --- |
| Frontend | Vercel Hobby və ya Cloudflare (OpenNext) / Netlify | DİQQƏT: Vercel Hobby şərtləri kommersiya istifadəsinə icazə vermir. Jeparla komissiya ilə pul qazanacaq → ya Cloudflare/Netlify, ya da gəlir başlayanda Vercel Pro. Şərtləri bu gün yoxla və issue-da yaz |
| Backend API | Oracle Cloud Always Free, ARM VM (Ampere A1), Docker Compose + Caddy (HTTPS) | YATMIR: istifadəçi istənilən an daxil olur. Kart yalnız doğrulama üçün; hesabı Gün 1-də aç (1.7). Ehtiyat: Hetzner CX22 (~4–5 EUR/ay), eyni compose |
| PostgreSQL | Eyni VM-də PostgreSQL 16 (konteyner) | gecəlik `pg_dump` -> R2, 14 gün; bərpa yoxlanılır |
| Redis | Eyni VM-də Redis 7 | yalnız keş və rate limit; Redis yoxdursa tətbiq işləməyə davam etsin |
| Şəkillər, hero kadrları, sənədlər | Cloudflare R2 Free | S3 uyğun, çıxış trafiki pulsuz; sənədlər üçün ayrıca private bucket |
| E-poçt | Resend Free | domen doğrulaması (SPF, DKIM, DMARC) |
| Xəta izləmə | Sentry Free | frontend + backend |
| Domen | ödənişlidir (jeparla.az) | pulsuz alt domen müvəqqəti |

Pulsuz planın tələləri (hər biri issue olsun):
- Render kimi yatan pulsuz hostlar İSTİFADƏ OLUNMUR: server yatanda giriş sorğusu ~50 s
  gözləyib uğursuz olur. Backend həmişə oyaq olmalıdır.
- Oracle idle instansiyanı geri ala bilər (7 gün aşağı yük). Tədbir: hesabı Pay As You Go-ya
  keçir (Always Free limitində pulsuz qalır), 1 USD büdcə xəbərdarlığı, serveri 30 dəqiqədə
  sıfırdan qurmaq üçün addımlar `docs/deploy.md`-də, gecəlik backup R2-də.
- Sürət: kataloq və məhsul səhifələri ISR (revalidate) ilə Next.js keşindən verilsin.
- Gündəlik AMB metal qiyməti: Spring `@Scheduled` (`Asia/Baku`) + ShedLock; ehtiyat olaraq
  GitHub Actions gündə bir dəfə tarixi yoxlayır və köhnədirsə qorunan endpoint-i çağırır
  (`POST /internal/jobs/metal-prices`, gizli token); job idempotent olsun.
- VM diski məhduddur: şəkillər DB-də saxlanılmır (R2-də), yalnız açarlar; audit loglar üçün təmizləmə siyasəti.
- Pulsuz OLMAYANLAR (büdcəyə yaz): SMS OTP, AI şəkil generasiyası, domen, sonradan Vercel Pro.
  Bunlar üçün sərt xərc limiti və feature flag.
- Hər pulsuz planın hazırkı limitlərini rəsmi səhifədən yoxla, tarix ilə `docs/deploy.md`-yə yaz.
- `.env.example`; sirlər yalnız serverdəki `.env`-də (600 icazə), frontend hostunun dashboard-unda və GitHub Secrets-də.

## 4. Məhsul qərarları
- v1 = KATALOQ: səbət/onlayn ödəniş yoxdur; çevrilmə nöqtəsi WhatsApp (wa.me, mesajda
  məhsul adı, kodu, linki). Komissiya modeli v1-də WhatsApp klik/lead statistikası ilə izlənir.
  Ödəniş/sifariş gələcək milestone.
- Kateqoriyalar yalnız zərgərlik (qızıl, gümüş, brilyant; üzük, sırğa, boyunbağı, bilərzik...).
  Geyim/ayaqqabı/çanta YOXDUR.
- Əyarlar admin paneldən idarə olunur (sabit enum deyil).
- Pul və çəki: NUMERIC + BigDecimal + currency sütunu; float/double qadağandır.

## 5. Funksional tələblər

### 5.1 Baza və infrastruktur (P0)
Repo strukturu, Docker Compose (Postgres, Redis, MinIO), Flyway, CI (test, contrast.py,
sweep.py, gitleaks), deploy, `.env.example`, OpenAPI, `docs/research/` qovluğu.

### 5.2 Verilənlər bazası (P0)
users, roles(ADMIN, MERCHANT, USER), user_roles, stores, categories(parent_id, ağac),
products, product_images, finenesses, product_variants(fineness_id, weight_grams NUMERIC(8,3),
price NUMERIC(12,2), currency, stock_status, pricing_mode), product_stones(stone_type,
natural/lab_grown, shape, carat NUMERIC, color, clarity, cut, certificate_lab,
certificate_number), favorites (unique user_id+product_id), product_reports, audit_logs,
verification_documents, metal_price_snapshots, price_history.
CHECK: qiymət/çəki ≥ 0; sku mağaza daxilində unikal; slug unikal; məhsul silinmir, deaktiv olunur.
Satıcı: phoneVerified, identityStatus, businessStatus, sellerStatus.
Məhsul: metalType, purity, weight, verificationStatus, publishedAt.

### 5.3 AXTARIŞ — mağaza və kateqoriya üzrə (P0)
- Header-də qlobal axtarış, avtomatik təkliflər QRUPLAŞDIRILMIŞ: Mağazalar, Kateqoriyalar,
  Məhsullar (hər qrupda ilk 3–5). Klaviatura ilə naviqasiya, son axtarışlar.
- /search?q= nəticə səhifəsi: tablar — Hamısı / Məhsullar / Mağazalar / Kateqoriyalar.
- Kataloqda filtrlər birlikdə işləyir: kateqoriya (ağac), MAĞAZA (çoxseçimli, axtarışlı),
  metal, əyar, çəki, qiymət, brilyant parametrləri, mövcudluq, "Jeparla Verified", şəhər.
- Mağaza səhifəsində: mağaza daxilində axtarış + kateqoriya filtri.
  Kateqoriya səhifəsində: mağaza filtri.
- Filtrlər URL-də saxlanılır (paylaşıla bilən link, SEO).
- Texniki: PostgreSQL full-text + pg_trgm (səhv yazıya dözümlü), Azərbaycan hərflərinin
  normallaşdırılması ("uzuk" → "üzük", "sirga" → "sırğa", "qizil" → "qızıl"),
  3 dildə ad/sinonimlər, indekslər, Redis keş. Gələcəkdə OpenSearch-ə keçid ayrıca issue.
- API: GET /api/v1/search?q=&type=&page=, GET /api/v1/search/suggest?q=
- Boş nəticə vəziyyəti: təklif olunan kateqoriyalar və filtrləri təmizlə düyməsi.
- Rate limit və sorğu uzunluğu limiti.

### 5.4 İctimai səhifələr + SEO (P0)
/, /products, /products/[slug] (şəkillər, əyar, çəki, qiymət, "qiymət son yenilənmə tarixi",
mağaza, WhatsApp, seçilmiş, müqayisə, brilyant parametrləri, Verified statusları),
/categories/[slug], /stores, /stores/[slug], /search.
Server Components, metadata, canonical, Open Graph, sitemap, hreflang, schema.org Product.
Mobil: filtrlər ayrıca açılan panel.

### 5.5 REST API (/api/v1)
İctimai: GET products, products/{slug}, categories, finenesses, stores, stores/{slug},
stores/{slug}/products, search, search/suggest, metal-prices/latest, metal-prices/history;
POST products/{id}/reports.
Auth: register, login, telefon/SMS OTP.
Merchant: products CRUD, PATCH products/{id}/status, POST stores, GET dashboard.
Admin: stores, PATCH stores/{id}/status, products, PATCH products/{id}/status, finenesses,
categories, metal-price override.
Filtr nümunəsi: GET /api/v1/products?category=uzuk&store=zerger-x&fineness=585&minWeight=2
&maxWeight=5&minPrice=300&maxPrice=1200&sort=price_asc&page=0&size=24

### 5.6 Satıcı qeydiyyatı (P0)
Sihirbaz: (1) hesab — telefon, SMS kodu, ad, şifrə; (2) mağaza — ad, telefon/WhatsApp,
ünvan, şəhər, sosial şəbəkə, VÖEN/fərdi sahibkar; (3) təsdiq sənədləri; (4) ilk məhsul.
UX: addımlar yuxarıda OXLA birləşmiş göstərici; tamamlanan addım YAŞIL; sonda
"Təbriklər! Siz qeydiyyatdan keçdiniz" ekranı. Təsdiqdən əvvəl məhsul qaralama olur,
yayımlanmır. Addımlar arası məlumat itmir.

### 5.7 Mağaza kabineti /merchant (P0)
dashboard (baxışlar, WhatsApp klikləri), products, products/new (Vinted kimi sadə addımlar),
products/[id]/edit, profile. Şəkil yükləmə (drag & drop, telefondan), qiymət rejimi (5.10), stok, status.

### 5.8 Admin paneli /admin (P0)
Mağaza müraciətləri, məhsul moderasiyası, istifadəçilər/rollar, kateqoriya və əyarlar,
axtarış sinonimləri, şikayətlər, audit log, statistika, metal qiyməti monitorinqi.

### 5.9 Jeparla Verified (P0 əl ilə, P2 AI)
Üç AYRI status: Satıcı təsdiqlənib / Sənədlər yoxlanılıb / Fiziki ekspertiza.
Məhsul: DRAFT → IN_REVIEW → APPROVED | RETURNED. Sənədsiz məhsul yayımlanmır.
Sənədlər private storage, imzalı müvəqqəti URL, audit. v1-də yoxlamanı admin əl ilə edir;
AI sənəd yoxlaması sonra, yalnız şübhəlini insana yönləndirir. "100% zəmanət" ifadəsi qadağandır.

### 5.10 Gündəlik metal qiymətləri və avtomatik qiymət (P0)
Mənbə: Azərbaycan Mərkəzi Bankı (AMB/CBAR) gündəlik məzənnələri —
https://www.cbar.az/currencies/DD.MM.YYYY.xml, "Bank metalları" (XAU, XAG, XPT, XPD;
1 troy unsiya / AZN). ƏVVƏLCƏ URL və formatın hazırda işlədiyini yoxla, nəticəni issue-ya yaz.
- Backend scheduled job, məhdud retry; frontend AMB-yə birbaşa müraciət etmir.
- metal_price_snapshots: metal, tarix, qiymət/unsiya, qiymət/qram (÷ 31.1034768), mənbə. Redis keş.
- Həftəsonu/bayram: son mövcud qiymət + tarix.
- Sanity check: gündəlik dəyişmə >10% → avtomatik tətbiq yox, admin alert + manual təsdiq.
- Ana səhifə və PDP-də vidcet: qızıl/gümüş qram qiyməti (585/750/999/925), tarix, mənbə, tarixçə qrafiki.
- Qiymət rejimləri (variant səviyyəsində):
  - FIXED — sabit qiymət.
  - METAL_LINKED — çəki × (əyar/1000) × gündəlik qram qiyməti + işçilik (qram başına və ya sabit)
    + daş qiyməti + satıcı əlavəsi (%); satıcının min/max həddi; yuvarlaqlaşdırma.
- Yeni qiymət gələndə METAL_LINKED variantlar yenidən hesablanır, price_history-yə yazılır,
  "son yenilənmə" yenilənir, kataloq/axtarış keşi təmizlənir.
- Brilyant üçün rəsmi gündəlik mənbə YOXDUR: daş qiyməti satıcıdan, yalnız metal hissəsi
  avtomatik. Lisenziyalı mənbə ayrıca araşdırma issue-su.
- Saytda qeyd: "Qiymət AMB-nin gündəlik metal məzənnəsinə əsasən təxminidir, yekun qiyməti mağaza təsdiqləyir."
- Testlər: XML parse, çevirmə, formula (BigDecimal), həftəsonu, sanity check, hədlər. Səhv qiymət = S1.

### 5.11 Seçilmişlər, müqayisə, WhatsApp (P1)
Qonaq: localStorage; hesablı: DB; girişdən sonra birləşdirmə. Müqayisə 2–4 məhsul
(çəki, əyar, qiymət, mağaza, daş) — məhsul/variant səviyyəsi qərarı issue-da.

### 5.12 AI Studio (P2, MVP-dən sonra)
/merchant/products/[id]/ai-studio: AI_PHOTOSHOOT və VIRTUAL_TRY_ON (əvvəl boyunbağı, sırğa).
Asinxron job API (create, status, result, approve, retry, delete), statuslar
QUEUED → PROCESSING → REVIEW_REQUIRED → APPROVED | FAILED | CANCELLED,
cədvəllər ai_jobs, ai_assets, ai_job_attempts, ai_approvals, ai_usage. Orijinal şəkil dəyişmir,
mağaza təsdiqi olmadan dərc yoxdur, "AI ilə yaradılıb" nişanı. İlk issue: 20–30 real
məhsulla pilot (provayder müqayisəsi, şəkil başına xərc və müddət).

### 5.13 Təhlükəsizlik və xərc (P0)
Rol və sahiblik backend-də (middleware.ts kifayət deyil), ikinci istifadəçi testi;
rate limit (login, register, OTP, report, search, AI — istifadəçi + IP); mağaza başına
gündəlik AI kvotası; açarlar yalnız backend env-də, gitleaks; AI provayderlərində sərt xərc
limiti; idempotency; məhdud retry, özünü tetikləyən job yoxdur; upload MIME/ölçü yoxlaması;
loglarda məxfi məlumat yox; audit; backup və bərpa testi.

### 5.14 Qlobal: dil, valyuta, tema (P1)
- i18n əvvəldən: az (əsas), en, ru — UI, API xətaları, bildirişlər, axtarış sinonimləri; hreflang.
- Valyuta: əsas AZN; USD/EUR göstərilişi AMB məzənnəsi ilə.
- Gecə/gündüz rejimi: sistem + əl ilə keçid, yadda saxlanılır; contrast.py hər iki tema üçün.
- Rənglər: tünd yaşıl #16251F, qızılı #C5A15A, krem #F7F3EA, ağ #FFFFFF, mətn #292929
  (token rolları ilə; dark variantları).
- Ana səhifə: SCROLL HERO (bax 5.14a), axtarış, kateqoriyalar, seçilmiş mağazalar,
  yeni məhsullar, metal qiyməti vidceti, "Satıcı ol", Jeparla Verified izahı.

### 5.14a Scroll ilə idarə olunan hero (P1, ana səhifənin əsas vizualı)
Swarovski tipli premium hiss, amma video ÖZ-ÖZÜNƏ OYNAMIR: kadrı scroll idarə edir.
Aşağı scroll → irəli gedir, yuxarı scroll → geri qayıdır, scroll dayananda dayanır.
Üsul Planera-dakı `frontend/src/components/motion/scroll-scene.tsx` ilə eynidir: bir passive
scroll listener + requestAnimationFrame, irəliləyiş 0..1 → `--p` CSS dəyişəni, React scroll
zamanı yenidən render olunmur, prefers-reduced-motion-da səhnə statik.

Ssenari (storyboard, irəliləyiş aralıqları ilə):
1. p 0.00–0.20 — Yaxın plan: əl, barmaqda üzük. Üstündə H1 + qısa şüar.
2. p 0.20–0.45 — Kamera üzüyün DAŞINA yaxınlaşır; daş ekranın MƏRKƏZİNDƏ, ətraf
   qaralır/bulanıqlaşır, parıltı. Mətn: məs. "Hər daşın öz hekayəsi var".
3. p 0.45–0.70 — Kamera geri çəkilir: daş mərkəzdə qalır, qadının əli və üzük görünür.
4. p 0.70–0.95 — Model xanım əlini yavaşca boynuna qoyur; üzük və boyun/boyunbağı kadrda.
   Mətn: "Etibar edə biləcəyin zərgərlik".
5. p 0.95–1.00 — CTA-lar görünür: "Məhsulları kəşf et", "Satıcı ol"; sonra səhifə adi
   scroll-a keçir.

Texniki qərar (issue-da əsaslandır):
- Default: VIDEO DEYİL, KADR ARDICILLIĞI + <canvas>. `video.currentTime` ilə scrub
  iOS Safari-də titrəyir. Kadrlar: ffmpeg ilə 120–180 kadr, desktop 16:9 (1920 en)
  və mobil 9:16 (1080 en) AYRI dəstlər, WebP/AVIF, CDN/storage-dən.
  Alternativ (müqayisə et): bütün kadrları keyframe olan MP4 (`ffmpeg -g 1`) + currentTime.
- Bölmə `position: sticky` canvas + ~400vh hündürlükdə konteyner; irəliləyiş bu
  bölməyə görə hesablanır (bütün səhifəyə görə yox).
- Yükləmə: əvvəl poster (LCP), sonra hər 4-cü kadr, sonra qalanı; viewport-a yaxınlaşanda
  başlasın. Ümumi ölçü hədəfi: mobil ≤ 4 MB, desktop ≤ 8 MB.
- `prefers-reduced-motion` və ya `saveData`/zəif şəbəkə → yalnız statik poster + mətn.
- Canvas `aria-hidden`; H1, mətnlər və CTA-lar real HTML (SEO, ekran oxuyucu, 3 dil).
- Mətnlər irəliləyiş aralıqlarında opacity/translate ilə (CSS calc(--p)); dark mode-da da oxunaqlı.
- Testlər: irəliləyiş hesablaması (unit), reduced-motion-da statik (Planera-dakı
  `scroll-scene.test.tsx` kimi), Playwright-da scroll → kadr dəyişir, 390px və 1440px,
  Lighthouse performans ≥ 85 mobil.

Kontent (ayrıca issue, kod issue-larından əvvəl başlasın):
- Görüntü Jeparla-nın ÖZÜNÜNKÜ olmalıdır: Swarovski və ya başqa brendin videosu/kadrı
  istifadə olunmur. Variantlar: (a) real çəkiliş — model + tərəfdaş zərgərin üzüyü,
  makro obyektiv, sabit kamera (slider/gimbal), 4K 50–60 fps; (b) AI video generasiyası —
  "AI ilə yaradılıb" qeydi və real məhsul kimi təqdim edilmir.
- Çəkiliş qaydası: daş BÜTÜN kadrlarda təxminən eyni nöqtədə qalmalıdır (keçidlər daşın
  üzərində match-cut), neytral/tünd fon, isti işıq, qızılı tonlar (#C5A15A), 3 plan:
  makro daş → əl və üzük → əl boyunda. Modeldən yazılı razılıq.
- Montaj: ffmpeg ilə birləşdirmə, rəng düzəlişi, kadrlara çıxarma skripti repoda
  (`tools/hero-frames.sh`), sonra eyni ölçülü desktop/mobil dəstlər.

### 5.15 Brend (P1)
Jeparla loqo brifi (wordmark/monoqram, 16px-də oxunur, 1024px app ikonu, SVG, OG 1200×630),
alt yazı "ZƏRGƏRLİK • ETİBAR • TEXNOLOGİYA", istinad brendlərinə bənzəməməli.
Brend səsi: 3 söz + 10 əsas mətn (qeydiyyat, boş vəziyyət, xəta, təsdiq) 3 dildə.
Ticarət nişanı/domen yoxlama siyahısı (Azərbaycan Əqli Mülkiyyət Agentliyi, WIPO, domen,
sosial şəbəkə adları) — "yoxlanılmalı" kimi, yoxlanılmadan "boşdur" yazma.

### 5.16 Video kontent: hero video və reels (P1–P2)
Alət: https://github.com/codelady-ship/claude-video-effects (`/effects` skill, 45 effekt, MIT;
ffmpeg + Python 3.12 + OpenCV/MediaPipe). Saytın KODUNA girmir — marketinq və hero video
hazırlamaq üçündür. Qaydalar:
- Effektlər ÜZ izləyir (talking-head). Kadrda insan olmalıdır: model zərgərlik taxıb,
  satıcı və ya təsisçi danışır. Yalnız məhsul çəkilişində (üzsüz) effektlər düzgün işləmir —
  onlar üçün sadə ffmpeg montajı.
- Şrift problemi (yoxlanılıb): `bold` (Archivo Black), `serif` (Instrument Serif) və `hand`
  (Permanent Marker) şriftlərində "Ə/ə" yoxdur — "ZƏRGƏRLİK" yazısı xarab çıxar.
  Azərbaycan mətni üçün `didone`/`didonei` (Playfair Display), `mont` (Montserrat), `anton`
  və ya `ui` (Inter) istifadə et, yaxud fork-da `fx.py`-dakı FONTS xəritəsini dəyiş
  (ayrıca issue). Playfair Display + Inter saytın özü üçün də namizəddir (OFL, Ə/İ/Ş/Ğ var).
- Jeparla üçün uyğun effektlər:
  - Saytın hero-su bu alətlə EDİLMİR (bax 5.14a, scroll ilə idarə olunan kadrlar).
    Hero kadrlarından reels üçün: `slow-push`, `moody grade=warm`, `glitter-spotlight`
    (qızılı şüalar, parıltı; söz "JEPARLA") — yalnız kadrda insan üzü olanda.
  - Gündəlik qızıl qiyməti reels-i: `liquid-glass-graph` — YALNIZ real AMB rəqəmləri ilə.
  - AI Studio demo: `swipe` (əvvəl/sonra) — yalnız real AI nəticəsi ilə, "AI ilə yaradılıb" qeydi.
  - Jeparla Verified izahı: `checklist` / `apple-toggles` (Satıcı təsdiqlənib → Sənədlər → Ekspertiza).
  - Launch: `countdown-flip`, `backdrop-word`, `led-sign`, `cover-star look=editorial`.
- Effektlər "starter" versiyadır: səs və altyazı CapCut-da; hər render dərcdən əvvəl baxılır.
- Video kontentdə saxta rəqəm, saxta rəy, başqa brendin loqosu/musiqisi yoxdur;
  modellər üçün razılıq sənədi.
- Şrift düzəlişi artıq PR-dır: https://github.com/codelady-ship/claude-video-effects/pull/1
  (yoxlanılıb merge olunmalıdır — issue yaratma, yalnız asılılıq kimi qeyd et).
- Issue-lar: (b) hero video çəkiliş + montaj + optimizasiya,
  (c) launch üçün 5 reels ssenarisi və effekt planı (`<video>_effects.json`).

### 5.17 Test və qəbul (P0)
Unit + Testcontainers, rol/icazə testləri, Playwright (role/label selektorları, konsol
xətası və 5xx olarsa fail, axe), test-plan.md-dəki edge-lər (uzun mətn, Azərbaycan hərfləri,
ikiqat klik, geri düyməsi, sessiya bitməsi, mobil, yalnız klaviatura).
v1 qəbul: ziyarətçi mağaza və kateqoriya üzrə axtarır/filtrləyir; qiymət, əyar, çəki
backend-dən gəlir; mağaza yalnız öz məhsulunu idarə edir; admin təsdiq/deaktiv edir;
METAL_LINKED qiymət gündəlik yenilənir; WhatsApp düzgün nömrəyə gedir; sweep və contrast
təmizdir; backup bərpası yoxlanılıb; 1 saat istifadəsiz qalandan sonra giriş < 1 s işləyir;
Lighthouse və GEO yoxlamaları (5.18) keçir.

### 5.18 Lighthouse, Core Web Vitals və GEO (P0)
**Lighthouse** (Lighthouse CI hər PR-da, issue 2.7):
- Hədəf hər kateqoriyada 95+. CI həddi: mobil Performance >= 90, desktop >= 95;
  Accessibility = 100, Best Practices >= 95, SEO = 100. Aşağı nəticə CI-ı qırmızı edir.
- LCP < 2.0 s, CLS < 0.05, TBT < 150 ms; marşrut başına ilk yükləmə JS <= 150 KB (gzip).
- Standart olaraq Server Components; `next/image` (AVIF/WebP, `sizes`, LCP-də `priority`);
  `next/font` self-host + subset; üçüncü tərəf skriptləri yalnız lazy; hero-da LCP poster şəklidir.

**GEO** (generative engine optimization: ChatGPT, Claude, Perplexity, Gemini, Google AI
Overviews cavablarında Jeparla-nın mənbə kimi çıxması; issue 2.8, 7.6, 8.10):
- `robots.txt` AI axtarış botlarına açıq (OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot,
  Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot), kabinet və API bağlı.
- `/llms.txt` və `/llms-full.txt` (3 dil).
- JSON-LD: Organization, WebSite + SearchAction, JewelryStore, Product + Offer (AZN,
  priceValidUntil, əyar və çəki), BreadcrumbList, FAQPage, Article.
- Hər məhsulda JS-siz ilkin HTML-də görünən faktlar cədvəli; `/qiymetler` səhifəsi gündəlik
  qram qiymətini AMB mənbəsi və tarixlə verir (sitat gətirilə bilən orijinal məlumat).
- Google Search Console, Bing Webmaster Tools (ChatGPT axtarışı Bing indeksindən istifadə edir),
  Yandex Webmaster, IndexNow; analitikada AI referrer-ləri ayrıca.
- Ayda bir dəfə 10 test sualı ilə AI sistemlərində yoxlama (`docs/geo-check.md`).
- Dürüstlük: uydurma rəqəm, saxta rəy, redaktə olunmamış AI mətni yoxdur.

## 6. İş axını (hər mərhələdən sonra DAYAN və təsdiqimi gözlə)
1. **Recon:** bölmə 2-dəki saytları qaydalara uyğun araşdır → `docs/research/recon.md`
   və `features.csv`. Hər sətirdə mənbə URL-i. Ölçü qiymətləndirməsi (S/M/L) və 3 ən çətin hissə.
2. **Təhlil hesabatı:** ziddiyyətlər, boşluqlar, risklər (hüquqi: qiymətli metallar qanunu,
   vergi, komissiya müqaviləsi → "needs-decision" issue-ları), mənə suallar.
3. **Issue planı** cədvəl: epic, başlıq, prioritet, milestone, asılılıqlar, ölçü, features.csv sətri.
4. Təsdiqdən sonra `gh` ilə yarat:
   - Label-lər: epic, frontend, backend, db, infra, search, pricing, security, i18n, design,
     brand, ai, research, marketing, video, P0/P1/P2, S1–S4 (bug), needs-decision, good-first-issue
   - Milestone-lar: M0 Baza + Recon, M1 Vertical slice + Kataloq + Axtarış,
     M2 Kabinet + Admin + Verified, M3 Metal qiymətləri, M4 Seçilmişlər/Müqayisə/i18n/Tema/Brend,
     M5 AI Studio, M6 Preflight + Launch
   - Epic-lər ayrıca issue, alt issue-lar task list ilə bağlanır.
   - Əvvəlcə 1 issue yarat, göstər, sonra qalanını.

## 7. Issue formatı (Azərbaycan dilində)
```
## Məqsəd
<1–2 cümlə>
## Əhatə
- [ ] tapşırıqlar
## Əhatədən kənar
- ...
## Qəbul meyarları
- [ ] yoxlanıla bilən nəticələr (Given/When/Then)
- [ ] Ekran üçün: bütün state-lər, 390/1440px, klaviatura, dark mode, 3 dil, axe
## Texniki qeydlər
endpoint-lər, cədvəllər, fayllar; ilham mənbəyi (features.csv sətri)
## Asılılıqlar
#issue nömrələri
```
Issue-lar kiçik olsun (1 PR ≈ 1 issue, maks. 1–2 gün iş).
Repository: [repo adını bura yaz və ya məndən soruş].
