# Jeparla: qısa videolar (Reels, Shorts, TikTok) və 4 həftəlik plan

Issue-lar: #146 (qısa videolar), #51 (launch reels), #101 (Instagram, SMM, satıcı cəlbi).
Paylaşım sahibin işidir (sahibin qərarı, 2026-11-18; izləmə #282). Agent heç bir hesaba girmir və
heç nə paylaşmır.

Bu sənəd `docs/marketing/`-dəki launch dəstinin davamıdır: profil, bio və highlight-lar
[`profile.md`](../marketing/profile.md), DM şablonlarının tam variantı
[`seller-outreach.md`](../marketing/seller-outreach.md), ümumi təqvim
[`calendar.md`](../marketing/calendar.md). Burada yalnız hazır 5 qısa video, onların mətnləri,
dərc sırası və hesabların hazırlanması var. Təkrar olmasın deyə, köhnə sənəddəki bir şey dəyişəndə
əsas mənbə oradır.

## 1. Videolar

Hamısı Remotion-dadır (`video/src/social/shorts/`), 1080x1920, 30 fps, H.264, səssiz (musiqi
yoxdur). Hər videonun 3 faylı var, yalnız son kadrdakı çağırış fərqlidir:

| Fayl sonu | Platforma | Son kadrda |
|---|---|---|
| `-ig.mp4` | Instagram Reels | Link bioda |
| `-tt.mp4` | TikTok | Link profildə |
| `-yt.mp4` | YouTube Shorts | Link kanalın səhifəsində (Shorts təsvirindəki link kliklənmir) |

Fayllar repoda deyil: `video/out/social/` (gitignore). Örtüklər (cover) repoda:
`docs/social/covers/`.

| # | Kompozisiya | Fayl adı | Müddət | Mövzu | AI vizual |
|---|---|---|---|---|---|
| 1 | `Short1Jeparla` | `jeparla-01-nedir` | 18 s | Jeparla nədir | Bəli (hero heyvanları və modellər) |
| 2 | `Short2MetalPrice` | `jeparla-02-qiymet` | 22 s | 585 qızılın qram qiyməti AMB-dən necə hesablanır | Xeyr |
| 3 | `Short3Hallmark` | `jeparla-03-eyar` | 20 s | 585, 750, 925: əyar nədir, almadan əvvəl nəyi yoxlamalı | Xeyr |
| 4 | `Short4Sellers` | `jeparla-04-satici` | 22 s | Satıcılar üçün: mağazanı pulsuz yerləşdir | Xeyr |
| 5 | `Short5Verified` | `jeparla-05-verified` | 20 s | Jeparla Verified nişanı nə deməkdir | Xeyr |

Reel 1 (`Reel1`, sahibin öz videosu ilə) ayrıca qalır: onun ekranlarında demo məlumat var, real
mağaza və məhsul olmayana qədər paylaşılmır.

### Mənbələr və dürüstlük

- **Sayt ekranları:** canlı saytdan (`https://jeparla.duckdns.org`), 2026-11-18, telefon ölçüsündə:
  ana səhifə, metal qiyməti bloku, "Jeparla yoxlaması", `/sell`, `/verified`. Heç birində
  "Nümunə data" və ya demo məhsul yoxdur. Ana səhifənin boş kateqoriya kartları ("Məhsul yoxdur")
  videoya salınmayıb.
- **Rəqəmlər (video 2):** API-dən (`/api/v1/metal-prices/history?metal=GOLD`, mənbə CBAR),
  tarixlə: 18.11.2026 təmiz qızıl unsiyası 6 435,2055 ₼, qramı 206,8967 ₼, 585 əyar 121,03 ₼;
  17.11.2026 585 əyar 123,87 ₼. Bunlar köhnələcək: **video 2 dərc günü yeni rəqəmlə yenidən
  render olunur** (bölmə 6).
- **Əyar faktları (video 3):** saytın kalkulyator və qiymət səhifəsindəki mətnlə eyni (585 = 58,5%,
  750 = 75%, 925 = 92,5%; 585 = 14K, 750 = 18K).
- **Satıcı və Verified iddiaları (video 4, 5):** `/sell` və `/verified` səhifələrinin mətni ilə eyni
  ("Kataloqda yer almaq pulsuzdur", "Heç bir yoxlama tam zəmanət deyil").
- **Stok video:** Pexels Lisenziyası (`docs/credits.md`): üzük (`ring`), emalatxana (`atelier`),
  vitrin (`vitrine`). Kadrda "Dekorativ stok görüntü (Pexels)" yazılıb: Jeparla-dakı mağaza və ya
  məhsul deyil.
- **AI vizual (video 1):** heyvanların gəlişi və üç model AI ilə yaradılıb (`docs/credits.md`).
  Həmin kadrlarda "AI ilə yaradılmış vizual" yazısı var və paylaşanda platformanın AI etiketi
  açılır (bölmə 5).
- Saxta rəy, izləyici, baxış, mağaza sayı yoxdur. Videoda URL yoxdur (domen hələ müvəqqətidir, #8).

## 2. Ssenarilər (ekrandakı mətn və vaxt)

### Video 1. Jeparla nədir (18 s)

| Vaxt | Kadr | Ekranda |
|---|---|---|
| 0-3,3 s | Hero: pələnglər və pantera gəlir (AI) | Qızıl, gümüş, brilyant. Bir saytda. |
| 3,2-6,7 s | Üç model (AI) | Parıltının hər çaları bir yerdə. |
| 6,5-9,7 s | Telefonda ana səhifə | Zərgərlik mağazaları bir kataloqda. |
| 9,7-12,1 s | Metal qiyməti bloku | Qızılın qram qiyməti hər gün AMB-dən. |
| 12,1-14,3 s | "Jeparla yoxlaması" bölməsi | Mağaza yoxlanılır, sən birbaşa WhatsApp-a yazırsan. |
| 14,3-18 s | Son kadr | Jeparla. Azərbaycanın zərgərlik mağazaları bir yerdə. Mağazalar üçün qeydiyyat açıqdır. |

### Video 2. Qızılın qram qiyməti (22 s)

| Vaxt | Kadr | Ekranda |
|---|---|---|
| 0-4,4 s | Tünd yaşıl fon, böyük rəqəm | 585 əyar qızıl, 1 qram: 121,03 ₼. AMB məzənnəsi, 18.11.2026. Bir gün əvvəl, 17.11.2026: 123,87 ₼. Yalnız metalın dəyəri. |
| 4,4-13 s | 3 addım | AMB hər iş günü dərc edir (6 435,2055 ₼). Qrama çevrilir (÷ 31,1034768 = 206,8967 ₼). Əyara vurulur (× 0,585 = 121,03 ₼). |
| 13-18,4 s | Telefonda saytın metal qiyməti bloku | Jeparla bu hesabı hər səhər özü edir. "Metala bağlı" məhsulun qiyməti də özü yenilənir. |
| 18,4-22 s | Son kadr | Qızıl və gümüşün bugünkü qram qiyməti. |

### Video 3. Əyar (20 s)

| Vaxt | Kadr | Ekranda |
|---|---|---|
| 0-3,5 s | Üzük (stok) | 585 nə deməkdir? |
| 3,5-11,3 s | 3 zolaq dolur | Əyar: 1000 hissədə neçə hissə təmiz metaldır. 585 (14K) 58,5%, 750 (18K) 75%, 925 gümüş 92,5%. |
| 11,3-16,7 s | Tünd yaşıl fon | Almadan əvvəl mağazada yoxla: damğa, çəki, çek. |
| 16,7-20 s | Son kadr | Zərgərliyi əyara, metala və qiymətə görə axtar. Qızıl kalkulyatoru da saytda. |

### Video 4. Satıcılar üçün (22 s)

| Vaxt | Kadr | Ekranda |
|---|---|---|
| 0-3,6 s | Emalatxana (stok) | Zərgərlik mağazan var? |
| 3,6-8,7 s | Telefonda `/sell` | Jeparla kataloqunda yer almaq pulsuzdur. |
| 8,7-14,3 s | "Necə işləyir" addımları | Hesab və mağaza, sənədlər, məhsullar: üç addım. |
| 14,3-16,5 s | Müqayisə cədvəli | "Metala bağlı" qiymət AMB məzənnəsi ilə özü yenilənir. |
| 16,5-18,5 s | Müqayisə cədvəli | Alıcı sənə birbaşa WhatsApp-da yazır. |
| 18,5-22 s | Son kadr | Mağazanı Jeparla-da aç. Öz linkini Instagram bio-na qoy. |

### Video 5. Jeparla Verified (20 s)

| Vaxt | Kadr | Ekranda |
|---|---|---|
| 0-3,5 s | Vitrin (stok) | Jeparla Verified nə deməkdir? |
| 3,5-13 s | 3 addım | Jeparla Verified. Bir nişan, üç ayrı yoxlama: satıcı, sənədlər, fiziki ekspertiza. Nişan satıcı və sənəd yoxlaması ikisi də keçəndə görünür. |
| 13-16,4 s | Telefonda `/verified` | Heç bir yoxlama tam zəmanət deyil. Damğanı, çəkini və çeki mağazada yoxla. |
| 16,4-20 s | Son kadr | Kimin və nəyin yoxlandığını açıq göstəririk. |

## 3. Paylaşım mətnləri

Qayda: emoji yoxdur, mətndə "100% zəmanət", "ən ucuz", "1 nömrəli" yoxdur. Instagram-da
5 hashtag limiti var; TikTok-da 3-5; YouTube-da təsvirin sonunda 3 hashtag (ilk 3-ü başlığın
üstündə görünür). Caption quruluşu (`profile.md` ilə eyni): az, boş sətir, ru. en variantı yalnız
ingilisdilli paylaşım və ya YouTube təsviri üçündür.

### Video 1. Jeparla nədir

**Instagram / TikTok (az)**
```
Jeparla Azərbaycanın zərgərlik mağazalarını bir kataloqda toplayır. Qızıl, gümüş və brilyant zərgərliyi mağaza, kateqoriya, əyar və qiymətə görə axtarırsan, bəyəndiyin məhsul üçün mağazaya birbaşa WhatsApp-da yazırsan. Metal qiymətləri hər gün AMB məzənnəsindən gəlir.

Sayt yenidir: mağazalar üçün qeydiyyat açıqdır. Link bioda.

Videodakı heyvan və model təsvirləri süni intellektlə yaradılıb.
```
**ru**
```
Jeparla собирает ювелирные магазины Азербайджана в одном каталоге. Ищите золото, серебро и бриллианты по магазину, категории, пробе и цене, а понравившемуся магазину пишите напрямую в WhatsApp. Цены на металл каждый день по курсу ЦБА.

Сайт новый: регистрация для магазинов открыта. Ссылка в профиле.

Животные и модели в видео созданы с помощью ИИ.
```
**en**
```
Jeparla brings Azerbaijan's jewelry stores into one catalog. Search gold, silver and diamond jewelry by store, category, fineness and price, then message the store directly on WhatsApp. Metal prices follow the daily CBAR rate.

The site is new: store registration is open. Link in bio.

The animals and models in this video are AI-generated.
```
- Instagram: `#Jeparla #zərgərlik #qızıl #brilyant #Bakı`
- TikTok: `#Jeparla #zərgərlik #qızıl #Azərbaycan`
- YouTube başlıq (40 simvol): `Jeparla: zərgərlik mağazaları bir saytda`
- YouTube təsvir: az mətnin ilk abzası + "Link kanalın səhifəsində." + AI qeydi + `#Jeparla #zərgərlik #Shorts`

### Video 2. Qızılın qram qiyməti

Rəqəm və tarix dərc günü yenilənir (bölmə 6); aşağıdakı mətn 18.11.2026 render-i üçündür.

**az**
```
18.11.2026 tarixinə AMB məzənnəsi ilə 585 əyar qızılın 1 qramı 121,03 manatdır, bir gün əvvəl 123,87 manat idi. Hesab belədir: AMB 1 troy unsiya təmiz qızılın qiymətini dərc edir, onu 31,1034768-ə bölüb qram qiymətini alırıq, sonra əyara (0,585) vururuq.

Bu, yalnız metalın dəyəridir: işçilik, daşlar və mağazanın əlavəsi daxil deyil. Jeparla-da bu hesab hər səhər özü yenilənir. Link bioda.
```
**ru**
```
По курсу ЦБА на 18.11.2026 грамм золота 585 пробы стоит 121,03 маната, днём раньше был 123,87 маната. Расчёт: ЦБА публикует цену тройской унции чистого золота, мы делим её на 31,1034768 и получаем цену грамма, затем умножаем на пробу (0,585).

Это только стоимость металла: работа, камни и наценка магазина не включены. На Jeparla расчёт обновляется каждое утро. Ссылка в профиле.
```
**en**
```
At the CBAR rate of 18.11.2026, one gram of 585 gold is 121.03 AZN; the day before it was 123.87 AZN. CBAR publishes the price of one troy ounce of pure gold; we divide it by 31.1034768 for the gram price and multiply by the fineness (0.585).

This is the metal value only: labour, stones and the store's margin are not included. Jeparla updates it every morning. Link in bio.
```
- Instagram: `#Jeparla #qızılqiyməti #585qızıl #AMB #zərgərlik`
- TikTok: `#qızılqiyməti #585qızıl #Jeparla #Azərbaycan`
- YouTube başlıq (47 simvol): `585 qızılın 1 qramı bu gün neçəyədir? AMB hesabı`
- YouTube təsvir: az mətn + "Link kanalın səhifəsində." + `#qızılqiyməti #Jeparla #Shorts`

### Video 3. Əyar

**az**
```
585 nə deməkdir? Əyar təmiz metalın mində payıdır: 585 əyarlı qızılın 58,5%-i, 750-nin 75%-i, 925 əyarlı gümüşün isə 92,5%-i təmiz metaldır.

Almadan əvvəl məhsulun damğasını, çəkisini və çekini mağazada yoxlayın. Jeparla-da zərgərliyi əyara, metala və qiymətə görə axtarmaq olar; qızıl kalkulyatoru da saytdadır. Link bioda.
```
**ru**
```
Что значит 585? Проба показывает долю чистого металла на тысячу частей: в золоте 585 пробы 58,5% чистого золота, в 750 пробе 75%, в серебре 925 пробы 92,5%.

Перед покупкой проверьте в магазине клеймо, вес и чек. На Jeparla можно искать украшения по пробе, металлу и цене; на сайте есть и калькулятор золота. Ссылка в профиле.
```
**en**
```
What does 585 mean? Fineness is the share of pure metal per thousand parts: 585 gold is 58.5% pure gold, 750 is 75%, and 925 silver is 92.5% pure silver.

Before you buy, check the hallmark, the weight and the receipt in the store. On Jeparla you can search jewelry by fineness, metal and price, and use the gold calculator. Link in bio.
```
- Instagram: `#əyar #585qızıl #zərgərlik #Jeparla #qızıl`
- TikTok: `#əyar #585 #qızıl #Jeparla`
- YouTube başlıq (32 simvol): `585, 750, 925: əyar nə deməkdir?`
- YouTube təsvir: az mətn + "Link kanalın səhifəsində." + `#əyar #qızıl #Shorts`

### Video 4. Satıcılar üçün

**az**
```
Zərgərlik mağazanız var? Jeparla kataloqunda yer almaq pulsuzdur. Üç addım: hesab və mağaza, sənədlər, məhsullar. Məhsulu "metala bağlı" qeyd etsəniz, qiymət AMB-nin gündəlik məzənnəsi ilə avtomatik hesablanır. Alıcı sizə birbaşa WhatsApp-da yazır; satış və ödəniş sizinlə alıcı arasındadır.

Mağazanın öz linki olur, onu Instagram bio-na qoya bilərsiniz. Qeydiyyat: link bioda.
```
**ru**
```
У вас ювелирный магазин? Размещение в каталоге Jeparla бесплатное. Три шага: аккаунт и магазин, документы, изделия. Если отметить изделие как "привязанное к металлу", цена рассчитывается автоматически по ежедневному курсу ЦБА. Покупатель пишет вам напрямую в WhatsApp; продажа и оплата между вами и покупателем.

У магазина своя ссылка, её можно поставить в bio Instagram. Регистрация: ссылка в профиле.
```
**en**
```
Own a jewelry store? A place in the Jeparla catalog is free. Three steps: account and store, documents, products. Mark a product as "metal-linked" and its price is recalculated from the daily CBAR rate. Buyers message you directly on WhatsApp; the sale and payment stay between you and the buyer.

Your store gets its own link for your Instagram bio. Sign up: link in bio.
```
- Instagram: `#zərgər #zərgərlikmağazası #Jeparla #Bakı #biznes`
- TikTok: `#zərgər #zərgərlikmağazası #Jeparla #Azərbaycan`
- YouTube başlıq (42 simvol): `Zərgər mağazası üçün pulsuz onlayn kataloq`
- YouTube təsvir: az mətn + "Qeydiyyat linki kanalın səhifəsində." + `#zərgər #Jeparla #Shorts`

### Video 5. Jeparla Verified

**az**
```
"Jeparla Verified" bir yox, üç ayrı yoxlamadır: satıcı (mağazanın real olması: ad, ünvan, telefon, VÖEN), sənədlər (komanda əl ilə yoxlayır, sənədlər ictimai göstərilmir) və fiziki ekspertiza (müstəqil mütəxəssis; yalnız "Yoxlanılıb" yazılan məhsulda). Nişan satıcı və sənəd yoxlamalarının ikisi də keçəndə görünür.

Heç bir yoxlama tam zəmanət deyil: almadan əvvəl damğanı, çəkini və çeki mağazada yoxlayın. Ətraflı: link bioda.
```
**ru**
```
"Jeparla Verified" это не одна, а три отдельные проверки: продавец (реальность магазина: название, адрес, телефон, VÖEN), документы (команда проверяет вручную, документы не публикуются) и физическая экспертиза (независимый специалист; только у изделий с отметкой "Проверено"). Значок появляется, когда пройдены проверки продавца и документов.

Никакая проверка не является полной гарантией: перед покупкой проверьте в магазине клеймо, вес и чек. Подробнее: ссылка в профиле.
```
**en**
```
"Jeparla Verified" is three separate checks: the seller (the store is real: name, address, phone, tax ID), documents (checked by hand by the team, never shown publicly) and a physical inspection (an independent expert; only on products marked "Checked"). The badge appears once both the seller and document checks pass.

No check is a full guarantee: before you buy, check the hallmark, weight and receipt in the store. More: link in bio.
```
- Instagram: `#Jeparla #zərgərlik #etibar #qızıl #Bakı`
- TikTok: `#Jeparla #zərgərlik #qızıl #Azərbaycan`
- YouTube başlıq (36 simvol): `Jeparla Verified nişanı nə deməkdir?`
- YouTube təsvir: az mətn + "Link kanalın səhifəsində." + `#Jeparla #zərgərlik #Shorts`

## 4. 4 həftəlik plan (həftədə 3 qısa video)

Başlanğıc: hesablar hazır olandan sonrakı ilk bazar ertəsi. Vaxt: iş günləri 19:30-20:30, şənbə
12:00-13:00 (`calendar.md`-dəki fərziyyə, yoxlanılmayıb; 3-cü həftədən Insights-a görə dəyiş).
Eyni video eyni gün üç platformaya: Instagram, TikTok, YouTube. Feed postları və story-lər
`calendar.md` və `launch-grid.md`-dən gəlir; bu cədvəl yalnız qısa videolardır.

| Həftə | Çərşənbə axşamı | Cümə axşamı | Şənbə |
|---|---|---|---|
| 1 | Video 1 (Jeparla nədir), profildə bərkidilir | Video 2 (qiymət, həmin gün render) | Video 3 (əyar) |
| 2 | Video 5 (Verified), bərkidilir | Video 4 (satıcılar), bərkidilir | Video 2 yeni rəqəmlə (həftənin qiyməti) |
| 3 | Reel 1, yalnız real mağaza ekranları ilə yenidən çəkilibsə; yoxdursa Video 3-ün ru variantı (bölmə 7) | Video 2 yeni rəqəmlə | Video 4 TikTok və Shorts-da təkrar deyil: Instagram story-də paylaşılır |
| 4 | Real mağaza qoşulubsa: onun haqqında yeni video (yazılı razılıqla); yoxdursa Video 5-in ru variantı | Video 2 yeni rəqəmlə | Aylıq icmal: ən çox saxlanılan videonun davamı (bölmə 8) |

Story (hər iş günü): səhər saytın metal qiyməti blokunun ekranı (tarix və "AMB" görünsün),
axşam son videonun paylaşımı.

## 5. Hesabların hazırlanması və paylaşım (sahib üçün addım-addım)

Ad hər yerdə eyni: `jeparla` (tutulubsa `profile.md`-dəki ehtiyat variantlar). Bio, görünən ad,
link, profil şəkli və highlight-lar: [`profile.md`](../marketing/profile.md) bölmə 1-6. Qısa xülasə:

- Bio (Instagram, az + ru, `profile.md` D): `Zərgərlik mağazaları bir yerdə / Ювелирные магазины в одном месте. Qızıl, gümüş, brilyant. AMB qiyməti. WhatsApp ilə mağazaya yaz.`
- Highlight-lar: Jeparla nədir, Metal qiyməti, Verified, Satıcılar, Hədiyyə, Sual-cavab, Mağazalar.
  Örtük: tünd yaşıl fon, qızılı lucide ikon, mətnsiz (`profile.md` bölmə 5).
- Profil şəkli: loqo (#50) gələnə qədər tünd yaşıl dairədə qızılı Cormorant "J".

### Instagram
1. Telefonda Instagram tətbiqi, yeni hesab: `jeparla`. Ad: `Jeparla | Zərgərlik mağazaları`.
2. Parametrlər -> Hesab növü -> Professional -> Business, kateqoriya "Shopping & retail".
3. İki faktorlu giriş (2FA) aç. Bərpa kodlarını parol menecerində saxla.
4. Bio və link (sayt + `utm_source=instagram&utm_medium=social&utm_campaign=bio`).
5. Paylaşım: + -> Reel -> `-ig.mp4` seç. Musiqi əlavə etmə və ya yalnız Instagram-ın öz kitabxanasından
   (business hesab üçün kommersiya səsləri). Örtük: "Edit cover" -> `docs/social/covers/` faylı
   (və ya videodan kadr). Caption bölmə 3-dən.
6. Video 1 üçün: "Advanced settings" -> "AI label" ("Add AI info") aç.
7. Paylaşmazdan əvvəl ön baxışda yoxla: son kadrdakı "Link bioda" düymələrin altında qalmır.

### TikTok
1. TikTok tətbiqi, hesab `jeparla`; Profil -> Settings -> Account -> "Switch to Business Account".
2. 2FA aç. Bio (`profile.md` A və ya D), sayt linki (business hesabda link sahəsi var).
3. Paylaşım: + -> Upload -> `-tt.mp4`. Səs: yoxdur və ya yalnız "Commercial Music Library".
4. Caption və hashtag bölmə 3-dən. Örtük: "Select cover" -> uyğun kadr.
5. Video 1 üçün: "More options" -> "AI-generated content" aç (real görünən AI təsviri üçün məcburidir).

### YouTube
1. Google hesabı ilə youtube.com -> "Create a channel"; ad `Jeparla`, handle `@jeparla`.
2. Kanalı fərdiləşdir: təsvir (bio A və ya C), "Links" bölməsinə sayt linki
   (`utm_source=youtube`). Shorts təsvirindəki linklər kliklənmir, ona görə link kanalda olmalıdır.
3. Telefonla doğrulama (YouTube Studio -> Settings -> Channel -> Feature eligibility).
4. Paylaşım: YouTube Studio -> Create -> Upload -> `-yt.mp4` (9:16, 60 s-dən qısa: avtomatik Short).
   Başlıq və təsvir bölmə 3-dən. "Altered content" sualı: Video 1 üçün **Yes**, digərləri **No**.
   Uşaqlar üçün deyil: "No, it's not made for kids". Musiqi yoxdur (və ya YouTube Audio Library).
5. Örtük: Shorts-da kadr tətbiqdə seçilir (mobil YouTube -> Short -> "Edit thumbnail").

Hər paylaşımdan sonra #282-də həmin bəndi işarələ (tarix və link).

## 6. Video 2-ni yeni qiymətlə render etmək

1. Rəqəmləri API-dən götür: `https://api.jeparla.duckdns.org/api/v1/metal-prices/history?metal=GOLD&days=2`.
2. `video/src/social/shorts/Short2MetalPrice.tsx`-də `PRICES`-i yenilə: `today.date`, `ounce`
   (`pricePerOunce`), `gram` (`pricePerGram`), `g585` (`pricePerGram × 0,585`, qəpiyə yuvarlaq);
   `yesterday` əvvəlki günün eyni hesabı. Həftəsonu AMB dərc etmir: tarix son dərc olunan gündür.
3. `cd video` -> `npx remotion render Short2MetalPrice out/social/jeparla-02-qiymet-ig.mp4 --codec=h264 --concurrency=2 --props=<ig.json>`
   (`{"platform":"ig"}`, sonra `yt`, `tt`).
4. Caption-dakı tarix və rəqəmləri də eyni dəyərlərə dəyiş.

Mənbələrin yenilənməsi (ekranlar və stok kliplər): `node video/scripts/social-assets.cjs`
(`frontend`-də `npm ci` lazımdır). Skript "Nümunə data" görsə xəbərdarlıq verir.

## 7. Səsləndirmə (istəyə bağlı)

Videolar səssiz də başa düşülür (bütün məlumat ekrandadır). Səs istənəndə: aşağıdakı mətnlər
TTS üçün hazırdır (rəqəm və simvol yoxdur), Google AI Studio -> Generate speech, səs **Sulafat**
(qadın; kişi: Charon), stil 1 Aysel (səmimi bələdçi), temp ≈ 1,9 söz/s. Səs gələndə səhnə
vaxtları səsə uyğunlaşdırılır (`voice` prop-u Reel 1-dəki kimi əlavə olunur). AI səs
istifadə olunsa, caption-a əlavə: "Səs süni intellektlə yaradılıb." və platformanın AI etiketi açılır.
Sahibin öz səsi daha yaxşıdır: eyni mətni oxuyub göndərmək kifayətdir.

AI Studio-ya yapışdırılan blok (hər video üçün mətn dəyişir):
```
Azerbaijani with a native Baku accent (not Turkish). Warm, confident, friendly explainer with a slight smile. Brisk but clear pace, about 110–115 words per minute. Short pause after commas, clear pause after each sentence. Yes/no questions rise at the end; wh-questions stress the question word. Short commands are firm and falling:
<aşağıdakı mətnlərdən biri>
```

| # | Mətn (TTS üçün) | Söz | Təxmini |
|---|---|---|---|
| 1 | Qızıl, gümüş, brilyant. Hamısı bir saytda. Jeparla zərgərlik mağazalarını bir kataloqda toplayır. Qızılın qram qiyməti hər gün Mərkəzi Bankdan gəlir. Bəyəndiyin məhsul üçün mağazaya birbaşa Vatsapda yaz. Linki profildə tap. | 30 | 16 s |
| 2 | Beş yüz səksən beş əyar qızılın bir qramı, on səkkiz noyabrda, yüz iyirmi bir manat üç qəpikdir. Dünən yüz iyirmi üç manat səksən yeddi qəpik idi. Mərkəzi Bank unsiyanın qiymətini verir, onu qrama çeviririk və əyara vururuq. Jeparla bunu hər səhər özü edir. Linki profildə tap. | 45 | 23 s |
| 3 | Beş yüz səksən beş nə deməkdir? Əyar, min hissədə neçə hissənin təmiz metal olduğunu göstərir. Beş yüz səksən beş, əlli səkkiz tam onda beş faiz qızıldır. Yeddi yüz əlli, yetmiş beş faiz. Almadan əvvəl damğanı, çəkini və çeki yoxla. Linki profildə tap. | 40 | 21 s |
| 4 | Zərgərlik mağazan var? Jeparla kataloqunda yer almaq pulsuzdur. Üç addım var. Hesab və mağaza, sənədlər, məhsullar. Metala bağlı qiymət Mərkəzi Bankın məzənnəsi ilə özü yenilənir. Alıcı sənə birbaşa Vatsapda yazır. Linki profildə tap. | 35 | 18 s |
| 5 | Jeparla Verifayd nə deməkdir? Bu, üç ayrı yoxlamadır. Satıcı, sənədlər və fiziki ekspertiza. Nişan satıcı və sənəd yoxlaması keçəndə görünür. Amma heç bir yoxlama tam zəmanət deyil. Damğanı, çəkini və çeki mağazada yoxla. | 36 | 19 s |

Dəyişikliklər: WhatsApp -> Vatsap, Verified -> Verifayd, AMB -> Mərkəzi Bank (səsdə; ekranda AMB qalır),
"Link bioda" -> "Linki profildə tap" (üç platformada eyni). Video 2-nin mətni 22 s-dən 1 s uzundur:
lazım olsa "Dünən ... idi." cümləsini at. Gemini pulsuz planında göndərilən mətn Google tərəfindən
istifadə oluna bilər; kommersiya istifadəsi şərtlərdə qadağan deyil, səsdə görünməz SynthID nişanı var.

## 8. Satıcılara mesaj şablonları (qısa)

Tam variantlar (follow-up, "yox" cavabı, qeydiyyatdan sonra) [`seller-outreach.md`](../marketing/seller-outreach.md)-dədir.
Qaydalar: sahib öz hesabından, əl ilə, gündə ən çox 10 yeni mesaj; WhatsApp-a yalnız nömrəsini
"əlaqə/sifariş üçün" açıq paylaşan mağazaya, iş saatlarında; bir follow-up, sonra yazılmır.
Video 4-ün linkini mesaja əlavə etmək olar.

**Instagram DM (az)**
```
Salam, [mağaza adı]. Mən Jeparla-dan yazıram. Jeparla Azərbaycanın zərgərlik mağazalarını bir saytda toplayır. Kataloqda yer almaq pulsuzdur: məhsulun metalı, əyarı və çəkisi yazılır, istəsəniz qiymət AMB-nin gündəlik metal məzənnəsi ilə avtomatik yenilənir. Alıcı sizə birbaşa WhatsApp-da yazır. 20 saniyəlik izah videosu: [link]. Maraqlıdırsa, qeydiyyatda kömək edə bilərəm.
```
**WhatsApp (az)**
```
Salam. [Mağaza adı] ilə əlaqə üçün nömrənizi [harada gördüm] gördüm. Mən Jeparla-dan yazıram: zərgərlik mağazaları üçün pulsuz onlayn kataloq. Məhsulların əyarı, çəkisi və qiyməti görünür, "metala bağlı" qiymət AMB məzənnəsi ilə özü yenilənir, alıcı sizə birbaşa yazır. Qısa video: [link]. Maraqlı deyilsə, bir də yazmayacağam.
```
**Instagram DM / WhatsApp (ru)**
```
Здравствуйте, [название магазина]. Пишу от Jeparla: это сайт, который собирает ювелирные магазины Азербайджана в одном каталоге. Размещение бесплатное: у изделия указаны металл, проба и вес, а цена по желанию обновляется по ежедневному курсу металлов ЦБА. Покупатель пишет вам напрямую в WhatsApp. Короткое видео: [ссылка]. Если интересно, помогу с регистрацией.
```

## 9. Paylaşımdan sonra

- 48 saatdan sonra hər platformada baxış, izləmə müddəti (retention), saxlama və paylaşım sayını
  #282-yə yaz (yalnız platformanın göstərdiyi real rəqəm).
- İzləmə ilk 3 saniyədə düşürsə: növbəti videoda hook kadrını dəyiş (sual daha qısa, rəqəm daha tez).
- YouTube skill-ləri (`yt-script`, `yt-package`, `yt-seo`, `yt-shorts`, `yt-plan`, `yt-retention`) bu
  kompüterdə quraşdırılmayıb; başlıq və təsvirlər `social` skill-i ilə yazılıb. Quraşdırma: #146.
