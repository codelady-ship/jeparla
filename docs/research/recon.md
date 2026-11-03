# Recon: istinad saytları (issue #9)

Tarix: 2026-11-03. Mənbə: `docs/PLAN.md` bölmə 2. Məqsəd: hər saytdan Jeparla üçün yalnız **ideya**
götürmək (clean-room). Məlumat açıq səhifələrin avtomatik oxunması (WebFetch) və veb axtarışla
toplanıb. Bir neçə sayt avtomatik oxumanı blokladı (HTTP 403/503); onlar aşağıda qeyd olunub və
həmin hissədəki fikirlər ya axtarış nəticələrinə əsaslanır, ya da "yoxlanılmayıb" kimi işarələnib.

Əlaqəli fayl: `features.csv` (funksiya siyahısı, prioritet, mənbə URL).

| Sayt | Oxuna bildimi |
| --- | --- |
| mejuri.com | Bəli (kolleksiya + PDP) |
| missoma.com | Bəli (kolleksiya + PDP) |
| pandora.net | Xeyr (403); axtarış nəticələri |
| swarovski.com | Xeyr (403); axtarış nəticələri |
| tiffany.com | Xeyr (403); axtarış nəticələri (Baymard, bloqlar) |
| catbirdnyc.com | Bəli (ana səhifə) |
| brilliantearth.com | Bəli (brilyant axtarışı, kateqoriya hub) |
| farfetch.com | Bəli (butiklər səhifəsi) |
| etsy.com | Xeyr (403); axtarış nəticələri (Etsy help, forum) |
| zalando | Xeyr (503); axtarış nəticələri (Baymard, ScreensDesign) |
| vinted.com | Axtarış nəticələri (Vinted Help 375) |
| webflow.com/made-in-webflow/jewelry | Bəli |

---

## Mejuri

URL: https://mejuri.com/world/en/collections/dome , https://mejuri.com/world/en/products/dome-huggies

**Nəyə baxdıq**
- Kart: əsas şəkil + bir neçə kiçik thumbnail (şəkil swatch-ları), badge-lər ("New", "Sold out",
  bestseller, bundle), ad, qiymət, ayrıca **material sətri** (məs. 18k Gold Vermeil, Sterling Silver,
  Solid Gold 14k), bəzən daş sətri.
- Filtr: Category, Material, Availability + "All Filters", nəticə sayı ("(74 Products)"), Sort.
- PDP: qalereya + "Image 1 of 2" sayğacı, başlıq yanında etibar nişanları (zəmanət, qaytarma,
  çatdırılma), reytinq, qiymət, Material seçicisi, qısa təsvir, "Materials & Specifications"
  bölməsi (material izahı, ölçülər: uzunluq/en/qalınlıq, ölçü bələdçisi linki).
- Akkordeon davranışı və "pairs well with" bloku oxunan hissədə görünmədi: yoxlanılmayıb.

**Jeparla-ya nə götürürük**
- Kartda adın altında ayrıca, qısa **metal/əyar sətri** (məs. "Qızıl 585 · 3,2 q").
- Kartda kiçik badge dəsti, lakin yalnız real faktlar: "Yeni", "Verified", "Metala bağlı qiymət".
- Filtr panelinin üstündə nəticə sayı və tək "Bütün filtrlər" düyməsi; ilk sırada 3 əsas filtr.
- PDP-də spesifikasiya bloku: metal, əyar, çəki, ölçülər, daş; ölçü bələdçisi linki.

**Götürmürük**
- Bundle/endirim badge-ləri, "sold out N dəfə" kimi təzyiq mesajları (dürüstlük qaydası).
- Səbət/"Add" düyməsi: Jeparla kataloqdur, alış WhatsApp ilə olur.
- Mejuri+ üzvlük, onların mətni, şəkilləri, şrifti.

## Missoma

URL: https://www.missoma.com/collections/necklaces , https://www.missoma.com/products/mini-paperclip-chain-necklace-18ct-gold-plated

**Nəyə baxdıq**
- Kart: iki şəkil (hover-da ikinci şəkil ehtimalı; davranış yoxlanılmayıb), adda material
  ("| 18ct Gold Plated"), qiymət, "Add to Bag".
- Kolleksiya səhifəsində görünən filtr yoxdur; naviqasiya Materials / Categories / Edits / Shop by
  Price linkləri ilə qurulub.
- PDP: 6 şəkil, breadcrumb, xüsusiyyət teqləri (məs. "Water-Resistant"), qiymət, metal swatch,
  "Notify me" (stokda yoxdursa), ölçü bələdçisi, "Why you'll love it" (4 bənd), "Details &
  Dimensions" (material, zəncir uzunluğu, link ölçüsü, **çəki 3,2 q**, məhsul kodu), "How to Style
  It" mətni, "Recently Viewed", "Discover More" kolleksiya linkləri.
