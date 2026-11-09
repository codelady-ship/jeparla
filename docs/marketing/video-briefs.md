# Jeparla: 5 tanıtım videosunun ssenarisi (Remotion, `video/`)

Issue: #101 (videolar), #100 (satıcı linki). Format: 9:16, 1080x1920, 30 fps, 15-30 s.
Instagram Reels + TikTok (eyni fayl). Hamısı `video/` Remotion layihəsində, mövcud
`Hero` komponenti və `layout.ts`-dəki `MOBILE` formatı ilə.

## Texniki əsas (hamısı üçün)

**Fayl quruluşu (təklif):**
```
video/src/social/
  Social.tsx          # 5 kompozisiya: SocialWhat, SocialPrice, SocialVerified, SocialSellers, SocialGift
  parts/Title.tsx     # Cormorant başlıq, reveal (opacity + translateY 24px)
  parts/Subtitle.tsx  # ru alt yazı zolağı
  parts/Phone.tsx     # telefon çərçivəsi + ekran yazısı (OffthreadVideo) və ya ekran şəkli
  parts/Card.tsx      # krem kart, lucide ikon (lucide-react SVG, Remotion-da işləyir)
  copy.ts             # bütün mətnlər az + ru (sərt yazılmır, bir yerdə; dərcdən əvvəl yoxlanılır)
  price.json          # V2 üçün real AMB qram qiymətləri + tarix (saytın API-sindən götürülür, əl ilə yazılmır)
```
`Root.tsx`-ə 5 yeni `<Composition>` (1080x1920, 30 fps). Render:
`npx remotion render SocialWhat out/social-what.mp4 --codec h264 --crf 18`.

**Rənglər** (`docs/design/tokens.json` scene tokenləri; kodda `layout.ts` sabitləri kimi):
krem `#F7F3EA` (fon), tünd yaşıl `#16251F` (fon/mətn), qızılı `#C5A15A` (xətt, vurğu fonu),
açıq qızılı `#E8D39A` (işıq), tünd qızılı `#8C6A26`, gümüş `#D8DCE1`, brilyant `#F7F8FA`.
Qara fon yoxdur. Krem fonda qızılı mətn yoxdur (kontrast); qızılı mətn yalnız tünd yaşıl fonda.

**Şriftlər:** başlıq Cormorant (`@remotion/google-fonts/Cormorant`). **Diqqət:** indiki
`Hero.tsx` `subsets: ["latin"]` yükləyir; Ə (U+018F/0259) və kiril üçün `latin-ext` və `cyrillic`
əlavə olunmalıdır, yoxsa "Ə" və rus mətni ehtiyat şriftə düşər. Alt yazı üçün Manrope
(`@remotion/google-fonts/Manrope`, tokens.json body) `latin-ext` + `cyrillic`; Ə qlifini test
render ilə yoxla ("ƏəİıŞşÇçĞğÖöÜü ЖЩЫ"), yoxdursa Inter. Hər video dərcdən əvvəl 1 kadr
böyüdülüb Ə/ş/ğ yoxlanılır.

**Hərəkət qaydaları** (emil-design-eng, review-animations prinsipləri):
- Yalnız `transform` (translate, scale) və `opacity`. Blur, filter, box-shadow animasiyası yoxdur.
- Easing: `Easing.bezier(0.22, 1, 0.36, 1)` (token `luxe`), panellər üçün `(0.65, 0, 0.35, 1)`.
- Reveal: 24 px yuxarı + opacity 0->1, 0.8 s (24 kadr); stagger 80 ms (2-3 kadr).
- Hər mətn ekranda ən azı 1.5 s qalır (oxumaq üçün); ekranda eyni anda maks. 7-8 söz.
- Sakit temp: kəskin zoom, titrəmə, "glitch", sürətli kəsik yoxdur. Kəsiklər crossfade (8-12 kadr).
- Təhlükəsiz zona: yuxarı 220 px və aşağı 380 px-də vacib mətn yoxdur (platforma UI-ı örtür);
  sağda 160 px (düymələr). Mətn mərkəzi 1080x1440 zonada (3:4 örtük kəsimi ilə də uyğun).

**Alt yazı:** ekran mətni az (böyük, Cormorant); ru alt yazı aşağıda (Manrope, 40-44 px,
tünd yaşıl fonda krem mətn və ya krem fonda tünd yaşıl; zolaq yarımşəffaf deyil, tam rəng).
Video səssiz də anlaşılır. Səs (voiceover) yoxdur (v1); sonra sahibin öz səsi ilə əlavə oluna bilər.

**Musiqi:** yalnız lisenziyalı/royalty-free.
- Ən sadə yol: videonu **musiqisiz** render et, musiqini platformanın öz kitabxanasından əlavə et:
  Instagram business hesabı üçün Meta Sound Collection, TikTok business hesabı üçün Commercial
  Music Library. Bunlar kommersiya istifadəsi üçün təmizlənib (platforma daxilində).
