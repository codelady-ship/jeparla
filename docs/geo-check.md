# GEO yoxlaması: siyahı və ölçmə qaydası

Məqsəd (PLAN 5.18, #61, #62): Jeparla Google, Bing, Yandex axtarışında və ChatGPT, Claude, Perplexity,
Gemini, Copilot cavablarında mənbə kimi görünsün. Bu sənəd üç hissədir:

1. Kodda nə var və onu necə yoxlamaq olar (hər deploy-dan sonra, 10 dəqiqə).
2. Sahibin hesabları ilə ediləcək addımlar (bir dəfə).
3. Aylıq ölçmə: 10 test sualı və AI-dan gələn ziyarətlərin sayı.

Nəticələr `docs/deploy.md` bölmə 16-dakı cədvələ yazılır (tarix, yoxlama, nəticə). Uydurma rəqəm yazılmır:
ölçülməyibsə "ölçülməyib" yazılır.

Aşağıda `SAYT` canlı ünvandır (indi `https://jeparla.duckdns.org`, domen alınandan sonra `https://jeparla.az`).

## 1. Kodda olanlar və yoxlama

| Nə | Harada | Necə yoxlanır |
|---|---|---|
| `robots.txt`: AI botları (OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended), Googlebot, Bingbot açıq; `/api/` (paylaşım şəkilləri `/api/og/` istisna), `/*/merchant`, `/*/admin`, `/*/design` bağlı; `Sitemap:` sətri | `frontend/src/app/robots.ts` | `curl SAYT/robots.txt`; unit test `seo.test.ts` ("robots") |
| `/llms.txt`, `/llms-full.txt` (3 dil, mütləq linklər, şəxsi bölmələrə link yoxdur) | `frontend/src/lib/seo/llms.ts` | `curl SAYT/llms.txt`; unit test `seo.test.ts` ("llms.txt") |
| `sitemap.xml` (hər səhifə 3 dildə, `x-default`) | `frontend/src/app/sitemap.ts` | `curl SAYT/sitemap.xml`; hər `<loc>` 200 qaytarmalıdır |
| JSON-LD: Organization, WebSite + SearchAction, JewelryStore, Product + Offer, BreadcrumbList, FAQPage, ItemList, Article | `frontend/src/lib/seo/json-ld.ts` | Schema.org validator, Rich Results Test (bölmə 2.5) |
| Məhsul səhifəsində JS-siz faktlar cədvəli; cədvəldəki qiymət JSON-LD `Offer.price` ilə eynidir | `frontend/src/components/pdp/product-details.tsx` | unit test `seo.test.ts` ("facts table and JSON-LD agree"); `curl SAYT/az/products/<slug>` HTML-də qiymət, əyar, çəki, mağaza adı görünür |
| IndexNow: məhsul və ya mağaza dərc olunanda, dəyişəndə, gizlədiləndə, silinəndə və ya bloklananda onun səhifələri (az, en, ru) 10 dəqiqə sonra bir paketlə `api.indexnow.org`-a göndərilir (Bing, Yandex, Seznam, Naver və s. paylaşır). Metal qiymətinə bağlı məhsulların qiyməti gündəlik dəyişəndə də göndərilir | `backend/.../indexnow/`, açar faylı `frontend/src/app/api/indexnow-key/` | bölmə 2.3 |
| AI referrer-ləri ayrıca: ChatGPT, Perplexity, Gemini, Copilot, Claude, DeepSeek, Grok, Meta AI, Mistral, Alisa-dan gələn ziyarətlər gün, assistent və səhifə növü (ana, məhsul, mağaza, kateqoriya, qiymətlər, bələdçi, digər) üzrə sayılır. Kukisiz, skriptsiz (sayt serveri `Referer` və `utm_source`-a baxır), ünvan, URL və ziyarətçi saxlanmır; botlar, prefetch və 30 dəqiqə ərzində təkrar açılış sayılmır | `backend/.../analytics/`, `frontend/src/lib/ai-referrer.ts`, `frontend/src/proxy.ts` | bölmə 3.2 |

Qeyd: AI ziyarətlərinin sayılması üçün prod-da `JEPARLA_FRONTEND_TOKEN` təyin olunmalıdır (`gen-secrets.sh`
yaradır). Onsuz API bütün ziyarətləri sayt serverinin bir ünvanından gəlmiş kimi görür və saatda 30-dan
çoxunu saymır.

## 2. Sahibin addımları (bir dəfə)

Bunlar sizin hesablarınızla edilir; kod tərəfdə hər şey hazırdır. Hər addımdan sonra `docs/deploy.md`
bölmə 16-ya bir sətir yazın.

### 2.1. Google Search Console

1. https://search.google.com/search-console açın, Google hesabınızla daxil olun.
2. **Add property** -> **URL prefix** -> `SAYT/` (sonda `/` ilə) -> **Continue**.
   (Öz domeniniz olanda **Domain** üsulu daha yaxşıdır: DNS-ə TXT qeydi, env lazım deyil, `docs/deploy.md`
   bölmə 14.)
3. Təsdiq üsulları içində **HTML tag** seçin. Göstərilən teqdən yalnız `content="..."` içindəki dəyəri
   kopyalayın.
4. VM-də: `nano deploy/.env` -> `GOOGLE_SITE_VERIFICATION=<dəyər>` -> yadda saxlayın ->
   `SKIP_PULL=1 deploy/scripts/deploy.sh` (sayt yenidən qurulur, 5-10 dəqiqə).
5. Yoxlayın: `curl -s SAYT/az | grep google-site-verification` bir sətir göstərməlidir.
6. Search Console-da **Verify**.
7. Sol menyu **Sitemaps** -> `sitemap.xml` yazın -> **Submit**. Status "Success" olmalıdır.
8. **URL inspection** -> `SAYT/az` -> **Request indexing**. Eyni şeyi `SAYT/az/prices` üçün edin.

### 2.2. Bing Webmaster Tools (ChatGPT axtarışı Bing indeksindən istifadə edir)

1. https://www.bing.com/webmasters açın, Microsoft və ya Google hesabı ilə daxil olun.
2. Ən asan yol: **Import from Google Search Console** (2.1 bitibsə). Sayt və sitemap avtomatik gəlir,
   ayrıca təsdiq lazım deyil. 4-cü addıma keçin.
3. Əl ilə: **Add site** -> `SAYT/` -> **HTML Meta Tag** -> `content="..."` dəyərini `deploy/.env`-də
   `BING_SITE_VERIFICATION`-a yazın -> `SKIP_PULL=1 deploy/scripts/deploy.sh` -> **Verify**.
4. **Sitemaps** -> **Submit sitemap** -> `SAYT/sitemap.xml`.
5. IndexNow-u açandan sonra (2.3) **IndexNow** bölməsində göndərilən URL-lər görünəcək.

### 2.3. IndexNow açarı

1. VM-də açar yaradın: `openssl rand -hex 16` (32 simvol, məs. `3f9a...`). Açar gizli deyil (saytda
   açıq görünür), amma repoya, issue-ya və ya söhbətə yazılmır: yalnız `deploy/.env`-də olur.
2. `nano deploy/.env` -> `JEPARLA_INDEXNOW_KEY=<açar>` -> yadda saxlayın.
3. Konteynerləri yeni env ilə yenidən başladın (build lazım deyil):
   `docker compose -f deploy/docker-compose.prod.yml up -d api web`.
4. Yoxlayın: `curl -s SAYT/<açar>.txt` açarın özünü qaytarmalıdır; başqa ad (`curl -sI SAYT/xxxxxxxx.txt`) 404.
5. Admin panelində bir mağazanı və ya məhsulu təsdiq edin (və ya ilk real mağaza təsdiqlənəndə gözləyin).
   11-12 dəqiqə sonra API logunda bir sətir görünməlidir:
   `docker compose -f deploy/docker-compose.prod.yml logs --since 20m api | grep IndexNow`
   -> `IndexNow: submitted N URLs`. `rejected ... 403` görsəniz: 4-cü addım işləmir (açar faylı açılmır).
6. 1-2 gün sonra Bing Webmaster -> **IndexNow** bölməsində URL-lər görünür.

Açarı dəyişmək: yeni açar yazın və 3-cü addımı təkrarlayın. Söndürmək: dəyəri boş qoyun.

### 2.4. Yandex Webmaster (könüllü, rusdilli auditoriya üçün)

IndexNow göndərişlərini Yandex təsdiqsiz də qəbul edir. Statistikanı görmək üçün:

1. https://webmaster.yandex.com -> **Add site** -> `SAYT/`.
2. Təsdiq: **DNS record** üsulu. DuckDNS bir TXT qeydi saxlayır: brauzerdə
   `https://www.duckdns.org/update?domains=jeparla&token=<DuckDNS tokeniniz>&txt=<Yandex-in verdiyi dəyər>`
   açın ("OK" yazmalıdır), sonra Yandex-də **Check**. (Öz domeniniz olanda TXT qeydini DNS-ə əlavə edin.)
3. **Indexing** -> **Sitemap files** -> `SAYT/sitemap.xml`.

### 2.5. Google Rich Results Test və Schema.org validator

İlk real mağaza və məhsul təsdiqlənəndən sonra (prod bazası hələ boşdur):

1. https://search.google.com/test/rich-results -> URL: `SAYT/az/products/<slug>` -> **Test URL**.
   Gözlənilən: "Product snippets" və "Merchant listings" (və ya ən azı "Product snippets") **valid**, 0 xəta.
   Xəbərdarlıqlar (məsələn `review`, `aggregateRating` yoxdur) normaldır: saxta rəy yazmırıq.
2. Eyni test: `SAYT/az/stores/<slug>` (LocalBusiness), `SAYT/az/categories/<slug>` (FAQ, Breadcrumbs),
   `SAYT/az/help` (FAQ).
3. https://validator.schema.org -> eyni URL-lər -> 0 xəta.
4. Nəticəni `docs/deploy.md` bölmə 16-ya yazın və #61-də şərh edin.

## 3. Aylıq ölçmə (ayın ilk həftəsi)

### 3.1. 10 test sualı

Hər sualı ChatGPT (axtarış açıq), Perplexity, Gemini, Copilot və Claude-da (veb axtarışı açıq) verin.
Hər dəfə yeni söhbət, giriş edilmiş və ya edilməmiş vəziyyət eyni olsun. Hər cavab üçün qeyd edin:
Jeparla adı çəkilir (bəli/xeyr), Jeparla linki mənbələrdə var (bəli/xeyr), verilən fakt düzgündür (bəli/xeyr/yoxlanmadı).

1. Bakıda 585 əyar qızıl üzük harada almaq olar?
2. Bu gün Azərbaycanda 1 qram qızılın qiyməti nə qədərdir?
3. 585 və 750 əyar qızılın fərqi nədir?
4. Bakıda yoxlanılmış zərgərlik mağazaları hansılardır?
5. Gümüş sırğa Bakıda neçəyədir?
6. Üzük ölçüsünü evdə necə təyin etmək olar?
7. Где в Баку купить золотое обручальное кольцо?
8. Сколько стоит грамм золота 585 пробы в Азербайджане сегодня?
9. Where can I buy a diamond ring in Baku from a verified jeweller?
10. How is the price of gold jewellery calculated in Azerbaijan?

Nəticə cədvəli (hər ay bir sətir, `docs/deploy.md` bölmə 16):

| Ay | Sistem | Ad çəkilən sual sayı (0-10) | Link verilən sual sayı (0-10) | Səhv fakt | Qeyd |
|---|---|---|---|---|---|

Səhv fakt görsəniz: həmin mövzunu saytda (FAQ, bələdçi, `/prices`) daha aydın yazmaq üçün issue açın.

### 3.2. AI-dan gələn ziyarətlər

Son 30 günün sayları VM-də:

```sh
docker compose -f deploy/docker-compose.prod.yml exec postgres psql -U postgres -d jeparla -c \
  "SELECT source, page, SUM(visits) AS visits FROM ai_referral_counts
   WHERE day >= CURRENT_DATE - 29 GROUP BY source, page ORDER BY visits DESC;"
```

Eyni məlumat API-də: `GET /api/v1/admin/stats/ai-referrals?days=30` (yalnız ADMIN tokeni ilə).

Aylıq cədvələ hər assistent üzrə cəmi yazın. Müqayisə üçün Search Console (**Performance**) və Bing
Webmaster (**Search Performance**) kliklərini də yazın.

## 4. Hədlər və məhdudiyyətlər

- AI ziyarəti yalnız assistent `Referer` göndərəndə və ya linkə `utm_source` əlavə edəndə tanınır. Bəzi
  tətbiqlər (mobil tətbiqlər, bəzi Copilot və Gemini görünüşləri) heç birini göndərmir: belə ziyarətlər
  "birbaşa" sayılır və bu cədvəldə görünmür. Rəqəm alt həddir.
- IndexNow yalnız indeksləməni sürətləndirir; Google IndexNow istifadə etmir (Google üçün sitemap və Search
  Console kifayətdir).
- Admin tərəfindən birbaşa SQL ilə edilən dəyişikliklər IndexNow-a getmir; sitemap onları yenə göstərir.
