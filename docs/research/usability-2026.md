# İstifadə rahatlığı 2026: axınların ölçülməsi və test protokolu

Issue: #176 ("Sadə və rahat istifadə"). Bu sənədin iki hissəsi var:

1. **Ölçülmüş hissə** (hazırdır): əsas axınların addım sayı, dəyişiklikdən əvvəl və sonra, 390px və
   1440px ekranda. Rəqəmlər `frontend/e2e/usability-flows.spec.ts` testindən gəlir; test hər CI
   işində yenidən ölçür və hədd aşılanda qırılır.
2. **İnsanlarla test** (sahibin işidir, hələ aparılmayıb): 5 alıcı və 3 satıcı ilə müşahidə üçün hazır
   protokol və doldurulacaq cədvəllər. Aşağıdakı cədvəllərdə nəticə xanaları boşdur: iştirakçı və
   nəticə uydurulmayıb.

## 1. Addım necə sayılır

- Bir addım: bir düyməyə və ya linkə bir klik/toxunuş, yaxud siyahıdan bir seçim.
- Addım sayılmır: sahəyə mətn yazmaq, səhifəni sürüşdürmək.
- Alıcı axınının son addımı "WhatsApp ilə mağazaya yaz" düyməsidir. Test onu yoxlayır (görünür,
  hündürlüyü ən azı 44px, link `wa.me` ünvanına hazır mesajla aparır), amma basmır: link saytdan
  çıxır.
- Başlanğıc nöqtəsi həmişə ana səhifədir (`/az`), satıcı sihirbazı üçün `/az/sell`.

## 2. Ölçülmüş addım sayı

| Axın                                            | Hədəf    | Əvvəl, 390px | Əvvəl, 1440px | Sonra, 390px | Sonra, 1440px |
| ----------------------------------------------- | -------- | ------------ | ------------- | ------------ | ------------- |
| Alıcı: ana səhifə, axtarış, məhsul, WhatsApp    | ən çox 3 | 3            | 3             | 3            | 3             |
| Alıcı: ana səhifə, kateqoriya, məhsul, WhatsApp | ən çox 3 | 3            | 3             | 3            | 3             |
| Alıcı: şəhər üzrə mağaza tapmaq                 | ən çox 2 | 3            | 3             | 2            | 2             |
| Satıcı: qeydiyyat sihirbazının ekranları        | ən çox 4 | 4            | 4             | 4            | 4             |

Rəqəmlərin mənbəyi: "Sonra" sütunları testin 2026-11-21 tarixli işindəndir (nümunə data ilə, hər iki
ekranda keçib). "Əvvəl" sütunları eyni addımların dəyişiklikdən əvvəlki kodda (`main`) sayılmasıdır:
kod oxunub, ayrıca test işi aparılmayıb. Dəyişən yeganə axın şəhər üzrə mağazadır; orada şəhər
seçimi siyahını yeniləmirdi və "Axtar" düyməsi üçüncü addım idi.

Addımların özü:

- **Axtarışla məhsul** (3): başlıqdakı axtarış düyməsi; təklif olunan məhsul; WhatsApp düyməsi.
  Söz yazmaq addım sayılmır.
- **Kateqoriya ilə məhsul** (3): ana səhifədəki kateqoriya linki; məhsul kartı; WhatsApp düyməsi.
- **Şəhər üzrə mağaza**, əvvəl (3): "Mağazalar" linki; şəhəri seçmək; "Axtar" düyməsi.
  Sonra (2): "Mağazalar" linki; şəhəri seçmək. Şəhər seçiləndə siyahı dərhal yenilənir.
  Telefonda "Mağazalar" linki ana səhifənin ilk ekranındakı "Mağazalara bax" düyməsidir. Menyudan
  getdikdə bir toxunuş artıqdır (menyu, "Mağazalar", şəhər: 3); bu, aşağıda "Açıq qalan problemlər"
  siyahısındadır.
- **Satıcı sihirbazı** (4 ekran, 4 əsas düymə basışı): Hesab; Mağaza; Sənədlər; İlk məhsul. Hər
  ekranda "Addım N / 4" yazısı və nə etməli olduğunu deyən bir cümlə var; test bunu da yoxlayır.

### Satıcı: qeydiyyatdan ilk məhsula qədər, addım-addım