- PDP-də ayrıca "styled with" bloku oxunan məzmunda **tapılmadı**; ən yaxını səbət çekmecəsindəki
  "Why Not Add" karuselidir. PLAN-dakı "styled with" fikri burada təsdiqlənmədi.

**Jeparla-ya nə götürürük**
- PDP-də xüsusiyyət teqləri (çip): "Gümüş 925", "Sertifikatlı", "Əl işi" (mağazanın bəyanı + Verified).
- "Details & Dimensions" kimi sadə cədvəl, çəki mütləq göstərilir (metal qiymətinə bağlıdır).
- "Bu mağazadan daha çox" və "Oxşar məhsullar" karuseli ("styled with" əvəzinə, real data ilə).
- "Son baxılanlar" (localStorage, girişsiz).
- "Qiymətə görə alış-veriş" linkləri (məs. 200 AZN-ə qədər) kateqoriya menyusunda.

**Götürmürük**
- Səbət, pulsuz çatdırılma hədləri, qaytarma siyasəti (bunlar mağazanın öz şərtləridir; Jeparla
  yalnız mağazanın daxil etdiyi məlumatı göstərir).
- Gənc, trend tonlu marketinq mətni.

## Pandora

URL: https://us.pandora.net/en (fetch 403), https://ca.pandora.net/en/shop-by (fetch 403)

**Nəyə baxdıq**
- Sayt avtomatik oxumanı blokladı. Axtarış nəticələrinə görə Kanada saytında filtr paneli:
  Category, Price, Collection, Theme, Occasions, Colour, Size, On Sale, Engravable; "shop by"
  səhifəsində Carat, Shape. Metal ayrıca filtr kimi görünmür (axtarış snippet-i, birbaşa
  yoxlanılmayıb).

**Jeparla-ya nə götürürük**
- **Münasibət / hədiyyə** filtri (nişan, toy, ad günü, uşaq üçün) - kateqoriyaya əlavə ölçü kimi.
- "Shop by" hub səhifəsi: kateqoriya, metal, münasibət, qiymət diapazonu üzrə giriş nöqtələri.
- Böyük kataloq üçün iki səviyyəli kateqoriya naviqasiyası.

**Götürmürük**
- Charm/bilərzik konfiqurator məntiqi (Pandora-ya xas məhsul modeli).
- Onların vizual stili, mətni.

## Swarovski

URL: https://www.swarovski.com/en-US/ (fetch 403), https://www.swarovski.com/en-NL/c-swa-root/Categories/f/product-set/ps-selected-gifts

**Nəyə baxdıq**
- Sayt avtomatik oxumanı blokladı. Axtarışa görə "selected gifts" məhsul dəsti səhifələri var:
  **qiymət tavanı ilə hədiyyələr** ("Gifts under ...") və "Gifts for Her / Him" bölmələri; hər
  ölkədə öz valyutası və həddi.
- Animasiya üçün: bax "Swarovski keçidləri" bölməsi.

**Jeparla-ya nə götürürük**
- Hədiyyə səhifəsi: "X AZN-ə qədər hədiyyələr", "Ona / Onun üçün", münasibət üzrə. Sabit qiymət
  hədləri AZN ilə, məhsullar real filtr sorğusu ilə yığılır (əl ilə kurasiya tələb etmir).
- Motion xarakteri (sakit, yavaş) - DESIGN.md artıq bunu edir.

**Götürmürük**
- Promo hədiyyələr (çanta, çətir və s.), parıltı effektləri, onların kodu, video və şəkilləri.

## Tiffany

URL: https://www.tiffany.com/jewelry/necklaces-pendants/ (fetch 403), https://baymard.com/ux-benchmark/case-studies/tiffany-and-co

**Nəyə baxdıq**
- Sayt blokladı. Baymard benchmark (iyul 2025) PDP-də **üfüqi tab-ları** problem kimi qeyd edir:
  tab-lar əsas məhsul məlumatını gizlədir. Bir bloq (rəy xarakterli) hər PDP-də video və ətraflı
  material təsvirini qeyd edir. Şəkil keyfiyyəti və boşluq barədə birbaşa mənbə tapılmadı:
  yoxlanılmayıb.

**Jeparla-ya nə götürürük**
- PDP-də spesifikasiya **tab-larda gizlədilmir**: açıq bölmələr və ya ilk bölməsi açıq akkordeon.
- Premium hiss: geniş boşluq, ağ/krem fon, böyük məhsul şəkli, az element (DESIGN.md token-ləri ilə).

