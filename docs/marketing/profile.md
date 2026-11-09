# Jeparla: Instagram və TikTok profili

Issue: #101 (launch), asılılıqlar: #50 (loqo), #100 (mağazanın paylaşıla bilən linki), #47 (v1 qəbul).
Qayda: emoji yoxdur, saxta rəqəm yoxdur, ad yalnız "Jeparla".

## 1. Hesab adı (handle) variantları

Instagram qaydası: hərf, rəqəm, nöqtə, alt xətt, maks. 30 simvol, nöqtə ilə bitmir.
TikTok qaydası: hərf, rəqəm, nöqtə, alt xətt, maks. 24 simvol, nöqtə ilə bitmir.
Hər iki platformada eyni ad olsun (axtarışda və şifahi deyəndə rahat olsun).

| # | Variant | Uyğunluq (format) | Qeyd |
|---|---|---|---|
| 1 | `jeparla` | IG və TikTok qaydasına uyğun | Ən yaxşısı: qısa, brendlə eyni. Tutulma ehtimalı aşağıdır, amma yoxlanılmayıb |
| 2 | `jeparla.az` | uyğun | Domenlə eyni (`jeparla.az`, domen hələ alınmayıbsa PLAN.md 3a-ya bax). Yerli brend kimi oxunur |
| 3 | `jeparla_az` | uyğun | 1 və 2 tutulubsa |
| 4 | `jeparla.official` | uyğun (16 simvol, TikTok-a sığır) | Uzundur; yalnız ehtiyat |
| 5 | `jeparlaaz` | uyğun | Nöqtəsiz variant; "aa" oxunuşu zəifdir, son ehtiyat |

**Mövcudluğu sahib özü yoxlamalıdır.** Bu sənəd heç bir adın boş olduğunu iddia etmir
(PLAN.md 5.15: "yoxlanılmadan boşdur yazma"). Yoxlama siyahısı:
1. instagram.com/<ad> və tiktok.com/@<ad> səhifələrini aç (giriş etmədən və giriş edib).
2. Hesab yaradanda tətbiq adı qəbul edirsə, dərhal hər iki platformada götür, eyni gün.
3. Facebook səhifəsi, Threads (Instagram ilə avtomatik), YouTube handle-ı da eyni adla rezerv et
   (paylaşmaq üçün deyil, başqası götürməsin deyə).
4. Nəticəni #50-dəki "ticarət nişanı və domen yoxlama siyahısı"na yaz.

## 2. Görünən ad (display name)

Instagram ad sahəsi axtarışda indekslənir, ona görə adla yanaşı açar söz:

- Instagram: `Jeparla | Zərgərlik mağazaları` (30 simvol; Instagram ad limiti 30-dur, sahib daxil edəndə yoxlasın)
- TikTok: `Jeparla | Zərgərlik` (TikTok adı qısa göstərir)
- Rus dilli axtarış üçün ikinci açar söz bio-dadır, adda deyil (ad qısa qalsın).

## 3. Bio (maks. 150 simvol, sayılıb)

Instagram-da bir bio var. Tövsiyə: **az/ru qarışıq variant (D)** əsas, çünki auditoriya iki dillidir.
Digər variantlar TikTok, Facebook, kampaniya və ya sonradan ayrıca hesab üçündür.

**A. az (135 simvol)**
```
Azərbaycanın zərgərlik mağazaları bir yerdə. Qızıl, gümüş, brilyant: yoxlanılmış məlumat, AMB metal qiyməti, mağazaya birbaşa WhatsApp.
```

**B. ru (141 simvol)**
```
Ювелирные магазины Азербайджана в одном месте. Золото, серебро, бриллианты: проверенные данные, курс металла ЦБА, WhatsApp напрямую магазину.
```

**C. en (138 simvol)**
```
Jewelry stores of Azerbaijan in one place. Gold, silver, diamonds: verified details, daily CBAR metal rate, message the store on WhatsApp.
```

**D. az + ru, Instagram üçün tövsiyə (130 simvol)**
```
Zərgərlik mağazaları bir yerdə / Ювелирные магазины в одном месте. Qızıl, gümüş, brilyant. AMB qiyməti. WhatsApp ilə mağazaya yaz.
```

Bio-da yazılmayanlar: "ən ucuz", "100% zəmanət", "1 nömrəli", izləyici sayı, "minlərlə məhsul"
(real rəqəm olmayana qədər). "Yoxlanılmış məlumat" ifadəsi yalnız Verified prosesi (PLAN.md 5.9)
saytda işləyəndən sonra işlədilir; o vaxta qədər A/B/C-də "yoxlanılmış məlumat" yerinə
"metal, əyar, çəki" yazılır.

## 4. Link strategiyası

1. **Başlanğıc:** bio-da bir link, saytın ana səhifəsi: `https://jeparla.az/az?utm_source=instagram&utm_medium=social&utm_campaign=bio`
   (TikTok üçün `utm_source=tiktok`). Link aggregator (Linktree və s.) lazım deyil: sayt özü
   "vitrin"dir, əlavə keçid sürəti və etibarı azaldır.
2. **Instagram-ın çoxlu link funksiyası** (bio-da 5 linkə qədər) varsa, ikinci link:
   "Satıcı ol" səhifəsi (`/az/sell` və ya sonda hansı marşrut olsa), `utm_campaign=bio_seller`.