- Musiqi faylın içində lazımdırsa (eyni səs hər iki platformada): lisenziyası sosial şəbəkə və
  kommersiya istifadəsini yazılı əhatə edən trek (məs. ödənişli abunə kitabxanası və ya
  pulsuz lisenziyası aydın olan trek); lisenziya PDF/ekranı `docs/credits.md`-yə yazılır
  (trek adı, müəllif, mənbə, tarix, lisenziya linki).
- Xarakter: sakit, piano/simli/ambient, 70-90 BPM, vokal yox. Məşhur mahnı, "trend audio",
  başqa brendin reklam musiqisi yoxdur.

**AI etiketi:** V1 və hero kadrı olan digər videolarda platformanın AI açarı aktiv
(TikTok-da real görünən AI insan/heyvan təsviri üçün məcburidir). Hero AI ilə yaradılıb
(`docs/credits.md`).

**Ekran görüntüləri:** saytın real ekranları (Playwright skrinşotu, 390 px genişlik, 3x;
və ya telefon ekran yazısı). Demo məhsul şəkilləri (Unsplash) göstərilmir: ya real mağazanın
razılıqlı məhsulu, ya da şəkil sahəsi krem blok + lucide `Gem` və "Nümunə ekran / Пример экрана".

**Rəqəmlər:** heç bir videoda uydurma rəqəm yoxdur. V2-də qiymət yalnız `price.json`-dan
(saytın backend-i AMB-dən hesablayır), tarix və "AMB" mənbəyi ilə eyni kadrda.

---

## V1. "Jeparla nədir" (18 s)

Məqsəd: tanışlıq (Reel R1). Hook: ilk 2 saniyədə hərəkət (heyvanlar daxil olur).

| # | Vaxt | Vizual | Ekran mətni (az) | Alt yazı (ru) | Hərəkət |
|---|---|---|---|---|---|
| 1 | 0.0-4.6 s | Mövcud `Hero` 1-ci akt (`MOBILE`), krem fon, pələnglər və pantera gəlir | Azərbaycanın zərgərlik mağazaları | Ювелирные магазины Азербайджана | Mətn 0.4 s-də reveal (translateY 24->0, opacity); `<Sequence>` ilə `Hero` |
| 2 | 4.6-7.0 s | 2-ci akt: qızılı işıq, üç model (gümüş, qızıl, brilyant) | bir yerdə | в одном месте | `Hero`-nun transform hissəsi kadrla oynayır (scroll yox, xətti `frame`) |
| 3 | 7.0-9.5 s | Modellər qalır, aşağıdan krem kart: lucide `Search` | Axtar | Ищите | Kart translateY 40->0 + opacity; modellər scale 1->0.96 (yavaş) |
| 4 | 9.5-12.0 s | Kart dəyişir: `BadgeCheck`, kiçik sahələr "metal, əyar, çəki" | Yoxla | Проверяйте | Crossfade 10 kadr, ikon scale 0.9->1 |
| 5 | 12.0-14.5 s | Kart: `MessageCircle`, "WhatsApp" düymə formasında | Mağazaya yaz | Пишите магазину | Düymə scale 0.96->1 bir dəfə (nəbz yox) |
| 6 | 14.5-18.0 s | Tünd yaşıl fon, "Jeparla" Cormorant, altında qızılı xətt, "jeparla.az" | Jeparla / jeparla.az | Ссылка в профиле | Fon krem->yaşıl opacity keçidi; xətt scaleX 0->1 (origin center) |

Musiqi: sakit ambient/piano, 1-ci aktda yumşaq başlanğıc; 2-ci aktdakı işıqla bir akkord vurğusu.

## V2. "Metal qiyməti hər gün" (20 s)

Məqsəd: metal qiyməti sütunu (Reel R2). Hər həftə yalnız `price.json` dəyişib yenidən render olunur.