**Götürmürük**
- İmza rəngi (PLAN qaydası), loqo, qutu motivi, foto stili.

## Catbird

URL: https://www.catbirdnyc.com/

**Nəyə baxdıq**
- Ana səhifə ardıcıllığı: kampaniya banneri, şəkil + qısa şüar + düymə olan kateqoriya blokları,
  **məhsula linklənmiş müştəri rəyləri**, dəyər blokları (bərk qızıl, davamlılıq, xeyriyyə),
  "Visit Us" (mağazalar, xidmətlər: pirsinq, daimi zərgərlik, stilist), qiymət diapazonu üzrə
  qruplaşma (Under $150 ...).
- Ton: isti, şəxsi, kiçik emalatxana dili; "kiçik dükan, 2004-cü ildən" tipli mənşə hekayəsi.

**Jeparla-ya nə götürürük** (mağaza profili üçün)
- Mağaza səhifəsində **hekayə bloku**: təsis ili, şəhər/rayon, usta/ailə, nə ilə məşhurdur.
- "Ziyarət et" bloku: ünvan, xəritə, iş saatları, telefon/WhatsApp.
- **Xidmətlər** siyahısı: ölçü dəyişmə, təmir, həkkakərlik, sifarişlə hazırlama.
- Dəyər bəyanları ancaq yoxlanıla bilən olduqda (məs. "Əyar möhürü yoxlanılıb" - Verified ilə).

**Götürmürük**
- Endirim üçün newsletter popup-ı, oynaq ingilis mətn tonu, onların foto estetikası.
- Rəyləri biz MVP-də göstərmirik (saxta rəy riski; P3 kimi gələcəyə).

## Brilliant Earth

URL: https://www.brilliantearth.com/loose-diamonds/search/ , https://www.brilliantearth.com/loose-diamonds/

**Nəyə baxdıq**
- Filtrlər: Origin (təbii / laboratoriya), **Shape** (12 forma, foto ilə), **Carat** min/max,
  Price min/max, **Cut / Color / Clarity** ayrı filtr (rəng D-dən başlayır, təmizlik FL, IF, VVS,
  VS, SI, I), L:W ratio, Fluorescence, Polish, Symmetry, Table %, Depth %, **Report (IGI, GIA, HRD)**,
  hazır presetlər ("Most Sparkle / Best Balance / Top Quality"), Reset All.
- Nəticə: grid və list görünüş; list sütunları Shape, Price, Carat, Cut, Color, Clarity, L:W,
  Compare. Sort: qiymət, karat, kəsim, rəng, təmizlik, forma. Grid kartında karat + forma + kəsim +
  rəng + təmizlik + qiymət.