3. **Kampaniya linkləri:** hər kampaniya üçün ayrıca UTM, məsələn
   `utm_campaign=launch_w1`, `utm_campaign=metal_price`, `utm_campaign=gift_newyear`.
   UTM-lər bir cədvəldə saxlanılır (ad, tarix, link, harada istifadə olunub).
4. **Story link stikeri:** hər story-də link eyni UTM sxemi ilə, `utm_medium=story`.
5. **Satıcıların linki (#100):** satıcı öz bio-suna `jeparla.az/<mağaza-slug>?ref=instagram`
   qoyur. Bu, Jeparla-nın link strategiyasının ikinci yarısıdır: hər satıcının bio-su Jeparla-ya
   trafik gətirir. Satıcı kabinetindəki statistika (`ref` parametri) real rəqəm verir.
6. Analitika: saytda yalnız şəxsi məlumatsız ölçmə (PLAN.md), heç bir "baxış sayı" uydurulmur.

## 5. Highlight-lar (Story Highlights)

Ad 15 simvoldan qısa (profildə kəsilməsin). Hər highlight-ın adı az dilindədir; içindəki
story-lər az + ru mətnlidir.

| Sıra | Ad | Məzmun | Lucide ikon |
|---|---|---|---|
| 1 | Jeparla nədir | 3 addım: axtar, yoxla, WhatsApp ilə yaz | `Gem` |
| 2 | Metal qiyməti | Günün AMB qram qiyməti (yalnız real rəqəm, tarix, mənbə), formul izahı | `TrendingUp` |
| 3 | Verified | 3 ayrı status: satıcı, sənədlər, fiziki ekspertiza | `BadgeCheck` |
| 4 | Satıcılar | Pulsuz kataloq, paylaşma linki, qeydiyyat addımları | `Store` |
| 5 | Hədiyyə | Münasibətə görə seçim, filtrlər | `Gift` |
| 6 | Sual-cavab | Tez-tez verilən suallar | `MessageCircleQuestion` |
| 7 | Mağazalar | Yeni qoşulan real mağazalar (yazılı razılıqla) | `MapPin` |

### Örtük (cover) konsepti

- Ölçü: 1080x1920 story kimi hazırlanır, ikon mərkəzdə, dairəvi kəsimə görə kənarda 25% boşluq.
- Fon: tünd yaşıl `#16251F` (scene green), ikon qızılı `#C5A15A`, xətt qalınlığı 1.5 (lucide `strokeWidth`),
  ikon dairənin diametrinin ~40%-i. Qızılı tünd yaşıl üzərində yüksək kontrastdır.
- Alternativ (açıq tema hissi): krem `#F7F3EA` fon + tünd yaşıl `#16251F` ikon. Hamısı bir
  variantla, qarışdırılmır.
- Qara fon, qradiyent, parıltı effekti yoxdur. Mətn örtükdə yoxdur (ad onsuz da altda yazılır).
- Hazırlama: lucide ikonunun SVG-si (lucide ISC lisenziyalıdır), Figma və ya kiçik bir
  Remotion `Still` kompozisiyası (`video/`-də `HighlightCover` still, ikon adı prop kimi);
  7 PNG bir dəfəyə render olunur.

## 6. Profil şəkli

**Asılılıq: #50 (loqo).** Loqo hazır olana qədər müvəqqəti, sonra dəyişdirilir.

- Profil şəkli kiçik dairədə (110 px, story halqasında daha kiçik) görünür: tam wordmark
  oxunmaz. Monoqram lazımdır.
- Müvəqqəti konsept: tünd yaşıl `#16251F` dairə, mərkəzdə Cormorant şriftində böyük "J",
  qızılı `#C5A15A`; nazik qızılı daxili halqa yoxdur (kiçikdə səs-küy olur).
- Pələng/pantera və ya model şəkli profil şəkli olmur: kiçikdə tanınmır, AI mənşəli
  vizualdır və brendin işarəsi deyil.
- Yükləmədən əvvəl 40 px-ə kiçildib oxunaqlığı yoxla (#50-nin "16 px-də oxunur" meyarı).
- Loqo hazır olanda: Instagram, TikTok, Facebook, WhatsApp Business eyni gün dəyişdirilir.

## 7. Hesab növü və parametrlər

- Instagram: **Business** (Professional) hesab: Insights, əlaqə düymələri, kateqoriya
  "Shopping & retail" və ya "Website". Əlaqə: e-poçt; WhatsApp düyməsi Jeparla-nın öz
  dəstək nömrəsi olacaqsa əlavə et (mağazaların nömrəsi deyil).
- TikTok: Business hesab (Commercial Music Library yalnız buradadır; musiqiyə bax `video-briefs.md`).
- Hər iki hesabda iki faktorlu giriş (2FA) açıq; şifrə və bərpa kodları menecerdə, repoda yox.
- AI etiketi: hero səhnəsindən (AI ilə yaradılmış heyvan və modellər) olan hər dərcdə
  platformanın "AI ilə yaradılıb" (Instagram "AI info", TikTok "AI-generated") açarı aktiv edilir.
  Bu, saytdakı hero qərarından (credits.md) fərqlidir: sosial şəbəkədə real görünən insan
  təsviri üçün platformaların öz qaydası var (TikTok-da məcburidir). Bax `strategy.md`, bölmə 6.

## Mənbələr

- Instagram 5 hashtag limiti (dekabr 2025): https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/
- Profil şəbəkəsi 3:4 (1080x1440): https://buffer.com/library/instagram-image-size , https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/
- Handle simvol qaydaları: platformaların qeydiyyat formu (sahib yoxlamalıdır; yoxlanılmayıb).
