# Jeparla brend səsi

Issue #50. Bu sənəd saytda, bildirişlərdə, e-poçtda və sosial şəbəkədə Jeparla adından yazılan
hər mətn üçündür. Qaydalar [CLAUDE.md](../../CLAUDE.md)-dəki dürüstlük qaydalarının davamıdır:
saxta rəy, saxta rəqəm və "100% zəmanət" yoxdur. Mətn kodda sərt yazılmır, `frontend/messages/`
(az, en, ru) faylındadır; yeni mətn həmişə üç dildə əlavə olunur.

## Dörd söz

| Söz       | Nə deməkdir                                                                    | Nə deyil                          |
| --------- | ------------------------------------------------------------------------------ | --------------------------------- |
| Sakit     | Qısa cümlə, nida işarəsi yox, tələsdirmə yox                                   | Soyuq, rəsmi, bürokratik          |
| Dürüst    | Yalnız yoxlanılan faktı deyirik; bilmədiyimizi "məlum deyil" kimi yazırıq      | Hər şeyi gözəl göstərmək          |
| Dəqiq     | Əyar, çəki, qiymət və tarix rəqəmlə, mənbə ilə (AMB məzənnəsi, yoxlama tarixi) | Texniki jarqon, izahsız qısaltma  |
| Səmimi    | Alıcıya "siz" deyə müraciət, kömək təklif edən ton                             | Laqeyd və ya həddən artıq şirin   |

