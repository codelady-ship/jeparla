# AI provayderləri: necə qoşulur

Jeparla AI funksiyalarının kodu provayderdən asılı deyil. Repoda **heç bir açar yoxdur** və heç bir ödənişli API
standart olaraq çağırılmır (sahibin qərarı, 2026-11-14). Tək real provayder kodu Google Gemini-dir (#313, sahibin
qərarı, 2026-11-23): o da açar, `JEPARLA_AI_IMAGE_PROVIDER=gemini` və sıfırdan böyük aylıq limit olmadan işə
düşmür. Hər funksiya interfeys arxasındadır və standart olaraq söndürülüb: UI və API açıq şəkildə "qoşulmayıb"
deyir, heç vaxt nümunə və ya saxta nəticə göstərmir.

| Funksiya | Issue | Interfeys | Seçim (env) | Standart |
| --- | --- | --- | --- | --- |
| AI Studio: studiya şəkli, model üzərində görünüş | #55, #121, #130, #313 | `az.jeparla.ai.provider.ImageGenerationProvider` | `JEPARLA_AI_IMAGE_PROVIDER` (`none`, `gemini`) | `none` |

Sonrakı PR-lar bu cədvələ öz interfeyslərini əlavə edir (şəkillə axtarış #163, studiya görünüşü #119).

## AI Studio (#55)

### Necə işləyir

1. Satıcı `/merchant/products/[id]/ai-studio`-da orijinal şəkli və növü (`AI_PHOTOSHOOT`, `VIRTUAL_TRY_ON`)
   seçir: `POST /api/v1/merchant/ai/jobs`. Tapşırıq `QUEUED` olur, mağazanın gündəlik kvotasından bir yer gedir.
2. `AiJobWorker` (hər 15 san.) növbədən ən köhnə tapşırığı `FOR UPDATE SKIP LOCKED` ilə götürür, aylıq xərc
   limitini yoxlayır (advisory lock altında), `ai_job_attempts`-ə cəhd yazır və provayderi **tranzaksiyadan
   kənarda** çağırır.
3. Nəticə magic-number ilə yoxlanılır (JPEG, PNG, WebP; 15 MB, 12000 px) və **private** bucket-ə
   (`ai/<store>/<product>/<uuid>.<ext>`) yazılır. Tapşırıq `REVIEW_REQUIRED` olur; satıcı nəticəni qısa
   ömürlü private URL ilə görür.
4. Satıcı təsdiqləyəndə (`/approve`) fayl public bucket-ə köçürülür və məhsula **yeni** şəkil kimi
   `aiGenerated=true` ilə, orijinal şəkillərdən sonra əlavə olunur ("AI ilə yaradılıb" nişanı). APPROVED məhsul
   yenidən moderasiyaya gedir. Rədd (`/reject`) və silmə (`DELETE`) private faylları silir.

Orijinal şəkil heç vaxt dəyişmir; AI şəkildən yeni AI şəkil yaratmaq olmur (`ai.source_ai_generated`).

### Limitlər

- `ai-job-account`: hesab başına saatda 30 sorğu (rate limit).
- `JEPARLA_AI_DAILY_JOBS_PER_STORE` (10): mağaza başına gündəlik tapşırıq və təkrar cəhd, Bakı vaxtı ilə.
- `jeparla.ai.max-attempts` (3): bir tapşırığın cəhd sayı. Provayder rədd edibsə (`ai.provider_refused`) və ya
  orijinal şəkil silinibsə təkrar cəhd yoxdur. Heç bir tapşırıq özünü yenidən növbəyə salmır.
- `JEPARLA_AI_MONTHLY_COST_LIMIT` (`0`): bütün mağazalar üçün aylıq **sərt** xərc limiti
  (`JEPARLA_AI_COST_CURRENCY`, standart USD). `0` olanda provayder qoşulsa da heç nə işə düşmür: büdcəni
  sahib açıq təyin edir. Bundan əlavə provayderin öz hesabında da xərc limiti qoyun.

### Provayder necə əlavə olunur

1. `az.jeparla.ai.provider` paketində `ImageGenerationProvider`-i implement edən Spring bean yazın, məsələn
   `HiggsfieldImageProvider`:
   - `id()` env dəyərinə bərabərdir (`higgsfield`);
   - `configured()` açar və endpoint varsa `true`;
   - `estimatedCost(request)` bir çağırışın gözlənilən qiyməti (limit bununla yoxlanılır);
   - `generate(request)` provayder bitənə qədər gözləyir (asinxron API-də daxildə polling), `attempt-timeout`
     (5 dəq.) daxilində qayıdır və uğursuzluqda yalnız `ImageGenerationException` atır
     (`ai.provider_error`, `ai.provider_refused`, `ai.timeout`). Provayderin mətni istifadəçiyə getmir.
2. Açarları yalnız env-də saxlayın (məs. `JEPARLA_HIGGSFIELD_API_KEY`), `@ConfigurationProperties` ilə oxuyun,
   loglara yazmayın. Repoya və `application.yml`-ə açar düşmür (gitleaks yoxlayır).
3. `GenerationRequest`-də provayderə gedən hər şey: orijinal şəklin public URL-i, repodakı prompt
   (`backend/src/main/resources/ai/prompts/<KIND>.txt`, dəyişikliyi review-dan keçir), çıxış sayı, 4:5 kəsim və
   parametrlər (#121: auditoriya, poza; #130: modelin istinad şəkilləri). Şəxsi məlumat göndərilmir.
4. Testdə provayderi stand-in ilə əvəz edin (`AiStudioApiTests.StandInProvider` nümunədir), real API-ni CI-da
   çağırmayın.
5. Deploy: `JEPARLA_AI_IMAGE_PROVIDER=higgsfield`, `JEPARLA_AI_MONTHLY_COST_LIMIT=<büdcə>` və provayderin
   açarları. Səhv id ilə tətbiq başlamır (səssizcə sönmür).

Namizədlər və pilot: aşağıda "Provayder müqayisəsi və pilot (#54)". Seçim meyarı: əşyanın forması, rəngi və
daşları dəyişməməlidir; dəyişirsə nəticə rədd edilir. Xərc və lisenziya seçiləndə bu sənədə yazılır.

### Gemini qoşmaq (#313)

Kod: `az.jeparla.ai.provider.GeminiImageProvider` (id `gemini`). Hər çıxış şəkli üçün Gemini API-yə bir
`generateContent` sorğusu gedir (`x-goog-api-key` başlığı ilə): repodakı prompt, məhsulun orijinal şəkli və AI
modelin istinad şəkilləri (ən çox 3). Şəkillər bizim public bucket-dəndirsə birbaşa storage-dən oxunur, yoxsa
yalnız http(s) ilə, 10 MB və 20 san. limiti ilə endirilir; yalnız JPEG, PNG, WebP göndərilir. Cavabda şəkil
yoxdursa və ya Google təhlükəsizlik səbəbi ilə bloklayıbsa tapşırıq `ai.provider_refused` (təkrar yoxdur),
HTTP xətası `ai.provider_error`, 120 san.-dən uzun gözləmə `ai.timeout` olur. Google-un mətni satıcıya getmir,
açar loga yazılmır.

Sahibin addımları:

1. **Açar.** [Google AI Studio](https://aistudio.google.com/)-da Jeparla üçün ayrıca layihədə API açarı yaradın.
   Şəkil generasiyası pulsuz səviyyədə məhdud və ya yoxdur; billing açmaq **ödənişli addımdır** və yalnız sahibin
   qərarı ilə edilir. Pulsuz səviyyədə göndərilən məlumat Google-un modellərinin təkmilləşdirilməsində istifadə
   oluna bilər: real satıcı şəkilləri yalnız ödənişli səviyyədə göndərilir (yuxarıdakı cədvəl).
2. **Google tərəfində xərc limiti.** Layihənin billing hesabında aylıq büdcə və xəbərdarlıq qoyun (Google Cloud
   Billing, "Budgets & alerts"), mümkünsə AI Studio-da layihənin xərc limitini də. Bu, API-nin öz limitindən
   əlavədir.
3. **VM-də env** (`deploy/.env`, `chmod 600`; repoya heç vaxt):
   ```
   JEPARLA_AI_IMAGE_PROVIDER=gemini
   JEPARLA_GEMINI_API_KEY=<açar>
   JEPARLA_AI_MONTHLY_COST_LIMIT=10
   ```
   Sonra `deploy/scripts/deploy.sh` (yenidən başlatma kifayətdir).
4. **Aylıq limit.** `JEPARLA_AI_MONTHLY_COST_LIMIT` USD ilə bütün mağazalar üçün sərt limitdir; `0` olanda heç
   nə işə düşmür. Hər şəkil `JEPARLA_GEMINI_COST_PER_IMAGE` (standart `0.039` USD, `gemini-2.5-flash-image`)
   qədər sayılır; məsələn 10 USD təxminən 256 şəkildir. Qiyməti Google-un rəsmi qiymət səhifəsində yoxlayın və
   fərqlidirsə env-də dəyişin. Model `JEPARLA_GEMINI_MODEL` ilə dəyişir.
5. **Avtomatik model üzərində şəkil.** İstəsəniz `JEPARLA_AI_AUTO_TRY_ON=true`: məhsulun ilk orijinal şəkli
   əlavə olunanda `VIRTUAL_TRY_ON` tapşırığı növbəyə düşür (gündəlik kvota və aylıq limit tətbiq olunur), nəticə
   yenə satıcının təsdiqini gözləyir.

Model seçilməyəndə (kitabxanada uyğun model yoxdursa) prompt standart olaraq **yetkin qadın** model istəyir:
qadın və unisex əşyalar üçün (sahibin qərarı, 2026-11-23), saytın üslubunda: isti krem fon, yumşaq qızılı işıq,
sakit premium görünüş. Kişi zərgərliyi kişi modeldə, uşaq zərgərliyi ayrıca uşaq promptu ilə qalır.

### AI model kitabxanası (#130)

- Admin `/admin/ai-models` səhifəsində (API: `/api/v1/admin/ai-models`) model əlavə edir və dəyişir (ad,
  auditoriya WOMEN/MEN/KIDS, dəri tonu, üslub, mənşə, sıra), istinad şəkillərini poza ilə yükləyir (məhsul
  şəkilləri ilə eyni yoxlanılmış yükləmə: presigned URL, sonra fayl yoxlanılır; public bucket
  `ai-models/<id>/`), şəkli silir, auditoriya üzrə "əsas" seçir, deaktiv edir və geri aktiv edir. Model
  silinmir. Hər dəyişiklik audit jurnalına düşür; yalnız ADMIN (backend yoxlayır).
- Satıcı `GET /api/v1/merchant/ai/models?audience=` ilə yalnız aktiv və şəkli olan modelləri görür;
  `VIRTUAL_TRY_ON` tapşırığında `modelId` göndərir. Deaktiv model yeni tapşırıqda qəbul olunmur
  (`ai.model_inactive`), əvvəl təsdiqlənmiş şəkillər məhsulda qalır.
- Worker modelin istinad şəkillərini `GenerationRequest.referenceImageUrls`-də, auditoriyanı isə prompt
  parametrində provayderə verir: provayder eyni üzü və bədən nisbətini saxlamaq üçün bunlardan istifadə edir.
- Başlanğıc dəsti (~10 model) bir dəfə yaradılır (provayder və xərc sahibin təsdiqi ilə) və `docs/credits.md`-də
  qeyd olunur.

### Model üzərində şəkil (#121)

- Məhsulun `audience` sahəsi var (WOMEN, MEN, KIDS, UNISEX; `V42__product_audience.sql`). Formada "Kimin
  üçündür" seçilir; göndərilməyəndə yaradılışda kateqoriyadan təklif olunur ("Kişi zərgərliyi" altında MEN,
  "Uşaq zərgərliyi" altında KIDS, qalanı UNISEX), yenilənmədə saxlanılır.
- `GET /api/v1/merchant/ai/models?productId=` yalnız məhsulun auditoriyasına uyğun modelləri qaytarır. Uşaq
  zərgərliyi yalnız uşaq modeldə, uşaq model yalnız uşaq zərgərliyi ilə; UNISEX istənilən yetkin modeldə.
  Uyğunsuz model `400 ai.model_mismatch`.
- Poza kateqoriyadan gəlir (üzük: əl, sırğa: qulaq, boyunbağı/zəncir/asqı: boyun, qolbaq: bilək, dəst və broş:
  yarım portret) və prompt parametrinə düşür. KIDS məhsul üçün ayrıca prompt var
  (`VIRTUAL_TRY_ON_KIDS.txt`: sadə, yaşa uyğun geyim, makiyaj və "yetkin" üslub yoxdur, yaxın kəsim).
- Qalereya qaydası: orijinal şəkil varsa birinci həmişə orijinaldır (`400 merchant.image_order_ai_first`);
  AI şəkillər qalanda son orijinal silinmir (`409 merchant.last_original`).
- Avtomatik başlatma: `JEPARLA_AI_AUTO_TRY_ON=true` olanda məhsulun ilk orijinal şəkli əlavə edilən kimi
  `VIRTUAL_TRY_ON` tapşırığı növbəyə düşür (uyğun ilk model ilə). Default `false`. Provayder, limit və ya büdcə
  imkan vermirsə heç nə növbəyə düşmür və şəkil yükləməsi pozulmur; nəticə yenə satıcının təsdiqini gözləyir.

### Studiya görünüşü (#119)

- AI Studio-da üçüncü növ: `STUDIO_LOOK`. Satıcının öz şəkli kataloq standartına gətirilir (`docs/DESIGN.md`
  "Məhsul şəkli standartı"): fon silinir, krem fonda mərkəzə qoyulur, yumşaq kölgə, 4:5. Təlimat
  `ai/prompts/STUDIO_LOOK.txt`-dədir.
- Ayrıca prosessor: `JEPARLA_AI_STUDIO_PROCESSOR` (default `none`, "qoşulmayıb"). Eyni
  `ImageGenerationProvider` interfeysi, amma `generative()` `false` qaytarır (əşyanı dəyişmir) və adətən
  `local()` `true`-dur (API-nin CPU-sunda, məs. ONNX fon silmə modeli): aylıq xərc limiti ona tətbiq olunmur,
  mağaza üzrə gündəlik kvota tətbiq olunur (növbə ilə, Oracle ARM VM-i yükləməmək üçün).
- Hər nəticə faylı `ai_assets.ai_generated` (V44) ilə saxlanılır: generativ olmayan nəticə təsdiqdən sonra
  `aiGenerated=false` məhsul şəkli olur, nişansız. Generativ provayder seçilibsə nişan həmişə qalır.
- Orijinal şəkil dəyişmir; nəticə əlavə şəkil kimi gəlir, satıcı istəsə onu birinci edir (#121 qaydası: birinci
  şəkil AI ilə yaradılmış ola bilməz, təmizlənmiş foto isə orijinal sayılır).
- Seçim qaydası (başlanğıcda yoxlanılır): `JEPARLA_AI_STUDIO_PROCESSOR`-a generativ provayder, `JEPARLA_AI_IMAGE_PROVIDER`-ə
  generativ olmayan prosessor yazılsa tətbiq başlamır.

#### Lokal prosessor: `JEPARLA_AI_STUDIO_PROCESSOR=local`

Pulsuz, VM-in öz CPU-sunda, heç bir xarici API olmadan (`az.jeparla.ai.studio`):

1. Orijinal şəkil public bucket-dən oxunur (URL fetch yoxdur), EXIF istiqaməti tətbiq olunur, emal üçün ən çox
   2000 px-ə kiçildilir. JPEG, PNG, WebP.
2. **Seqmentasiya modeli** (ONNX Runtime 1.22, CPU) əşyanın yumşaq maskasını verir. Model şəkil çəkmir, yalnız hər
   piksel üçün "əşya / fon" ehtimalı verir.
3. `StudioComposer` (təmiz Java, model yoxdur): kiçik ləkələr atılır, kənar piksellərdən köhnə fonun rəngi
   çıxarılır, əşya krem `#F7F3EA` fonda mərkəzə qoyulur (4:5 kadrın ~70%-i; orijinal kadrdan çıxan zəncir yeni
   kadrın da həmin kənarından çıxır), altına yumşaq kölgə. Əşyanın öz piksellərinə yalnız bir ümumi parlaqlıq
   əmsalı (0.92-1.15, üç kanal üçün eyni, rəng tonu qalır) tətbiq olunur. Nəticə JPEG, 800-1600 px en; faylın
   JPEG şərhində "Jeparla studio look ... not generated or redrawn" yazılır (emal olunmuş foto işarəsi).
4. Maskada əşya tapılmasa tapşırıq `ai.bad_result` ilə bitir (boş kadr qaytarılmır).

| Model (`JEPARLA_AI_STUDIO_MODEL`) | Lisenziya | Fayl | Giriş | RAM (pik, proses) | Vaxt / şəkil |
| --- | --- | --- | --- | --- | --- |
| `isnet` (default): IS-Net general use, [DIS](https://github.com/xuebinqin/DIS) | Apache-2.0 | 179 MB | 1024 px | ~1.05 GB (heap daxil) | ~10-13 s 2 thread x64 masaüstü; ARM VM-də ~15-30 s (gözlənilən) |
| `u2netp`: [U2-Net](https://github.com/xuebinqin/U-2-Net) kiçik | Apache-2.0 | 4.6 MB | 320 px | ~0.5 GB (heap daxil) | ~5 s (çoxu kompozisiya); zəncirdə kobud |

Ölçmə: 2026-11-18, 800x1000 foto, `-Xmx512m`, 2 thread, Windows x64 masaüstü. ARM VM-də ölçmə sahibin
yoxlamasıdır (#282). Tapşırıq asinxrondur (`attempt-timeout` 5 dəq.), satıcı gözləmir.

- Fayllar: [rembg](https://github.com/danielgatis/rembg) (MIT) layihəsinin `v0.0.0` release asset-ləri, SHA-256
  kodda sabitdir (`SegmentationModel`): `isnet-general-use.onnx` `60920e99c454...`, `u2netp.onnx` `309c8469258d...`.
  Fayl repoya düşmür: prosessor seçiləndə tətbiq başlayandan sonra fonda `JEPARLA_MODELS_DIR`-ə (prod-da
  `models-data` volume) bir dəfə endirilir; hash uyğun gəlməsə yüklənmir, prosessor "qoşulmayıb" qalır.
  CI heç nə endirmir (testlər saxta seqmentator ilə).
- ONNX Runtime (MIT) Java heap-dən kənar yaddaş işlədir. Prosessoru açanda `deploy/.env`-də:
  `JEPARLA_API_MEM_LIMIT=4g` və `JEPARLA_API_JAVA_OPTS=-XX:MaxRAMPercentage=50 -XX:+ExitOnOutOfMemoryError`
  (heap 2 GB, model üçün ~2 GB yer). VM-də 12 GB var; pullu resurs lazım deyil.
- Bir anda bir şəkil emal olunur (növbə), `JEPARLA_AI_STUDIO_THREADS=2`.
- Eyni pipeline komanda sətrindən: `./gradlew studioLook --args="--size 800x1000 --out build/studio <fayllar>"`
  (demo fotolar belə hazırlanıb, `docs/credits.md`).

### Dürüstlük

- Provayder qoşulmayanda heç bir nümunə AI şəkil göstərilmir.
- Hər təsdiqlənmiş AI şəkil `aiGenerated=true` ilə saxlanılır və kataloqda, məhsul səhifəsində "AI ilə yaradılıb"
  nişanı ilə görünür; JSON-LD-də orijinal şəkil birincidir.
- Modellər real şəxs deyil; real insan şəkli yüklənmir.

## Provayder müqayisəsi və pilot (#54)

Bu bölmə qərar sənədinin layihəsidir: hansı provayder və hansı məhsul növü ilə başlanır. **Qərarı sahib verir**,
pilot real generasiya tələb etdiyi üçün yalnız sahibin təsdiqi və büdcəsi ilə keçirilir (sahibin qərarı,
2026-11-14: ödənişli generasiya və ödənişli xidmət yoxdur). Pilot #282-də sahibin bəndi kimi izlənilir.

### Namizədlər

**Diqqət: qiymətlər, pulsuz limitlər və lisenziya şərtləri tez dəyişir. Cədvəldəki hər rəqəm ümumi ictimai
məlumata əsaslanan təxmindir, 2026-11-18-də yoxlanılmayıb: istifadədən əvvəl provayderin rəsmi qiymət və
şərtlər səhifəsində yoxlayın** və yoxlama tarixini bura yazın.

| Provayder (növ) | Nə üçün | Qiymət (təxmini, yoxlanmalıdır) | Pulsuz limit (yoxlanmalıdır) | Qeyd |
| --- | --- | --- | --- | --- |
| Google Gemini şəkil modeli (API, Google AI Studio açarı) | AI fotosessiya, şəkil redaktəsi, model üzərində (istinad şəkilləri ilə) | şəkil başına təxminən 0.04 USD səviyyəsində | Veb interfeysdə sınaq var; API-də şəkil generasiyasının pulsuz kvotası məhdud və ya yoxdur | Pulsuz səviyyədə göndərilən məlumat modelin təkmilləşdirilməsində istifadə oluna bilər: real satıcı şəkilləri yalnız ödənişli səviyyədə |
| OpenAI şəkil modeli (API) | AI fotosessiya, redaktə | keyfiyyətdən asılı, şəkil başına təxminən 0.01-0.20 USD | Adətən yoxdur | Kiçik detallarda (daş sayı, damğa) dəyişiklik riski pilotda ölçülməlidir |
| Higgsfield (abunə, kredit) | Məhsul şəkli, "product on model", video | aylıq plan + kredit; şəkil başına qiymət plana bağlıdır | Sınaq krediti ola bilər | API şərtləri və kommersiya lisenziyası ayrıca yoxlanmalıdır |
| fal.ai / Replicate (açıq modellərin hostinqi, məs. FLUX Kontext) | Redaktə, fon dəyişmə, "product on model" | şəkil və ya GPU saniyəsi başına; təxminən 0.03-0.08 USD | Kiçik başlanğıc krediti ola bilər | Hər modelin öz lisenziyası var (bəziləri kommersiya üçün ayrıca icazə tələb edir) |
| Geyim try-on xidmətləri (məs. FASHN) | Virtual try-on | şəkil başına təxminən 0.05-0.10 USD | Sınaq krediti ola bilər | Geyim üçün qurulub; zərgərlikdə (kiçik əşya, daş) nəticə zəif ola bilər |
| Lokal, generativ olmayan fon silmə (açıq model, ONNX, VM CPU) | Yalnız `STUDIO_LOOK` (#119) | 0 (VM-in CPU-su) | Yoxdur (lazım deyil) | Model lisenziyası kommersiya istifadəsinə icazə verməlidir; bəzi tanınmış fon silmə modelləri yalnız qeyri-kommersiyadır. Generativ deyil: nişan qoyulmur |

### Pilot protokolu

1. **Dəst:** 20-30 real məhsul şəkli, satıcının yazılı icazəsi ilə (növlər üzrə: üzük, sırğa, boyunbağı/asqı,
   qolbaq; qızıl, gümüş, daşlı və daşsız). Şəkillər yalnız pilot üçündür və pilotdan sonra provayderdə silinir.
2. **Hər provayderdə eyni giriş:** repodakı promptlar (`backend/src/main/resources/ai/prompts/`), 4:5, eyni
   istinad şəkilləri. Hər məhsul üçün 1-2 nəticə.
3. **Ölçülən:**
   - əşyanın qorunması: forma, rəng, daşların sayı və yeri, ölçü nisbəti. İki nəfər ayrıca qiymətləndirir:
     "keçdi" yalnız hər ikisi razıdırsa. Biri "dəyişib" deyirsə nəticə rədd edilir;
   - şəkil başına real xərc (provayder hesabından, `ai_job_attempts.cost` ilə müqayisə);
   - cavab müddəti (median və ən uzun);
   - uğursuzluq və imtina faizi;
   - lisenziya: nəticəni kommersiya məqsədilə istifadə etmək olarmı, məlumat təlimdə istifadə olunurmu.
4. **Hesabat:** provayder x məhsul növü cədvəli (keçid faizi, orta xərc, median müddət). Saxta və ya seçilmiş
   nəticə yoxdur: bütün nəticələr, rədd edilənlər də, sayılır.
5. **Qərar:** keçid faizi ən yüksək və xərci büdcəyə sığan provayder, ilk olaraq ən yaxşı nəticə verən məhsul
   növü ilə (PLAN 5.12: əvvəl boyunbağı və sırğa). Qərar bu bölməyə tarix və sahibin adı ilə yazılır, sonra
   provayder `ImageGenerationProvider` kimi qoşulur (yuxarıda "Provayder necə əlavə olunur").

### Qərar

2026-11-23, sahib: AI Studio-nun (model üzərində görünüş və AI fotosessiya) provayderi Google Gemini-dir
(`gemini-2.5-flash-image`), yuxarıda "Gemini qoşmaq" (#313). Aylıq büdcə (`JEPARLA_AI_MONTHLY_COST_LIMIT`) və
qiymətin yoxlama tarixi sahib təyin edəndə bura yazılır. Yuxarıdakı pilot protokolu ilk real nəticələrin
yoxlanmasında yenə tətbiq olunur.
