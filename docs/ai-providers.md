# AI provayderləri: necə qoşulur

Jeparla AI funksiyalarının kodu provayderdən asılı deyil. Repoda **heç bir real provayder, açar və ya
ödənişli API çağırışı yoxdur** (sahibin qərarı, 2026-11-14). Hər funksiya interfeys arxasındadır və standart
olaraq söndürülüb: UI və API açıq şəkildə "qoşulmayıb" deyir, heç vaxt nümunə və ya saxta nəticə göstərmir.

| Funksiya | Issue | Interfeys | Seçim (env) | Standart |
| --- | --- | --- | --- | --- |
| AI Studio: studiya şəkli, model üzərində görünüş | #55, #121, #130 | `az.jeparla.ai.provider.ImageGenerationProvider` | `JEPARLA_AI_IMAGE_PROVIDER` | `none` |

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

Namizədlər (#54 pilotu seçir): Higgsfield (məhsul şəkli və "product on model"), Gemini (Google AI Studio,
şəkil redaktəsi). Seçim meyarı: əşyanın forması, rəngi və daşları dəyişməməlidir; dəyişirsə nəticə rədd edilir.
Xərc və lisenziya seçiləndə bu sənədə yazılır.

### AI model kitabxanası (#130)

- Admin `/api/v1/admin/ai-models` ilə model əlavə edir (ad, auditoriya WOMEN/MEN/KIDS, dəri tonu, üslub,
  mənşə), istinad şəkillərini poza ilə yükləyir (məhsul şəkilləri ilə eyni yoxlanılmış yükləmə, public
  bucket `ai-models/<id>/`), sıralayır, auditoriya üzrə "əsas" seçir, deaktiv edir. Model silinmir.
- Satıcı `GET /api/v1/merchant/ai/models?audience=` ilə yalnız aktiv və şəkli olan modelləri görür;
  `VIRTUAL_TRY_ON` tapşırığında `modelId` göndərir. Deaktiv model yeni tapşırıqda qəbul olunmur
  (`ai.model_inactive`), əvvəl təsdiqlənmiş şəkillər məhsulda qalır.
- Worker modelin istinad şəkillərini `GenerationRequest.referenceImageUrls`-də, auditoriyanı isə prompt
  parametrində provayderə verir: provayder eyni üzü və bədən nisbətini saxlamaq üçün bunlardan istifadə edir.
- Başlanğıc dəsti (~10 model) bir dəfə yaradılır (provayder və xərc sahibin təsdiqi ilə) və `docs/credits.md`-də
  qeyd olunur.

### Dürüstlük

- Provayder qoşulmayanda heç bir nümunə AI şəkil göstərilmir.
- Hər təsdiqlənmiş AI şəkil `aiGenerated=true` ilə saxlanılır və kataloqda, məhsul səhifəsində "AI ilə yaradılıb"
  nişanı ilə görünür; JSON-LD-də orijinal şəkil birincidir.
- Modellər real şəxs deyil; real insan şəkli yüklənmir.
