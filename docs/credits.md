# Şəkil və video mənbələri

Saytdakı üçüncü tərəf və yaradılmış vizualların mənbəyi. Yeni şəkil və ya video əlavə edəndə
buraya yazın.

## Ana səhifə hero (`frontend/public/hero/`)

Səhnə: ağ pələng, qızılı pələng və qara bəbir (pantera) gəlib mərkəzdə dayanır, qızılı işıq keçir və onlar gümüş,
qızıl və brilyant zərgərlik taxmış üç modelə çevrilir.

- **Gəliş (1-ci akt):** AI video (Higgsfield, Kling 2.5 Turbo, 720p, 5 san., 2026-11-08):
  `video/source/walk.mp4` (başlanğıc kadr `video/source/walk-start.jpg`). Hər kadrın fonu lokal olaraq
  silinib (`@imgly/background-removal-node`), kadrlar `video/public/walk/NNN.webp`-dir və Remotion-da
  sayt kremi üzərində oynayır. Pələnglər (2-ci akt) klipin son kadrından kəsilib (`video/public/tiger-N.png`).
- **Modellər:** AI ilə yaradılıb (Vheer, "Text to Image", 2026-11-08), hər biri ayrıca dizdən yuxarı
  portret, zinət əşyası önə çəkilmiş pozada (mənbələr `video/source/models/m0..2.jpg`);
  fonları lokal olaraq silinib, `video/public/model-N.png`. Köhnə mənbələr (`tigers.jpg`, `models.jpg`)
  arxiv kimi `video/source/`-da qalır.
- **Kompozisiya:** Remotion layihəsi (`video/`). `cd video && sh scripts/export.sh`
  `enter-*.mp4` (1-ci akt) və `tf-*/NN.jpg` (2-ci akt, scroll ilə) fayllarını yaradır.
- **"Jeparla" yazısı:** pələnglərin arxasında və modellərin üstündə saytın əl yazısı loqosu
  (Great Vibes konturları, `docs/brand/`) qalın xətlə, əl ilə yazılırmış kimi çıxır (sahibin istəyi, 2026-11-22).
- **İşarələmə:** sahibin qərarı ilə (2026-11-05) hero-da "AI" yazısı göstərilmir. Bu, kampaniya
  vizualıdır, məhsul şəkli deyil: modellərin taxdığı zərgərlik kataloqdakı konkret məhsulu
  təsvir etmir. Məhsul şəkilləri üçün AI işarəsi qaydası (`CLAUDE.md`) qüvvədədir.
- Modellər real insan deyil; sahibin öz çəkilişi (model razılığı ilə) gələndə dəyişdirilə bilər.

## Stok video və interyer şəkilləri (`frontend/public/media/`)