| # | Vaxt | Vizual | Ekran mətni (az) | Alt yazı (ru) | Hərəkət |
|---|---|---|---|---|---|
| 1 | 0-3 s | Tünd yaşıl fon, böyük qızılı rəqəm "585" | Bu gün 585 qızılın qramı | Сегодня грамм золота 585 пробы | "585" scale 0.94->1 + opacity |
| 2 | 3-7 s | Rəqəm kartı: `[585 QİYMƏT] AZN`, altında kiçik mono "AMB, [TARİX]" | [QİYMƏT] AZN / AMB, [TARİX] | [ЦЕНА] AZN / ЦБА, [ДАТА] | Rəqəm sayğac kimi "fırlanmır" (saxta dinamika yox): sadəcə reveal |
| 3 | 7-11 s | 3 sətir: 750 qızıl, 999 qızıl, 925 gümüş (real qram qiymətləri), saytın vidcet üslubunda | 750 / 999 / 925 gümüş | 750 / 999 / серебро 925 | Sətirlər 80 ms stagger, translateY |
| 4 | 11-15 s | Formul kartı (krem): "unsiya qiyməti / 31.1035 x əyar" | Hesab: AMB unsiya qiyməti / 31.1035 x əyar | Расчёт: цена унции ЦБА / 31,1035 x проба | Kart sağdan translateX 60->0 |
| 5 | 15-18 s | Xəbərdarlıq kartı, `Info` ikonu | Yalnız metal. İşçilik, daş, mağaza əlavəsi daxil deyil | Только металл. Работа, камни, наценка не включены | Opacity, 3 s sabit (oxunsun) |
| 6 | 18-20 s | Loqo kadrı | "Metala bağlı" qiymətlər Jeparla-da hər gün yenilənir | Цены с привязкой к металлу обновляются ежедневно | xətt scaleX |

Qaydalar: rəqəm və tarix eyni kadrda; həftəsonu render olunursa "son mövcud qiymət" yazılır;
gündəlik dəyişmə faizi göstərilmir (proqnoz və "bahalaşır/ucuzlaşır" yox). Qrafik istəsək,
yalnız real `price_history` nöqtələri, oxlar və tarixlərlə (PLAN.md 5.16: real AMB rəqəmləri).
Musiqi: neytral, sakit pulse, dramatik yox.

## V3. "Jeparla Verified" (22 s)

Məqsəd: etibar (Reel R3). Dürüstlük: "zəmanət" sözü yalnız "zəmanət deyil" kontekstində.

| # | Vaxt | Vizual | Ekran mətni (az) | Alt yazı (ru) | Hərəkət |
|---|---|---|---|---|---|
| 1 | 0-3 s | Krem fon, saytın Verified nişanı böyüdülmüş | Jeparla Verified nədir? | Что такое Jeparla Verified? | Nişan scale 0.9->1, opacity |
| 2 | 3-7 s | 3 kart üst-üstə (boz/sönük, opacity 0.35); 1-ci kart işıqlanır: `UserCheck` | Satıcı təsdiqlənib | Продавец подтверждён | Aktiv kart opacity 0.35->1, translateX 0->8 |
| 3 | 7-11 s | 2-ci kart: `FileCheck` | Sənədlər yoxlanılıb | Документы проверены | eyni |
| 4 | 11-15 s | 3-cü kart: `ScanSearch` | Fiziki ekspertiza | Физическая экспертиза | eyni |
| 5 | 15-19 s | Məhsul kartının ekranı, statuslar ayrı-ayrı görünür (biri aktiv, biri yox nümunəsi) | Hər status ayrıca görünür | Каждый статус виден отдельно | Telefon çərçivəsi translateY 80->0 |
| 6 | 19-22 s | Tünd yaşıl fon | Zəmanət deyil. Açıq məlumat. | Не гарантия. Открытая информация. | Reveal, sonra loqo |

Musiqi: sakit, ritmik ambient; status keçidlərində yumşaq vurğu (səs effekti lisenziyalı və ya yox).
Qeyd: kart mətnləri saytın Verified mətnləri ilə eyni olmalıdır (PLAN.md 5.9); fərq varsa saytdakı əsasdır.

## V4. "Satıcılar: kataloqunu pulsuz yerləşdir və linki paylaş" (26 s)

Məqsəd: satıcı qeydiyyatı (Reel R4); outreach follow-up mesajında link. Asılılıq: #100
(link, QR, "Kataloqu paylaş" bloku hazır olmalıdır; yoxdursa video gözləyir).

| # | Vaxt | Vizual | Ekran mətni (az) | Alt yazı (ru) | Hərəkət |
|---|---|---|---|---|---|
| 1 | 0-3 s | Tünd yaşıl fon, `Store` ikonu qızılı | Zərgərsiniz? | Вы ювелир? | İkon scale 0.9->1, mətn reveal |
| 2 | 3-7 s | Telefon: satıcı kabineti, "Məhsul əlavə et" (öz test mağazamız "Nümunə Mağaza") | Kataloq pulsuzdur | Каталог бесплатный | Telefon translateY 120->0 |
| 3 | 7-11 s | Məhsul formu: şəkil, metal, əyar, çəki sahələri bir-bir dolur (ekran yazısı) | Telefonla əlavə edin | Добавляйте с телефона | `OffthreadVideo` ekran yazısı, kənarda qızılı çərçivə opacity |
| 4 | 11-14 s | "Metala bağlı" açarı; qiymət sətri | Qiymət AMB ilə hər gün yenilənir | Цена обновляется по курсу ЦБА | Açar keçidi ekran yazısının özüdür |
| 5 | 14-19 s | "Kataloqu paylaş": link `jeparla.az/<slug>`, QR; sonra 4 kiçik kart: Instagram bio, TikTok, WhatsApp status, Tap.az (yalnız mətn + lucide ikon, platforma loqosu yox) | Bir link: bio, TikTok, WhatsApp, Tap.az | Одна ссылка: bio, TikTok, WhatsApp, Tap.az | Kartlar 80 ms stagger, translateY 24->0 |
| 6 | 19-23 s | Alıcı tərəfi: mağaza səhifəsi -> WhatsApp düyməsi -> hazır mesaj | Müştəri sizə WhatsApp-da yazır | Клиент пишет вам в WhatsApp | Crossfade |
| 7 | 23-26 s | Krem fon, CTA | DM-də "kataloq" yazın | Напишите в DM "каталог" | Reveal, xətt scaleX |