| Addım | Ekran         | Bir cümləlik yönləndirmə                                                                                  | Doldurulan sahələr                                                                                   |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1     | Hesab         | Adınızı və mobil nömrənizi yazın, şifrə seçin: kabinetə bunlarla girəcəksiniz.                            | ad, mobil nömrə, şifrə                                                                               |
| 2     | Mağaza        | Mağazanın adını, WhatsApp nömrəsini və ünvanını yazın: alıcılar bunları görəcək.                          | nə satdığı, ad, WhatsApp, şəhər, ünvan, hüquqi forma, VÖEN, kodeksin qəbulu (Instagram istəyə bağlı) |
| 3     | Sənədlər      | Qızıl və ya gümüş satırsınızsa, mağaza sənədinin şəklini və ya PDF-ini yükləyin; sonra da göndərmək olar. | bir fayl (sonraya saxlamaq olar)                                                                     |
| 4     | İlk məhsul    | İlk məhsulun adını, əyarını, çəkisini və qiymətini yazın və ya bu addımı keçib sonra əlavə edin.          | ad, kateqoriya, əyar, çəki, qiymət                                                                   |
| Son   | Təbrik ekranı | Yoxlamanın vəziyyəti və "Kabinetə keç" düyməsi.                                                           | yoxdur                                                                                               |

Qeyd: "məhsul dərc olunur" satıcının öz əlində deyil. Sihirbazdakı məhsul qaralama kimi saxlanılır,
şəkli kabinetdə əlavə olunur, sonra admin mağazanı və məhsulu yoxlayır. Buna görə e2e testi
"5 dəqiqədən az" həddini ölçmür: vaxtı yalnız insanlarla test göstərə bilər (bölmə 5).

## 3. Bu işdə nə dəyişdi

**Axın**

- Mağazalar səhifəsində şəhər seçiləndə siyahı dərhal yenilənir; "Axtar" düyməsi yalnız ad ilə
  axtarış üçün qalır. Addım sayı 3-dən 2-yə düşdü.

**Sadə dil (az, en, ru)**

- Alıcının gördüyü mətnlərdə "variant" sözü çıxarıldı: "Variant seçin" əvəzinə "Ölçü və çəki
  seçin", qiymət izahında "Seçim", müqayisə və büdcə izahlarında adi sözlər. Məhsul kodu əvvəldən
  "Kod" kimi göstərilirdi ("SKU" alıcıya görünmürdü); "slug" yalnız admin panelindədir.
- Əyar və karat izahı olmadan göründüyü yerlərə qısa izah əlavə olundu: kataloq filtri (əyar və
  karat), müqayisə cədvəli, kalkulyator, satıcı sihirbazının "Əyar" sahəsi. Məhsul səhifəsində və
  mağaza səhifəsində izah düyməsi (`TermHint`) əvvəldən var idi.

**Boş və xəta vəziyyətləri**

- Mağaza tapılmayanda: nə baş verdiyi və nə etmək lazım olduğu yazılır (adı qısalt, başqa şəhər
  seç, bütün mağazalara bax).
- Axtarış pəncərəsi: "heç nə tapılmadı" və "axtarış alınmadı" mətnləri növbəti addımı deyir.
- Seçilmişlər və müqayisə siyahısı yüklənməyəndə, link kopyalanmayanda, bugünkü metal qiyməti
  hələ gəlməyəndə, satıcının məhsul axtarışı boş olanda və bildiriş olmayanda mətnlər eyni qayda
  ilə tamamlandı.

**Satıcı**

- Kabinetə ilk girişdə 3 addımlıq bələdçi: mağaza məlumatları, ilk məhsul, linki paylaşmaq.
  "Aydındır, bağla" düyməsi ilə bağlanır və həmin brauzerdə bir daha göstərilmir (tətbiqi
  quraşdırma kartı kimi, `localStorage`-də saxlanılır; ayrı hissə kimi yalnız lazım olanda
  yüklənir).
- Sihirbazın hər addımındakı cümlə nə etməli olduğunu deyir (əvvəl yalnız addımın nə üçün
  olduğunu deyirdi).
- Nümunə dəyərlər: ad, mağaza adı, ünvan, VÖEN və məhsul adı sahələrində; kabinetin profil
  formasında mağaza adı və ünvan sahələrində. Telefon, çəki və qiymət sahələrində nümunə əvvəldən
  var idi.