Hamısı [Pexels Lisenziyası](https://www.pexels.com/license/) ilə pulsuzdur (2026-11-16 oxunub):
kommersiya saytında istifadə və redaktə icazəlidir, istinad tələb olunmur. Qadağandır: görünən şəxsləri
pis işıqda göstərmək, şəxs və ya brendin bizi dəstəklədiyini iddia etmək, faylı dəyişmədən satmaq
və ya başqa stok saytında yaymaq, əmtəə nişanı kimi istifadə. Fayllar yalnız pexels.com və onun
CDN-indən (`videos.pexels.com`, `images.pexels.com`) endirilib.

Dürüstlük: bunlar dekorativ görüntüdür. Heç biri Jeparla-dakı mağazanın və ya məhsulun özü deyil,
mağaza adı ilə yanaşı göstərilmir; altında "Dekorativ stok görüntü" qeydi var. Kadrlarda üz, loqo və
yazı yoxdur.

| Fayl | Harada | Müəllif | Mənbə |
|---|---|---|---|
| `atelier/*` (8 san. dövrə, səssiz) | Ana səhifə: "Mağazanız var?" tam enli video zolağı | Tima Miroshnichenko | https://www.pexels.com/video/close-up-shot-of-a-person-making-jewelry-6262806/ |
| `ring/*` (8 san. dövrə, səssiz) | Ana səhifə: "Hər daşa yaxından baxın" tam enli video zolağı (yoxlamalar) | Tima Miroshnichenko | https://www.pexels.com/video/video-of-a-peron-holding-a-ring-6263177/ |
| `../demo/ring-video.mp4` (`ring/mobile.mp4` faylının surəti) | Nümunə məhsul 2-nin qısa videosu (#117): məhsul səhifəsinin qalereyası, yalnız alıcı oynat düyməsini basanda yüklənir | Tima Miroshnichenko | https://www.pexels.com/video/video-of-a-peron-holding-a-ring-6263177/ |
| `editorial/hands-*.avif` (videodan kadr) | Ana səhifə: yeni məhsullar bölməsinin yanında, əldə üzüklər və bilərziklər | RDNE Stock project | https://www.pexels.com/video/a-hands-full-of-jewelries-8183385/ |
| `showcase/*` (8 san. dövrə, səssiz) | Ana səhifə: kateqoriyalar bölməsinin arxa fonu | Lara Jameson | https://www.pexels.com/video/jewelries-on-the-display-window-8849053/ |
| `vitrine/*` (8 san. dövrə, səssiz, yavaşladılmış) | Ana səhifə: mağazalar banneri; `/stores` başlığı | Sururi Ballıdağ | https://www.pexels.com/video/elegant-display-of-gold-jewelry-in-store-36353836/ |
| `showroom/wide.avif`, `showroom/phone.avif` (poster) | Ana səhifə: mağazalar banneri, video başlamazdan əvvəl və reduced motion-da | Rana Matloob Hussain | https://www.pexels.com/photo/luxurious-modern-jewelry-store-interior-design-33257665/ |
| `showroom/counter*.avif` (poster) | `/stores` başlığı, video başlamazdan əvvəl və reduced motion-da | Rana Matloob Hussain | https://www.pexels.com/photo/luxurious-jewelry-store-interior-with-elegant-display-33257668/ |

İşlənmə: videolardan qısa parça kəsilib, irəli və geri birləşdirilib (8 san. tikişsiz dövrə), səs
yolu silinib, telefon və masaüstü üçün ayrıca kəsilib; H.264 MP4 və AV1 WebM (Remotion-un ffmpeg-i),
AVIF poster. `vitrine` klipi 50 fps-dən 25 fps-ə yavaşladılıb (2 san. -> 4 san.). İnteryer şəkilləri
(dizayn vizualizasiyası kimi görünür) yalnız poster kimi istifadə olunur; `counter*` kəsimi
pəncərədəki küçə yazılarını və ekranı kənarda qoyur. `vitrine` kadrlarında oxunan yazı yoxdur.
`editorial/hands-*` şəkli videodan bir kadr kimi götürülüb, portret formatda kəsilib və AVIF-ə
çevrilib (iki en ölçüsü). `showcase` klipində stenddəki kiçik etiket oxunmur.

2026-11-21: `ring`, `showcase` və `atelier` klipləri 4K orijinaldan yenidən kəsilib (masaüstü 1600x900,
16:9; telefon 720x900, 4:5), çünki bu videolar indi tam ekran arxa fon kimi göstərilir və əvvəlki kiçik
kəsimlər (720x900, 640x800) bulanıq görünürdü.

## Köhnə hero (silinib, 2026-11-08)

Unsplash fotoları (Tommaso Ubezio, Wildlife by Irina, Lambert Huang) artıq istifadə olunmur.

## Demo kataloq şəkilləri (`frontend/public/demo/`)

Backend gələnə qədər nümunə məhsulların (`src/lib/api/mock/fixtures.ts`) şəkilləridir. Hamısı
[Unsplash Lisenziyası](https://unsplash.com/license) ilə pulsuzdur (Unsplash+ deyil), 800x1000
kəsilib (2026-11-09). Real fotodur, AI deyil, amma kataloqdakı nümunə məhsulun özünü göstərmir:
məhsul təsviri "nümunə məhsul, real deyil" deyir. Real mağaza şəkilləri gələndə silinəcək.

Studiya görünüşü (#119, 2026-11-18): 16 foto Jeparla-nın öz lokal pipeline-ı ilə emal olunub
(`./gradlew studioLook`, IS-Net fon silmə modeli, Apache-2.0, `docs/ai-providers.md`): fon silinib, əşya krem fonda
mərkəzə qoyulub, yumşaq kölgə, 800x1000. Generativ AI və pullu xidmət işlədilməyib, əşyanın forması, rəngi və
daşları yenidən çəkilməyib, ona görə "AI ilə yaradılıb" nişanı yoxdur. Unsplash Lisenziyası dəyişdirməyə icazə
verir; müəlliflər aşağıdakı kimi qalır.

| Fayl | Müəllif | Mənbə |
|---|---|---|
| `ring-gold-1.jpg` | JESUS ECA | https://unsplash.com/photos/wewzzx11ShI |
| `ring-silver-1.jpg` | César O'neill | https://unsplash.com/photos/BdavhWCihfw |
| `ring-silver-3.jpg` | Salvador Escalante | https://unsplash.com/photos/bj60QB8xBl8 |
| `earrings-gold-1.jpg` | Diego Castañeda | https://unsplash.com/photos/q4uRpPcvF88 |
| `earrings-gold-2.jpg` | Oscar Ramirez | https://unsplash.com/photos/77vl4dH6KKQ |
| `earrings-gold-3.jpg` | JESUS ECA | https://unsplash.com/photos/DRbPrVTyTyA |
| `earrings-silver-1.jpg` | César O'neill | https://unsplash.com/photos/uvK9BqN_pvY |
| `necklace-gold-1.jpg` | Paul Lora | https://unsplash.com/photos/HiGJ04wtX4w |
| `necklace-gold-2.jpg` | Andrey Ilkevich | https://unsplash.com/photos/0ziihuUXMcs |
| `necklace-gold-3.jpg` | Andrey Ilkevich | https://unsplash.com/photos/L-rNkUK2SZU |
| `necklace-silver-1.jpg` | Sabrianna | https://unsplash.com/photos/u1Hv_erOQH0 |
| `necklace-silver-2.jpg` | Hanna Balan | https://unsplash.com/photos/diLY227UOvg |
| `necklace-silver-3.jpg` | Chiara Monti | https://unsplash.com/photos/rnxMMjscvdc |
| `bracelet-gold-2.jpg` | Diego Castañeda | https://unsplash.com/photos/Jno26Xf1-WI |
| `bracelet-gold-3.jpg` | Diego Castañeda | https://unsplash.com/photos/y7xmVsIXNUI |
| `bracelet-silver-1.jpg` | César O'neill | https://unsplash.com/photos/St60rvtQJpM |

Admin şəkilləri, "dizayna uyğunlaşdır" (2026-11-24): demo admin 50 şəkli `/admin/photos` səhifəsindən keçirib,
4-nü götürüb (qalanlarının kəsimi təmiz çıxmadı və ya məhsul növünə uyğun deyil, aşağıda)
(`frontend/scripts/fit-demo-photos.mjs`, yerli sample data, real hesab yox). Fon brauzerdə açıq U2-Net-p
modeli ilə silinib (Apache-2.0, `frontend/public/models/u2netp.onnx`, aşağıda), əşya krem fonda kartın 4:5 kadrına
qoyulub, yumşaq yaşıl tonlu kölgə, 800x1000 WebP. Generativ AI yoxdur, əşya yenidən çəkilməyib, ona görə "AI ilə
yaradılıb" nişanı yoxdur (redaktə olunmuş foto, yaradılmış deyil; #119 ilə eyni qərar). Hamısı
[Unsplash Lisenziyası](https://unsplash.com/license) ilə pulsuzdur (Unsplash+ deyil; 2026-11-24 səhifədə yoxlanılıb),
`unsplash.com/photos/<id>/download` düyməsi ilə endirilib. Şəkillərdə loqo və oxunan brend yazısı yoxdur.

| Fayl | Müəllif | Mənbə | Harada |
|---|---|---|---|
| `earrings-gold-4.webp` | Ian Talmacs | https://unsplash.com/photos/PARIuwa_Ssc | qızıl sırğalar |
| `earrings-gold-5.webp` | Till Kraus | https://unsplash.com/photos/0F7UG5-sHIg | qızıl sırğalar |
| `earrings-gold-6.webp` | MAYANK GEHLOT | https://unsplash.com/photos/lsxBmX8Hmwc | qızıl sırğalar, qızıl uşaq sırğaları |
| `bracelet-gold-6.webp` | Khizar Rathore | https://unsplash.com/photos/AoZrJQ80KCc | qızıl qolbaqlar |

Hər şəkil yalnız öz növündə və metalında göstərilir (`FITTED_PHOTOS`, `src/lib/api/mock/fixtures.ts`): toy üzüyü
kartında soliter, qolbaq kartında dəst olmur. Təmiz kəsim tapılmayan kateqoriyalar köhnə `.jpg` şəkillərində qalıb:
nişan, toy və kişi üzükləri, zəncirlər (qızıl, gümüş), asqılar, gümüş qolbaqlar, dəstlər, broşlar, gümüş uşaq sırğaları.

Rədd edilənlər (repoya düşməyib; 2026-11-24, sahibin "yalnız təmiz kəsim" qaydası ilə, 1:1 böyüdüb yoxlanılıb).
Hamısı Unsplash Lisenziyası ilə pulsuzdur, mənbə `https://unsplash.com/photos/<id>`:

- Qalan fon: `-_12be3InkQ`, `H8c0XcyN_PA`, `b2phn4twtZ4` (broşların arasında qara parça), `4DJC-MeTLxE` (gümüş
  halqanın içi qara), `wOfSP_0MO_g` (üzüyün içi qara), `O7YCeE_65TE`, `mkqraXkMPSE` (içində fon), `oO0JAOJhquk`
  (jurnal), `hNo86T4HMZM` (halqanın içində parça), `AKbE5xlIZXA` (tünd kənar), `ZArlyfDRcw0` (əlcək),
  `DRbPrVTyTyA` (sırğanın yanında boz ləkə), `SAGRtyL5L_Y` (büst qalıb), `Q_bHwNAueHA` (ürəyin altında qara kölgə).
- Əks (refleksiya) şəkilə qoşulub: `wTIZBpzHcmU`, `R_pIyT1KF80`, `QbJ1Y359tIk`, `W08Y9Td9IeM`.
- Rəng sızması və ya solğun kənar: `mgHfJ5q02Jw` (bənövşəyi), `oWFPDjxuyUM` (çəhrayı), `yrGQYb9heTY` (göy),
  `JRmm5RIg1xE` (zəncirin ucu solur), `1BBlGVr2_Yw` (kiçik və solğun), `YmFdZ8NkS2A` (bulanıq, ləkə).
- Yanlış kəsim: `ILhzd7TbcWs` (yalnız daş), `GkTLP8m-qjI` (yalnız asqı).
- Məhsul növünə və ya metala uyğun deyil: `K0rQ59zmomw`, `wf06v3VPr4A` (qızılı broş, broş məhsulları gümüşdür),
  `RuCUa6CtfFE` (ağ metal dəst, dəstlər qızıldır), `RIqNLZ_h2X8` (gümüş sırğa, sırğa məhsulları qızıldır),
  `B9Jo-V2kpOg` (ajur halqa, sadə toy halqası deyil), `jC_S0BH_HkQ` (qızılı halqalar, gümüş toy üzüyü üçün),
  `tUCYTL59cA0`, `zZLhoEwGCeM`, `Z4BJfx59yqY` (nişan üzüyü deyil və ya içində oxunan yazı),
  `pWVNg9B9NLI` (zəncir kadrın kənarına çıxır, `docs/DESIGN.md`-in "zəncir kənara toxunmur" qaydası).
- Clean-room: `qUgVvJHS9Dc` (içindəki yazı məşhur filmdəki üzüyün yazısının surətidir), `sVlV2lPNrDU` (tanınmış
  ustanın üslubunda antik asqı), `10eeEq7OxSI` (tanınmış brendin ilan qolbağına bənzəyir, emal edilmədi).

Əvvəlki rədd edilənlər (PR #328 rəyi, 2026-11-24):

- Gümüş üzüklər (https://unsplash.com/photos/IdU1Si3wJ-I üç üzük, Alyssa Hurley;
  https://unsplash.com/photos/wh_rZqPiCuw və https://unsplash.com/photos/kuko1hX_kXw, Sabrianna) və gümüş ürək
  asqı (https://unsplash.com/photos/ZoDgJpXzDB8, Sabrianna): ağ fonda ağ metal; kənarda ağ hale, solğun zolaq və ya
  fona qarışan zolaq qalır. U2-Net-p-nin zəif yeri budur: ağ fonda gümüş üçün təmiz kəsim alınmır.
- Qızıl soliter üzük (https://unsplash.com/photos/NhrcL_C0sFA, Sabrianna): açıq kontur, kadrı digər üzük
  şəkillərindən çox doldurur, nişan üzüyüdür, amma halqa havuzu toy üzüyü kartlarına da düşür.
- Qızıl zəncir dəsti (https://unsplash.com/photos/aldDZePniqg, Syed F Hashemi): ağ qırıntı qalıb, qolbaq
  məhsulunda qarışıq dəst göstərir.
- COPPERTIST WU-nun gümüş zənciri (https://unsplash.com/photos/kX79F-UsSNU): model zəncirin içindəki boz fonu da
  əşya sayıb; Philippe Van Doninck-in qolbağı (https://unsplash.com/photos/hoC_u_9yJ_Y): kənarda ağ hale və köhnə
  kölgə qalıb.

Orijinallar krem dizayna uyğun olmadığı üçün onları da əlavə etmədik.

Bu fayllar yalnız nümunə məlumat rejimində (`NEXT_PUBLIC_USE_MOCK=true`, `src/lib/api/mock/fixtures.ts`) görünür;
backend demo seed-i (`R__demo_seed.sql`) hələ yalnız JPEG şəkilləri göstərir.

Fon silmə modeli (`frontend/public/models/u2netp.onnx`): U2-Net-p, Xuebin Qin və başqaları,
https://github.com/xuebinqin/U-2-Net, Apache License 2.0. ONNX faylı rembg layihəsinin (MIT) `v0.0.0` release
asset-idir, SHA-256 `309c8469258d...` (backend-dəki `SegmentationModel.U2NETP` ilə eyni). İcra: ONNX Runtime Web
1.22.0 (MIT), yalnız admin və satıcı kabinetində düyməyə basanda yüklənir.

Damğa və etiket nümunələri (#106, 2026-11-18): `hallmark-gold-585.jpg` və `tag-gold-585.jpg` foto deyil,
AI deyil: Jeparla üçün SVG ilə çəkilib (sharp ilə JPEG-ə çevrilib), 800x800. Demo məhsul 13-ün qalereyasında
"Damğa" və "Etiket" kadrlarının və admin növbəsinin görünməsi üçündür; real damğanın şəkli deyil, etiketdə
"NÜMUNƏ" yazılıb.

## AI model kitabxanası (#130)

Model üzərində şəkillər üçün AI modellər (real şəxs deyil). Hər model admin paneldə yüklənir və burada
qeyd olunur: ad, auditoriya, dəri tonu, üslub, yaradıldığı alət və tarix (API-dəki `origin` sahəsi ilə eyni).
Modellər pullu generasiya ilə yaradıldığı üçün xərc sahibin təsdiqi ilə.

| Model | Auditoriya | Dəri tonu | Üslub | Mənşə (alət, tarix) |
| --- | --- | --- | --- | --- |
| (hələ model yoxdur) | | | | |

## Loqo və ikonlar (#50)

Loqo: **əl yazısı söz-nişan** (sahibin seçimi, 2026-11-22). Hərflər Great Vibes şriftindən
konturlanıb (Copyright 2010 The Great Vibes Pro Project Authors, SIL Open Font License 1.1);
"J"-nin başına taxılmış üzük və kompakt nişan Jeparla üçün çəkilib, AI ilə yaradılmayıb. Şrift
faylı repoda saxlanılmır və saytda yüklənmir. Mənbə və generator: `docs/brand/`
(`src/build-logo-script.mjs`). Saytda: başlıq və footer söz-nişanı
(`frontend/src/components/brand/`), `icon.svg`, `favicon.ico`, `apple-icon.png`,
`public/icons/*` (`npm run icons`), `/logo.png` və mağaza link önizləməsi (`/api/og/store`).
Əvvəlki loqo (variant A "Baget", Cormorant, 2026-11-18) və B, C variantları qeyd kimi
`docs/brand/`-də qalır.