Qeyd: platforma loqoları (Instagram, TikTok, WhatsApp, Tap.az) istifadə olunmur: başqa brendin
loqosu qaydası. Adlar mətnlə yazılır. "Komissiya yoxdur" yalnız v1 qiymət siyasəti yazılı
təsdiqlənibsə əlavə olunur.
Musiqi: bir az daha canlı (90 BPM), yenə vokalsız.

## V5. "Hədiyyə seçimi" (20 s)

Məqsəd: hədiyyə alanlar (Reel R6); dekabr / 8 Mart / ad günü üçün mətn dəyişir (`copy.ts`-də variantlar).

| # | Vaxt | Vizual | Ekran mətni (az) | Alt yazı (ru) | Hərəkət |
|---|---|---|---|---|---|
| 1 | 0-3 s | Krem fon, `Gift` ikonu; arxada hero modellərindən biri (`model-1.png`) sağda, kəsik | Hədiyyə axtarırsınız? | Ищете подарок? | Model translateX 40->0 + opacity; mətn reveal |
| 2 | 3-7 s | 3 sual kartı ardıcıl | Kimə? Hansı münasibət? Hansı büdcə? | Кому? Какой повод? Какой бюджет? | Kartlar stagger |
| 3 | 7-11 s | Telefon: kataloq filtri (qiymət aralığı, metal) | Büdcə və metal filtri | Фильтр по бюджету и металлу | Telefon translateY |
| 4 | 11-14 s | Seçilmişlər (`Heart`) ekranı | Bəyəndiklərinizi saxlayın | Сохраняйте понравившееся | Crossfade |
| 5 | 14-17 s | Müqayisə ekranı (2-4 məhsul: çəki, əyar, qiymət, mağaza) | Müqayisə edin | Сравнивайте | Sütunlar 80 ms stagger |
| 6 | 17-20 s | Tünd yaşıl fon, loqo | Mağazaya birbaşa yazın. jeparla.az | Пишите магазину напрямую | Reveal |

Qeyd: model kadrı AI ilə yaradılıb: AI etiketi açıq. Məhsul şəkilləri yalnız real mağazadan,
razılıqla; yoxdursa nümunə ekran qaydası. "Ən yaxşı hədiyyə", "endirim" ifadələri yoxdur.
Musiqi: isti, yumşaq piano.

---

## Dərcdən əvvəl yoxlama siyahısı (hər video)

1. Ə, İ, Ş, Ğ, Ç, Ö, Ü və rus hərfləri düzgün şriftdə (kadr böyüdülüb baxılıb).
2. Uydurma rəqəm, "100% zəmanət", "ən ucuz" yoxdur; V2-də rəqəm + tarix + AMB.
3. Başqa brendin loqosu, şəkli, musiqisi yoxdur; Unsplash demo şəkilləri yoxdur.
4. Musiqi lisenziyası `docs/credits.md`-də (və ya platforma kitabxanasından əlavə olunub).
5. AI etiketi (hero kadrı varsa) açıqdır.
6. Mətn təhlükəsiz zonadadır; örtük kadrı 3:4 mərkəzdə oxunur.
7. Emoji yoxdur (caption daxil).
8. Real mağaza göstərilibsə, yazılı razılıq cədvəldə qeyd olunub.

## Mənbələr

- Business hesablar üçün musiqi: https://musicbusinessworldwide.com/meta-offers-royalty-free-music-library-to-instagram-reels-advertisers , https://www.soundstripe.com/blogs/instagram-music-library (TikTok Commercial Music Library detalları yoxlanılmayıb: TikTok Business yardım səhifəsində yoxla)
- AI etiketi: https://www.socialmediatoday.com/news/tiktok-adds-new-required-labels-for-ai-generated-content/690454/
- Reel örtüyü 3:4 kəsimi: https://buffer.com/library/instagram-image-size