- Bir ekranda bir əsas düymə: məhsulu olmayan satıcının panelində "Yeni məhsul" düyməsi iki dəfə
  görünürdü (başlıqda və boş vəziyyətdə); indi bir dəfədir.

**Əlçatanlıq (axe ölçmə zamanı tapdı)**

- Telefonda sihirbazın addım göstəricisində bitmiş addımın düyməsinin adı yox idi (yalnız işarə
  görünürdü) və 32px idi. İndi ekran oxuyucu addımın adını oxuyur, toxunma sahəsi 44px-dir. Eyni
  göstərici kabinetin məhsul formasında da işlədilir.

## 4. Açıq qalan problemlər (ayrı issue üçün)

Bunlar audit zamanı tapılıb, bu işdə düzəldilməyib:

1. Telefonda menyudan "Mağazalar"a getmək ana səhifədəki düymədən bir toxunuş çoxdur (3 addım).
   Telefon menyusunda və ya ana səhifədə şəhərlərin birbaşa linkləri bunu həll edərdi.
2. Satıcı kabinetinin məhsul formasında "variant" sözü qalır ("Metal və variantlar", "Variant
   əlavə et"). Forma başqa işdə dəyişdirildiyi üçün toxunulmadı; satıcı üçün "ölçü/çəki seçimi"
   kimi sadə söz seçilməlidir.
3. Sihirbazda yaradılan ilk məhsul şəkilsiz qaralamadır; satıcı kabinetdə onu yenidən açıb şəkil
   əlavə etməli və yoxlamaya göndərməlidir. Təbrik ekranında bu qaralamaya birbaşa link yoxdur.
4. "5 dəqiqədən az" həddi avtomatik ölçülmür; real vaxt yalnız aşağıdakı testdə görünəcək.
5. Bələdçinin bağlanması brauzerdə saxlanılır, hesabda yox: satıcı başqa cihazdan girəndə bələdçini
   bir dəfə də görəcək.
6. Axtarış pəncərəsindəki kamera və bağlama düymələri 32px-dir (telefonda 44px-dən kiçik).

## 5. İnsanlarla test: protokol (sahib aparır)

### Kimlər

- 5 alıcı və 3 satıcı. Ən azı ikisi texnologiyaya az bələd olmalıdır (məsələn, internetdən
  alış-veriş etməyən və ya yalnız WhatsApp işlədən adam).
- Satıcılar: zərgərlik və ya bijuteriya satan, Jeparla-nı əvvəl görməmiş adamlar.
- Hər iştirakçı ayrıca, öz telefonunda (ən azı bir alıcı və bir satıcı kompüterdə).

### Şəxsi məlumat

- Ad, telefon, şəkil, səs və ekran yazısı bu fayla və repoya yazılmır.
- İştirakçılar A1-A5 (alıcı) və S1-S3 (satıcı) kimi qeyd olunur.
- Yazıla bilən yeganə məlumat: cihaz (telefon və ya kompüter) və texnologiyaya bələdlik (az, orta,
  yaxşı).
- Satıcı testi real qeydiyyat yaratmasın deyə nümunə rejimində (sınaq ünvanında) aparılır; real
  VÖEN və sənəd istifadə olunmur.

### Necə aparılır

1. Müşahidəçi tapşırığı ucadan oxuyur və saniyəölçəni işə salır.
2. İştirakçı fikrini ucadan deyir. Müşahidəçi kömək etmir və istiqamət vermir.
3. İştirakçı 2 dəqiqə irəliləyə bilmirsə, müşahidəçi bir ipucu verir və tapşırıq "köməklə" kimi
   qeyd olunur.
4. Tapşırıq bitəndə: vaxt, köməksiz olub-olmadığı, çaşdığı yerlər və dediyi sözlər yazılır.
5. Sonda iki sual: "Ən çətin nə idi?" və "Nəyi dəyişərdiniz?".

### Alıcı tapşırıqları

| Kod | Tapşırıq (iştirakçıya oxunur)                                                                           | Uğur meyarı                                             |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| T1  | "Qızıl üzük almaq istəyirsiniz. Bəyəndiyiniz birini tapın və mağazaya WhatsApp ilə yazmağa hazırlaşın." | WhatsApp düyməsinə çatır (mesajı göndərmək lazım deyil) |
| T2  | "Gəncədə (və ya öz şəhərinizdə) hansı mağazalar var? Birinin ünvanını tapın."                           | Şəhər üzrə siyahını və bir mağazanın ünvanını göstərir  |
| T3  | "Bu üzüyün əyarı nə deməkdir? Saytda izahını tapın."                                                    | Əyar izahını oxuyur və öz sözləri ilə deyir             |
| T4  | "500 manata qədər sırğa tapın."                                                                         | Qiymət filtri və ya büdcə linki ilə uyğun məhsula çatır |

### Satıcı tapşırıqları

| Kod | Tapşırıq (iştirakçıya oxunur)                                 | Uğur meyarı                                             |
| --- | ------------------------------------------------------------- | ------------------------------------------------------- |
| T5  | "Mağazanızı Jeparla-da açın."                                 | Sihirbazın dörd addımını bitirir, təbrik ekranını görür |
| T6  | "Kabinetə keçin və bir məhsul əlavə edib yoxlamaya göndərin." | Məhsul "Yoxlamada" statusuna keçir                      |
| T7  | "Mağazanızın linkini müştəriyə göndərmək üçün tapın."         | Paylaşma səhifəsində linki kopyalayır                   |

### Nə qeyd olunur

- Vaxt (saniyə), tapşırığın sonuna qədər.
- Nəticə: köməksiz, köməklə, tamamlanmadı.
- Çaşqınlıq nöqtələri: hansı ekranda dayandı, nəyi axtardı, hansı sözü başa düşmədi.
- Səhv toxunuşlar: geri qayıtdığı və ya yanlış yerə basdığı hallar.
- T5 və T6 üçün ayrıca: qeydiyyatın başlanğıcından məhsulun yoxlamaya göndərilməsinə qədər ümumi
  vaxt (hədəf: telefonda 5 dəqiqədən az).

### Nəticə cədvəli: alıcılar (sahib doldurur)

| İştirakçı | Cihaz | Bələdlik | T1 vaxt | T1 nəticə | T2 vaxt | T2 nəticə | T3 vaxt | T3 nəticə | T4 vaxt | T4 nəticə | Çaşqınlıq nöqtələri |
| --------- | ----- | -------- | ------- | --------- | ------- | --------- | ------- | --------- | ------- | --------- | ------------------- |
| A1        |       |          |         |           |         |           |         |           |         |           |                     |
| A2        |       |          |         |           |         |           |         |           |         |           |                     |
| A3        |       |          |         |           |         |           |         |           |         |           |                     |
| A4        |       |          |         |           |         |           |         |           |         |           |                     |
| A5        |       |          |         |           |         |           |         |           |         |           |                     |

### Nəticə cədvəli: satıcılar (sahib doldurur)

| İştirakçı | Cihaz | Bələdlik | T5 vaxt | T5 nəticə | T6 vaxt | T6 nəticə | T7 vaxt | T7 nəticə | T5 + T6 ümumi vaxt | Çaşqınlıq nöqtələri |
| --------- | ----- | -------- | ------- | --------- | ------- | --------- | ------- | --------- | ------------------ | ------------------- |
| S1        |       |          |         |           |         |           |         |           |                    |                     |
| S2        |       |          |         |           |         |           |         |           |                    |                     |
| S3        |       |          |         |           |         |           |         |           |                    |                     |

### Yekun (sahib doldurur)

| Tapşırıq | Köməksiz tamamlayanlar | Hədəf        | Keçdi? |
| -------- | ---------------------- | ------------ | ------ |
| T1       | / 5                    | ən azı 4 / 5 |        |
| T2       | / 5                    | ən azı 4 / 5 |        |
| T3       | / 5                    | ən azı 4 / 5 |        |
| T4       | / 5                    | ən azı 4 / 5 |        |
| T5       | / 3                    | 3 / 3        |        |
| T6       | / 3                    | 3 / 3        |        |
| T7       | / 3                    | 3 / 3        |        |

Qeyd: issue-dakı qəbul meyarı "iştirakçıların ən azı 4/5-i"dir. Üç satıcı üçün bu, üçünün də
köməksiz tamamlaması deməkdir (3-dən 2-si 4/5-dən azdır).

### Testdən sonra

- Hər tapılan problem ayrıca GitHub issue kimi açılır (Azərbaycan dilində, `design` və ya
  `accessibility` label-i ilə), bu fayla link verilir.
- Bu faylın cədvəlləri doldurulur və #176 bağlanır.
