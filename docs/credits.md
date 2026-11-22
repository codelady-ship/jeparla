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