- Sertifikat göstərilməsinin PDP-də dəqiq yeri: yoxlanılmayıb (axtarış yalnız "sertifikat online
  yoxdursa bizimlə əlaqə" mətnini və "drag to rotate" video etiketini göstərdi).

**Jeparla-ya nə götürürük**
- Brilyant filtrləri MVP-də: forma (ikon ilə, öz çəkdiyimiz lucide-uyğun SVG), karat diapazonu
  (iki ucluq slayder + min/max input), rəng (D...K diapazon slayderi), təmizlik (FL...I1 diapazon),
  kəsim, sertifikat laboratoriyası (GIA, IGI, HRD, yerli), təbii/laboratoriya.
- Brilyant kartında 4C xülasə sətri: "0,50 ct · Round · G · VS1".
- Grid / list keçidi və list görünüşündə sıralana bilən sütunlar; mövcud müqayisə (5.11) ilə əlaqə.
- Hər filtrin yanında kiçik "bu nədir?" izahı (öz mətnimiz, 3 dildə).
- Sertifikat: nömrə + laboratoriya + PDF/link; Verified admin tərəfindən yoxlanılır.

**Götürmürük**
- Table %, Depth %, Polish, Symmetry, Fluorescence - MVP-də yox (P3, "Ətraflı" altında ola bilər).
- Çatdırılma tarixi filtri, blockchain/kolleksiya etiketləri, "Going fast" tipli təzyiq badge-ləri.
- Onların foto/video materialları.

## Farfetch

URL: https://www.farfetch.com/boutiques

**Nəyə baxdıq**
- Partnyor butiklər regiona görə qruplaşdırılıb, səhifələnir. Hər butik: ad, şəhər + ölkə,
  "Brands to look out for", "About the store" (təsis, tarix, interyer konsepti).
- Butik səviyyəsində verifikasiya nişanı və ya reytinq **görünmür**; etibar hekayə və uzunömürlülük
  ("1983-cü ildən") ilə qurulur.

**Jeparla-ya nə götürürük**
- Mağazalar kataloqu: şəhər/rayon üzrə qrup, axtarış, səhifələmə.
- Mağaza kartı: ad, şəhər, təsis ili, əsas ixtisas (qızıl/gümüş/brilyant), Verified nişanı.
- Mağaza səhifəsində "Haqqında" bloku.

**Götürmürük**
- Brend siyahısı bloku (bizdə mağazalar öz istehsalıdır; lazım olsa sonra).

## Etsy

URL: https://www.etsy.com/shop/CatbirdNYC (fetch 403), https://help.etsy.com/hc/en-in/articles/4409221032599-How-to-Find-the-Best-Items-for-You-on-Etsy

**Nəyə baxdıq**
- Sayt blokladı. Axtarış (Etsy help + forum, bəzisi köhnə ola bilər): mağaza səhifəsində yuxarıda
  ulduz reytinq və rəy sayı, "Star Seller" nişanı (5 ulduzlu rəylər, vaxtında göndəriş, sürətli
  cavab tarixçəsi əsasında), satış sayı (satıcı gizlədə bilər), qısaldılmış "About" + "Read more",
  aşağıda "Shop policies" + "Last updated", üzvlər, ödəniş üsulları, yer.

**Jeparla-ya nə götürürük**
- **Ölçülə bilən** etibar siqnalları: "Platformada N aydır", "Orta cavab müddəti" (WhatsApp klik
  və merchant cavabı ölçülə bilərsə; əks halda göstərmirik), Verified tarixi.
- Mağaza şərtləri bloku (çatdırılma, qaytarma, zəmanət) + "Son yenilənmə" tarixi.
- Qısa "Haqqında" + "Daha çox".

**Götürmürük**
- Satış sayı (Jeparla satışı görmür, saxta rəqəm olardı).
- Ulduz reytinq MVP-də yox.

## Zalando

URL: https://www.zalando.co.uk/womens-jewellery/ (fetch 503), https://baymard.com/ecommerce-design-examples/filtering-options/19244-zalando

**Nəyə baxdıq**
- Sayt oxunmadı. Baymard Zalando nümunələri əsasən ödənişlidir. Axtarışa görə: Zalando **üfüqi
  filtr sırası** ilə tanınan istinaddır (ScreensDesign: üfüqi filtr sırası + 2 sütunlu grid,
  mobil). Baymard tədqiqatı (UX Planet xülasəsi): üfüqi filtr paneli sol sidebar-dan rahatlıq və
  sürət baxımından üstündür, amma hər məhsul tipinə uyğun deyil. Mobil üçün yapışqan (sticky)
  "Filtr + Sırala" cütü tövsiyə olunur (üçüncü tərəf mənbələr).

**Jeparla-ya nə götürürük**
- Desktop: kataloqun üstündə üfüqi filtr sırası (4-6 əsas filtr dropdown), "Bütün filtrlər"
  yan paneli (shadcn Sheet); tətbiq olunmuş filtrlər çip kimi, hər biri x ilə silinir, "Hamısını sil".
- Mobil: sticky "Filtr" və "Sırala" düymələri yan-yana; filtr Sheet-də, altda "N nəticəni göstər".
- Filtr vəziyyəti URL-də (paylaşıla bilən, SEO dostu).

**Götürmürük**
- Moda üçün ölçü/brend məntiqi, onların rəngi və UI detalları.

## Vinted

URL: https://www.vinted.co.uk/help/375-uploading-step-by-step

**Nəyə baxdıq**
- Rəsmi help: addımlar - şəkillər (UK help-ə görə 20-yə qədər; üçüncü tərəf mənbə 5 deyir,
  ziddiyyətli), başlıq və təsvir (qüsurları göstərmək tövsiyəsi), kateqoriya, brend, ölçü,
  vəziyyət, qiymət, bağlama ölçüsü, yüklə.

**Jeparla-ya nə götürürük** (satıcı kabineti, 5.7)
- Addım-addım məhsul əlavə etmə: 1) şəkillər, 2) kateqoriya, 3) metal/əyar/çəki, 4) daş (varsa,
  brilyant üçün 4C + sertifikat), 5) qiymət (sabit və ya metala bağlı), 6) önizləmə + dərc.
- Kateqoriya seçildikcə uyğun sahələr açılır (brilyant olmayan üçün 4C gizli).
- Hər addımda qısa ipucu (məs. "Əyar möhürünün yaxın planı").