Alt yazı (issue #50): **Zərgərlik. Etibar. Texnologiya.** Loqonun yanında yalnız böyük
ölçüdə (OG şəkli, təqdimat) istifadə olunur, saytın başlığında yox.

## Ümumi qaydalar

- Müraciət "siz"-dir. Düymələrdə əmr forması qısa və neytral: "Kataloqa baxın", "Mağazaya yazın".
- Bir cümlə, bir fikir. Ekranda nə qədər az söz, o qədər yaxşı.
- Nida işarəsi yalnız salamlaşmada ("Salam!" WhatsApp mesajında). Başqa yerdə yoxdur.
- Rəqəm həmişə vahidlə: "3,2 q", "585 əyar", "126,40 ₼". Ondalıq ayırıcı az/ru-da vergül, en-də nöqtə.
- Qiymət metala bağlıdırsa, bunu deyirik: "Qiymət bu günün AMB məzənnəsi ilə hesablanıb."
- Yoxlanılmayan məlumata "yoxlanılıb" demirik. Satıcının sözü ilə yoxlanılmış fakt ayrı göstərilir.
- AI ilə yaradılmış məhsul şəkli həmişə işarələnir: "Şəkil AI ilə yaradılıb."
- Xəta mətni üç şeyi deyir: nə olub, niyə (bilirsiksə), indi nə etmək olar. Günahı istifadəçiyə yükləmirik.
- Emoji yoxdur (UI, e-poçt, sosial şəbəkə daxil). İkon lazımdırsa, `lucide-react` ([icons.md](./icons.md)).
- Brendin adı həmişə **Jeparla**: tərcümə olunmur, kiril hərfi ilə yazılmır; şəkilçi defislə qoşulur
  ("Jeparla-da", "Jeparla-nın"; saytdakı mövcud forma).

## Sözlər: işlədirik / işlətmirik

| İşlədirik                                 | İşlətmirik                                    | Səbəb                                   |
| ----------------------------------------- | --------------------------------------------- | --------------------------------------- |
| yoxlanılıb, sənəd yoxlanılıb              | 100% zəmanət, tam zəmanətli, saxta deyil      | Zəmanəti mağaza verir, biz yox          |
| əyar, 585 əyar, 750 əyar                  | "xalis qızıl" (əyar göstərilmədən)            | Dəqiqlik                                |
| bijuteriya                                | "qızıl kimi", "qızıla bənzər"                 | Aldatmamaq; kateqoriya açıq yazılır     |
| mağazaya yazın, WhatsApp ilə yazın        | indi al, tələsin, son şans                    | Saytda satış yoxdur, təzyiq yoxdur      |
| bu günün qiyməti, AMB məzənnəsi ilə       | ən ucuz, ən yaxşı qiymət                      | Yoxlanılmayan müqayisə                  |
| Azərbaycanın zərgərlik mağazaları         | bir nömrəli, lider, ən böyük platforma        | Sübut olmadan üstünlük iddiası          |
| məlum deyil, mağaza göstərməyib           | boş saxlamaq və ya təxmin yazmaq              | Bilmədiyimizi gizlətmirik               |
| zərgərlik, məmulat, model                 | lüks, eksklüziv, premium (məzmunsuz)          | Boş sifət, heç nə demir                 |
| şəkil AI ilə yaradılıb                    | AI şəklini real foto kimi göstərmək           | CLAUDE.md dürüstlük qaydası             |

## Nümunə sətirlər

Mövcud mətnlər (`frontend/messages/az.json`) bu səsə uyğundur; yenilər onların yanında yazılır.

### Düymələr

| az                          | en                        | ru                                |
| --------------------------- | ------------------------- | --------------------------------- |
| Kataloqa baxın              | Browse the catalog        | Смотреть каталог                  |
| WhatsApp ilə mağazaya yazın | Message the store on WhatsApp | Написать магазину в WhatsApp  |
| Seçilmişlərə əlavə et       | Save                      | В избранное                       |
| Mağaza aç                   | Open a store              | Открыть магазин                   |
| Şəkillə axtar               | Search by photo           | Поиск по фото                     |

### Boş vəziyyətlər

| az                                                                   | en                                                         | ru                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Bu filtrlərlə məhsul tapılmadı. Bəzi filtrləri silin.               | No pieces match these filters. Try removing a few.         | По этим фильтрам ничего нет. Уберите часть фильтров.           |
| Seçilmişlərdə hələ heç nə yoxdur. Bəyəndiyiniz modeli ürək ilə saxlayın. | Nothing saved yet. Tap the heart to keep a piece here. | В избранном пока пусто. Нажмите на сердце, чтобы сохранить. |
| Mağazanın hələ aktiv məhsulu yoxdur.                                 | This store has no live pieces yet.                         | У магазина пока нет активных изделий.                          |

### Xətalar

| az                                                              | en                                                      | ru                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Bağlantı alınmadı. İnterneti yoxlayıb yenidən cəhd edin.        | Couldn't connect. Check your internet and try again.    | Нет соединения. Проверьте интернет и попробуйте снова.       |
| Şəkil oxunmadı: JPEG, PNG və ya WebP seçin.                     | Couldn't read the photo. Choose a JPEG, PNG or WebP.    | Не удалось прочитать фото. Выберите JPEG, PNG или WebP.      |
| Bugünkü məzənnə hələ gəlməyib. Qiymət dünənki məzənnə ilədir.   | Today's rate isn't in yet. Prices use yesterday's rate. | Курс на сегодня ещё не пришёл. Цены по вчерашнему курсу.     |

### Məhsul və etibar mətnləri

| az                                                         | en                                                     | ru                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| Əyar və çəki mağazanın sənədi ilə yoxlanılıb.              | Purity and weight checked against the store's papers.  | Проба и вес сверены с документами магазина.                |
| Çəki: mağaza göstərməyib.                                  | Weight: not given by the store.                        | Вес: магазин не указал.                                    |
| Şəkil AI ilə yaradılıb.                                    | Image made with AI.                                    | Изображение создано с помощью ИИ.                          |

### Instagram yazıları

Qısa, bir fikir, bir faktla. Sonda bir hərəkət. Haşteq 3-5, emoji yoxdur.

- az: "585 əyar, 3,2 qram, Bakıdan bir mağaza. Qiyməti bu günün məzənnəsi ilə saytdadır. Keçid profildə."
- az: "Bu həftə {N} yeni mağaza qoşuldu. Hamısının sənədi yoxlanılıb." ({N} bazadakı həqiqi say; hamısı yoxlanılmayıbsa, ikinci cümlə yazılmır)
- az: "Üzük ölçünüzü bilmirsiniz? Evdə sap ilə ölçmək üçün bələdçi saytda."
- en: "585 gold, 3.2 grams, from a store in Baku. Today's price is on the site. Link in bio."
- ru: "Золото 585 пробы, 3,2 грамма, магазин в Баку. Цена по сегодняшнему курсу на сайте. Ссылка в профиле."

Instagram-da Jeparla yalnız öz hesabından yazır; mağazanın adı və şəkli onun icazəsi ilə paylaşılır.
Rəqəm (mağaza sayı, məhsul sayı, baxış) yalnız bazadan götürülür, yuvarlaqlaşdırılıb şişirdilmir.

## Dil qeydləri

- **en:** sadə, Britaniya/Amerika fərqi önəmli deyil, amma bir mətndə qarışmır ("catalog" saytda
  işlənən formadır). "Jewelry" yox, mümkün olduqda "pieces" (təkrardan qaçmaq üçün). Sentence case:
  düymələr və başlıqlar böyük hərflə yalnız başlayır.
- **ru:** "вы" kiçik hərflə (sayt mətni, məktub deyil). "Проба" əyar üçün, "изделие" məhsul üçün.
  Azərbaycan adları (mağaza, şəhər) tərcümə edilmir, transliterasiya olunmur.
- **az:** Ə, ı, ş, ç, ğ, ö, ü hərfləri həmişə düzgün; "e", "i", "s" ilə əvəz edilmir. Rəsmi
  dildən ("həyata keçirilir", "təqdim olunur") qaçırıq, danışıq dilinə yaxın, amma jarqonsuz.