**Götürmürük**
- Bağlama/çatdırılma addımı, "vəziyyət" (işlənmiş mal) sahəsi - MVP yeni məhsuldur.

## Webflow Made in Webflow: Jewelry

URL: https://webflow.com/made-in-webflow/jewelry

**Nəyə baxdıq**
- Əsasən e-ticarət şablonları və lüks qızılı estetika; bəzi layihələrdə Lottie/interaksiya
  teqləri. Səhifə detallı vizual təsvir vermir (nəticələr layihə adlarından çıxarılıb).

**Jeparla-ya nə götürürük**
- Yalnız ümumi ilham: tünd fon + qızılı aksent kombinasiyası bizim palitraya uyğundur.

**Götürmürük**
- Heç bir şablon, kod, şəkil.

---

## Swarovski keçidləri

**Vəziyyət:** swarovski.com avtomatik oxumanı blokladı (HTTP 403) və axtarışda keçidlərin
təsviri tapılmadı (yalnız Divante/Vue Storefront "Swarovski PWA" portfoliosunda "animation" teqi
və bir dizaynerin "bold photography + elegant typography" təsviri). Ona görə aşağıdakı müşahidələr
**yoxlanılmayıb** - bunlar DESIGN.md-də artıq yazılmış "hiss" ilə müqayisə üçün hipotezdir, fakt
deyil.

Brauzerdə əl ilə yoxlanılmalı olanlar (növbəti addım, Chrome ilə 10 dəqiqəlik baxış):
1. Kart hover: şəkil yavaş, yumşaq dayanan zoom edirmi, yoxsa ikinci şəklə crossfade? (yoxlanılmayıb)
2. Scroll ilə bölmələr fade + yuxarı sürüşmə ilə görünürmü, qrupda növbə varmı? (yoxlanılmayıb)
3. Kartdan PDP-yə keçiddə şəkil davamlılığı varmı, yoxsa adi səhifə yüklənməsi? (yoxlanılmayıb)
4. Mega-menyu / çekmecə açılması: fade, yoxsa sürüşmə? (yoxlanılmayıb)
5. Link/düymə hover: alt xətt animasiyası? (yoxlanılmayıb)

**Bizim motion token-lərin qiymətləndirməsi**

| Token | Dəyər | Rəy |
| --- | --- | --- |
| fast | 150 ms | Normal; hover rəngi/fokus üçün standart diapazondadır. |
| base | 300 ms | Normal; menyu/dialoq/Sheet üçün uyğundur. |
| slow | 600 ms | Şəkil crossfade üçün uyğun; səhifə crossfade üçün bir qədər uzun hiss oluna bilər - naviqasiyada gecikmə kimi görünməməsi üçün səhifə keçidində `base`-ə yaxın dəyər sınaqdan keçirilsin. |
| reveal | 800 ms | Uyğun, 24px yerdəyişmə + 80 ms növbə ilə; uzun siyahılarda növbə ilk ~6 elementlə məhdudlaşdırılsın ki, son kart gec görünməsin. |
| zoom | 1200 ms | "Yavaş, lüks" hiss üçün uyğundur, çünki yalnız hover-dadır və 1.05 kiçik miqyasdır. |
| ease luxe | cubic-bezier(0.22, 1, 0.36, 1) | Sürətli başlayıb uzun dayanan "ease-out" - lüks vitrinlər üçün yaxşı seçimdir. |

Nəticə: token-lər məqsədəuyğun görünür, **dəyişiklik məcburi deyil**. İki kiçik tövsiyə (qərar
dizayn sahibinindir): (a) səhifə crossfade-i üçün 600 ms əvəzinə 300-400 ms sınaqdan keçirmək;
(b) reveal növbəsinə yuxarı hədd qoymaq. Swarovski əl ilə yoxlandıqdan sonra bu cədvəl yenilənə bilər.

---

## Clean-room qeydi

- Heç bir saytdan **kod, şəkil, video, loqo, mətn, şrift və ya imza rəngi** götürülməyib. Bu sənəddə
  yalnız ümumi UX naxışları öz sözlərimizlə təsvir olunub; qısa sitatlar yalnız element adlarıdır
  (məs. filtr adı).
- Bu recon zamanı ekran görüntüsü çəkilməyib. Gələcəkdə çəkilərsə, yalnız `docs/research/screens/`
  qovluğunda saxlanılır və o qovluq `.gitignore`-dadır - repoya düşmür.
- Animasiya dəyərləri Jeparla-nın özünündür (`tokens.json` -> `motion`); heç bir saytın dəqiq
  dəyəri ölçülməyib və köçürülməyib.
