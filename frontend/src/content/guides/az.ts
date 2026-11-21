import type { GuideTexts } from "./types";

export const az: GuideTexts = {
  "585-vs-750-gold": {
    title: "585 və 750 əyar qızıl: fərq nədir",
    description:
      "Qızıl zərgərlikdəki 585 və 750 rəqəmləri nə deməkdir, 14 və 18 karata necə uyğun gəlir və alıcı üçün nə dəyişir.",
    answer:
      "Bu rəqəm əyardır: ərintinin kütləcə hər 1000 hissəsində neçə hissə xalis qızıl olduğunu göstərir. 585 əyar qızılın 58,5%-i, 750 əyar qızılın isə 75%-i xalis qızıldır, qalanı başqa metallardır. Eyni çəkidə 750 əyarlı məmulatda 585 əyarlıdan daha çox qızıl olur, ona görə də metalın dəyəri daha yüksəkdir.",
    sections: [
      {
        id: "fineness",
        title: "Rəqəm nəyi göstərir",
        blocks: [
          {
            type: "p",
            text: "Zərgərlik qızılı ərintidir: xalis qızıl başqa metallarla qarışdırılır. Əyar (min hissəlik sistem) xalis qızılın payını kütləcə mində bir hissələrlə göstərir. 585 damğası hər 1000 hissədən 585-inin qızıl olduğunu, 750 isə 750-sinin qızıl olduğunu bildirir.",
          },
          {
            type: "p",
            text: "Karat sistemi eyni şeyi 24 hissə ilə ifadə edir. 750 əyar 18 karatdır (18/24 = 75%). 585 əyar 14 karata uyğundur: 14/24 = 58,33%, praktikada isə 585 damğası işlənir. 999 əyar demək olar ki, başqa metal qatılmamış qızıldır və 24 karat da adlanır.",
          },
        ],
      },
      {
        id: "how-much-gold",
        title: "Məmulatda nə qədər qızıl var",
        blocks: [
          {
            type: "p",
            text: "Çəkini əyarın 1000-ə bölünməsinə vurun. Məsələn, 4 qramlıq üzük üçün:",
          },
          {
            type: "ul",
            items: [
              "585 əyar: 4 × 0,585 = 2,34 q xalis qızıl",
              "750 əyar: 4 × 0,750 = 3,00 q xalis qızıl",
            ],
          },
          {
            type: "p",
            text: "Bu nümunə yalnız hesablamanı göstərir; real məmulatın çəkisi məhsul səhifəsində və qəbzdə yazılır.",
          },
        ],
      },
      {
        id: "what-changes",
        title: "Alıcı üçün nə dəyişir",
        blocks: [
          {
            type: "ul",
            items: [
              "Metalın dəyəri: ərintinin qram qiyməti əyarla mütənasibdir, ona görə də 750 əyarın bir qramı 585 əyarın bir qramından bahadır.",
              "Möhkəmlik: zərgərliyi daha bərk və davamlı etmək üçün qızıla başqa metallar qatılır.",
              "Rəng: ərintidəki digər metallar rəngi də dəyişir, buna görə eyni əyar sarı, ağ və ya qırmızı qızıl ola bilər.",
            ],
          },
        ],
      },
      {
        id: "choosing",
        title: "Necə seçmək olar",
        blocks: [
          {
            type: "p",
            text: "Yaxşı və ya pis əyar yoxdur, sadəcə qızılın payı fərqlidir. Büdcəyə, rəngə və məmulatı necə taxacağınıza görə seçin. Satın almadan əvvəl məmulatın üzərindəki əyarın təsvirdəki əyarla eyni olduğunu yoxlayın və mağazadan metalı, əyarı və çəkini göstərən qəbz istəyin.",
          },
          {
            type: "links",
            items: [
              { label: "Qızılın qiyməti necə hesablanır", href: "/guides/gold-price-calculation" },
              { label: "Əyar damğasını necə yoxlamaq olar", href: "/guides/hallmark-check" },
            ],
          },
        ],
      },
    ],
  },

  "gold-price-calculation": {
    title: "Qızılın qiyməti necə hesablanır",
    description:
      "Mərkəzi Bankın rəsmi metal məzənnəsindən məmulatın qiymətinə qədər: qram qiyməti, əyar, çəki, işçilik və mağazanın əlavəsi.",
    answer:
      "Qiymətin metal hissəsi bir qram xalis qızılın qiymətindən başlayır. Bu qiymət əyara (məsələn, 585/1000) və məmulatın çəkisinə vurulur. Sonra mağaza işçilik, daş və öz əlavəsini əlavə edir, ona görə də yekun qiyməti həmişə mağaza təsdiqləyir.",
    sections: [
      {
        id: "source",
        title: "Qızılın qiyməti haradan gəlir",
        blocks: [
          {
            type: "p",
            text: "Azərbaycan Respublikasının Mərkəzi Bankı (AMB) manatın rəsmi məzənnələrini dərc edir. Siyahıda bank metalları da var: qızıl (XAU), gümüş (XAG), platin (XPT) və palladium (XPD), hər biri bir troy unsiyası üçün.",
          },
          {
            type: "p",
            text: "Bir troy unsiyası 31,1034768 qramdır. Deməli, bir qram xalis metalın qiyməti unsiya qiymətinin 31,1034768-ə bölünməsinə bərabərdir.",
          },
        ],
      },
      {
        id: "alloy",
        title: "Xalis qızıldan ərintiyə",
        blocks: [
          {
            type: "p",
            text: "Zərgərlik ərintidən hazırlanır, ona görə də qram qiyməti əyara görə düzəldilir:",
          },
          {
            type: "ul",
            items: [
              "ərintinin qram qiyməti = xalis qızılın qram qiyməti × əyar / 1000",
              "585 əyar üçün bu, xalis qram qiyməti × 0,585, 750 əyar üçün × 0,750 deməkdir",
            ],
          },
        ],
      },
      {
        id: "piece",
        title: "Məmulatın qiyməti",
        blocks: [
          { type: "p", text: "Hazır məmulatın qiyməti bir neçə hissədən ibarətdir:" },
          {
            type: "ol",
            items: [
              "Metal: qramla çəki × ərintinin qram qiyməti.",
              "İşçilik: məmulatın hazırlanması, qram başına və ya sabit məbləğ kimi.",
              "Daşlar (varsa): qiyməti mağaza müəyyən edir; brilyant üçün rəsmi gündəlik məzənnə yoxdur.",
              "Mağazanın əlavəsi.",
            ],
          },
          {
            type: "p",
            text: "Buna görə eyni çəkidə və eyni əyarda iki məmulatın qiyməti fərqli ola bilər: işçilik, dizayn, daşlar və əlavə mağazadan mağazaya dəyişir.",
          },
        ],
      },
      {
        id: "on-jeparla",
        title: "Jeparla-da necə işləyir",
        blocks: [
          {
            type: "p",
            text: "Jeparla gündəlik metal məzənnələrini AMB-dən götürür və geniş yayılmış əyarlar üçün qram qiymətini məzənnənin tarixi ilə göstərir. Mağaza qiyməti metal məzənnəsinə bağlaya bilər: onda yeni məzənnə gələndə metal hissəsi avtomatik yenidən hesablanır, işçilik, daş və əlavə isə mağazanın təyin etdiyi kimi qalır.",
          },
          {
            type: "p",
            text: "Belə hesablanmış qiymət AMB-nin gündəlik metal məzənnəsinə əsasən təxminidir; yekun qiyməti mağaza təsdiqləyir.",
          },
          {
            type: "links",
            items: [
              { label: "Jeparla-da bu günün metal qiymətləri", href: "/#metal-prices" },
              { label: "AMB-nin rəsmi məzənnələri", href: "https://www.cbar.az/currency/rates" },
              { label: "585 və 750 əyar qızıl: fərq nədir", href: "/guides/585-vs-750-gold" },
            ],
          },
        ],
      },
    ],
  },

  "diamond-4c": {
    title: "Brilyantın 4C-si",
    description:
      "Kəsim, rəng, təmizlik və karat çəkisi: brilyant keyfiyyətinin dörd göstəricisi nə deməkdir və necə oxunur.",
    answer:
      "4C brilyantın keyfiyyətini təsvir edən dörd göstəricidir: kəsim (cut), rəng (color), təmizlik (clarity) və karat çəkisi (carat). GIA öz qiymətləndirmə sistemində bunlardan istifadə edir. Karat ölçü deyil, çəkidir: bir karat 0,2 qramdır.",
    sections: [
      {
        id: "cut",
        title: "Kəsim (cut)",
        blocks: [
          {
            type: "p",
            text: "Kəsim daşın proporsiyalarının, simmetriyasının və cilasının işığı necə qaytardığını təsvir edir. Brilyantın parlaqlığı, rəng oyunu və bərqi bundan asılıdır. Kəsim dərəcəsi forma ilə eyni deyil: həm dairəvi, həm oval daş yaxşı və ya zəif kəsilə bilər.",
          },
        ],
      },
      {
        id: "color",
        title: "Rəng (color)",
        blocks: [
          {
            type: "p",
            text: "Rəng D-dən Z-ə qədər şkala ilə qiymətləndirilir: rəngsizdən (D) açıq sarı və ya qəhvəyiyə (Z) qədər. Mütəxəssislər daşı rəngi məlum olan etalon daşlarla müqayisə edir. Rəngsiz daşlar nadirdir, buna görə ən yüksək qiymətləndirilən dərəcə D-dir.",
          },
        ],
      },
      {
        id: "clarity",
        title: "Təmizlik (clarity)",
        blocks: [
          {
            type: "p",
            text: "Təmizlik daxili qüsurların (daxilolmaların) və səth qüsurlarının nisbətən az olmasıdır. GIA şkalasında 11 dərəcə var:",
          },
          {
            type: "ul",
            items: [
              "FL: qüsursuz (Flawless)",
              "IF: daxili qüsursuz (Internally Flawless)",
              "VVS1, VVS2: çox, çox az daxilolma (Very, Very Slightly Included)",
              "VS1, VS2: çox az daxilolma (Very Slightly Included)",
              "SI1, SI2: az daxilolma (Slightly Included)",
              "I1, I2, I3: daxilolmalı (Included)",
            ],
          },
        ],
      },
      {
        id: "carat",
        title: "Karat çəkisi (carat)",
        blocks: [
          {
            type: "p",
            text: "Metrik karat 0,2 qramdır. Bir karat 100 pointə bölünür, ona görə də 0,50 karatlıq daşa 50 pointlik daş da deyilir. Karat çəkidir: eyni çəkidə iki daş kəsimindən asılı olaraq ölçücə fərqli görünə bilər.",
          },
        ],
      },
      {
        id: "buying",
        title: "Alarkən 4C-dən necə istifadə etməli",
        blocks: [
          {
            type: "ul",
            items: [
              "Dörd göstəriciyə birlikdə baxın; onlardan yalnız biri daşı təsvir etmir.",
              "Daşın gemoloji laboratoriya sertifikatı varsa, mağazadan onu istəyin və məlumatların təsvirlə uyğun gəldiyini yoxlayın.",
              "Jeparla-da məhsul səhifəsindəki daş məlumatlarını mağaza daxil edir; satın almadan əvvəl onları mağaza ilə dəqiqləşdirin.",
            ],
          },
          {
            type: "links",
            items: [{ label: "Əyar damğasını necə yoxlamaq olar", href: "/guides/hallmark-check" }],
          },
        ],
      },
    ],
  },

  "hallmark-check": {
    title: "Əyar damğasını necə yoxlamaq olar",
    description:
      "Qızıl və gümüş zərgərlikdə əyar damğası nədir, onu harada axtarmalı, satın almadan əvvəl nəyi yoxlamalı və damğa nəyi göstərmir.",
    answer:
      "Əyar damğası qiymətli metaldan hazırlanmış məmulatın üzərinə vurulan nişanlar toplusudur. Əvvəlcə əyar rəqəmini tapın: məsələn, qızıl üçün 585 və ya 750, gümüş üçün 925. O, adətən üzüyün daxili tərəfində, qıfılda və ya sırğanın ilməyində olur. Rəqəmin təsvirdəki əyarla eyni olduğunu yoxlayın və qəbz istəyin. Damğa bəyan olunanı göstərir; metalın faktiki tərkibini yalnız analiz müəyyən edə bilər.",
    sections: [
      {
        id: "what",
        title: "Əyar damğası nədir",
        blocks: [
          {
            type: "p",
            text: "Damğa adətən bir neçə kiçik nişandan ibarət olur. Qiymətli metallardan məmulatlara nəzarət və damğalanma haqqında beynəlxalq Konvensiyanın (Hallmarking Convention) üzvü olan ölkələrdə Konvensiya üzrə damğalanmış məmulatda bunlar olur:",
          },
          {
            type: "ul",
            items: [
              "istehsalçının və ya sifarişçinin məsuliyyət nişanı;",
              "əyar nişanı;",
              "milli əyar idarəsinin nişanı;",
              "Ümumi Nəzarət Nişanı (Common Control Mark); Konvensiya onu məmulatın sərhədləri keçməsinə imkan verən pasport adlandırır.",
            ],
          },
          {
            type: "p",
            text: "Hər ölkənin öz nişan dizaynı var, ona görə də bu bələdçidə onlar göstərilmir. Axtarılmalı olan ümumi element əyar rəqəmidir.",
          },
        ],
      },
      {
        id: "where",
        title: "Harada axtarmalı",
        blocks: [
          {
            type: "ul",
            items: [
              "Üzük: halqanın daxili tərəfində.",
              "Zəncir və ya qolbaq: qıfılın üzərində və ya onun yanındakı kiçik lövhəcikdə.",
              "Sırğa: ilməkdə, qarmaqda və ya bərkidicidə.",
              "Asma: asqısında və ya arxa tərəfində.",
            ],
          },
          { type: "p", text: "Nişanlar kiçikdir; böyüdücü şüşə və yaxşı işıq kömək edir." },
        ],
      },
      {
        id: "check",
        title: "Satın almadan əvvəl nəyi yoxlamalı",
        blocks: [
          {
            type: "ol",
            items: [
              "Məmulatın üzərindəki əyar rəqəmi təsvirdəki əyarla eynidir.",
              "Qəbzdəki çəki təsvirdəki çəki ilə eynidir.",
              "Qəbzdə metal, əyar və çəki göstərilib.",
              "Nişan yoxdursa və ya oxunmursa, ödəniş etməzdən əvvəl mağazadan soruşun.",
            ],
          },
        ],
      },
      {
        id: "azerbaijan",
        title: "Azərbaycanda",
        blocks: [
          {
            type: "p",
            text: "Azərbaycanda dövlət əyar nəzarəti sistemi var. 2026-cı ilin iyulunda Azərbaycan Respublikasının Prezidenti yanında Antiinhisar və İstehlak Bazarına Nəzarət Dövlət Agentliyi zərgərlik satıcılarına dövlət əyar nəzarətinin necə tətbiq olunduğunu və əyar damğası olmadan qiymətli metal məmulatlarının satışa çıxarılmasına görə qanunvericiliklə müəyyən edilmiş məsuliyyəti izah edib (AZƏRTAC xəbəri, mənbələrə baxın).",
          },
        ],
      },
      {
        id: "limits",
        title: "Damğa nəyi göstərmir",
        blocks: [
          {
            type: "p",
            text: "Əyar damğası yalnız metala aiddir. Daşların keyfiyyəti haqqında heç nə demir; brilyant üçün 4C-yə və laboratoriya sertifikatına baxın. Ev üsulları əyarı ölçə bilməz: şübhə varsa, ixtisaslaşmış laboratoriyada analiz etdirin.",
          },
          {
            type: "links",
            items: [
              { label: "Brilyantın 4C-si", href: "/guides/diamond-4c" },
              { label: "585 və 750 əyar qızıl: fərq nədir", href: "/guides/585-vs-750-gold" },
            ],
          },
        ],
      },
    ],
  },

  "silver-jewelry-care": {
    title: "Gümüş zərgərliyə qulluq",
    description:
      "Gümüş niyə qaralır, daha az qaralması üçün necə saxlamalı, necə ehtiyatla təmizləməli və hansı üsullar metalı aşındırır.",
    answer:
      "Gümüş havadakı kükürd birləşmələri onun səthində nazik qara gümüş sulfid təbəqəsi yaratdığı üçün qaralır. Bunu yavaşlatmaq üçün zərgərliyi təmiz və quru saxlayın, hər məmulatı ağzı bağlı ayrıca polietilen paketdə qoyun. Yalnız lazım olanda gümüş üçün parça ilə ehtiyatla cilalayın: hər cilalama bir az gümüşü aparır.",
    sections: [
      {
        id: "why",
        title: "Gümüş niyə qaralır",
        blocks: [
          {
            type: "p",
            text: "Qaralma əsasən qara gümüş sulfiddir. O, gümüş havadakı hidrogen sulfid kimi kükürdlü birləşmələrlə reaksiyaya girəndə yaranır. Dərinin duzları və yağları da iz qoya bilər. Zərgərlik gümüşü adətən 925 əyarlı ərintidir: 92,5% gümüş və 7,5% başqa metallar, adətən mis.",
          },
        ],
      },
      {
        id: "storage",
        title: "Saxlama",
        blocks: [
          {
            type: "ul",
            items: [
              "Zərgərliyi təmiz və quru halda yığışdırın.",
              "Hər məmulatı ayrıca polietilen paketə qoyub ağzını bağlayın; bu, kükürd birləşmələri olan havanın qarşısını alır.",
              "Qaralmaya səbəb olan qazları udan, içində gümüş hissəcikləri olan parçalar xüsusilə effektivdir.",
              "Az rütubət kömək edir; qutuya qoyulmuş silikagel paketi nəmi çəkir.",
            ],
          },
        ],
      },
      {
        id: "everyday",
        title: "Hər gün",
        blocks: [
          {
            type: "p",
            text: "Taxdıqdan sonra yığışdırmazdan əvvəl məmulatı yumşaq, quru parça ilə silib dərinin duzlarını və yağlarını təmizləyin.",
          },
        ],
      },
      {
        id: "cleaning",
        title: "Ehtiyatlı təmizləmə",
        blocks: [
          {
            type: "ol",
            items: [
              "Bir az yumşaq yuyucu vasitə qatılmış suda yuyun.",
              "Təmiz su ilə yaxalayın.",
              "Yumşaq parça ilə tam qurulayın.",
            ],
          },
          {
            type: "p",
            text: "Daşlı, mirvarili, yapışdırılmış və ya metal olmayan hissələri olan məmulatları suda saxlamayın; onları necə təmizləməyi mağazadan soruşun.",
          },
        ],
      },
      {
        id: "polishing",
        title: "Cilalama və nədən çəkinməli",
        blocks: [
          {
            type: "ul",
            items: [
              "Cilalama vasitələri aşındırıcıdır: qaralma ilə birlikdə bir az gümüşü də aparır, ona görə yalnız lazım olanda cilalayın.",
              "Gümüşdə bütün metallar üçün nəzərdə tutulmuş universal cilalama vasitələrindən istifadə etməyin.",
              "Kimyəvi məhlullar gümüşü həddindən artıq təmizləyə bilər və korroziyaya səbəb olur; içi boş, bağlı hissələri olan məmulatlarda onlardan heç vaxt istifadə etməyin.",
              "Alüminium və soda üsulu səthdə çuxurcuqlar yarada bilər və çox vaxt tutqun səth qoyur; bundan sonra gümüş daha tez qarala bilər.",
              "Məmulat örtüklüdürsə və ya qəsdən qaraldılıbsa, cilalamazdan əvvəl mağazadan soruşun: cilalama vasitələri və məhlullar səthə təsir edir.",
            ],
          },
          {
            type: "links",
            items: [{ label: "Əyar damğasını necə yoxlamaq olar", href: "/guides/hallmark-check" }],
          },
        ],
      },
    ],
  },

  "fineness-chart": {
    title: "Əyar cədvəli: qızıl, gümüş və platində 375-dən 999-a qədər",
    description:
      "Qızıl, gümüş, platin və palladium əyarları: hər rəqəm nə qədər xalis metal deməkdir və qızılın əyarı hansı karata uyğundur.",
    answer:
      "Əyar ərintinin hər 1000 hissəsində neçə hissə xalis metal olduğunu göstərir. Qızılda geniş yayılmış əyarlar 375 (9 karat), 585 (14 karat), 750 (18 karat), 916 (22 karat) və 999 (24 karat), gümüşdə isə 800, 925 və 999-dur. Rəqəm nə qədər böyükdürsə, ərintidə bir o qədər çox xalis metal var.",
    sections: [
      {
        id: "how-to-read",
        title: "Rəqəmi necə oxumalı",
        blocks: [
          {
            type: "p",
            text: "Əyar min hissəlik sistemdir: 925 rəqəmi kütləcə hər 1000 hissədən 925-inin xalis gümüş olduğunu bildirir, yəni 92,5%. Faizi tapmaq üçün əyarı 10-a bölmək kifayətdir.",
          },
          {
            type: "p",
            text: "Qızıl üçün ikinci sistem karatdır və 24 hissə ilə hesablanır: 24 karat demək olar ki, xalis qızıldır, 18 karat isə 18/24, yəni 75%-dir.",
          },
        ],
      },
      {
        id: "gold",
        title: "Qızıl",
        blocks: [
          {
            type: "table",
            caption: "Qızılın əyarı, xalis qızılın payı və karat qarşılığı",
            head: ["Əyar", "Xalis qızıl", "Karat"],
            rows: [
              ["375", "37,5%", "9"],
              ["585", "58,5%", "14"],
              ["750", "75%", "18"],
              ["916", "91,6%", "22"],
              ["999", "99,9%", "24"],
            ],
          },
          {
            type: "p",
            text: "14 karat dəqiq hesabla 583,3 əyar edir (14/24), amma damğada 585 işlənir. 22 karat 916 ilə, 24 karat isə adətən 999 ilə göstərilir.",
          },
        ],
      },
      {
        id: "silver",
        title: "Gümüş",
        blocks: [
          {
            type: "table",
            caption: "Gümüşün əyarı və xalis gümüşün payı",
            head: ["Əyar", "Xalis gümüş"],
            rows: [
              ["800", "80%"],
              ["925", "92,5%"],
              ["958", "95,8%"],
              ["999", "99,9%"],
            ],
          },
          {
            type: "p",
            text: "925 əyarlı gümüş ingilis dilində sterling silver adlanır. 958 əyar Böyük Britaniyada Britannia silver kimi tanınır.",
          },
        ],
      },
      {
        id: "platinum",
        title: "Platin və palladium",
        blocks: [
          {
            type: "p",
            text: "Edinburq Əyar İdarəsi (Böyük Britaniya) öz izahında platin üçün 850, 900, 950 və 999, palladium üçün 500, 950 və 999 əyarlarını sadalayır. Eyni siyahıda qızıl üçün 990 əyarı da var.",
          },
          {
            type: "p",
            text: "İcazə verilən əyarların siyahısı ölkədən ölkəyə fərqlənə bilər. Azərbaycanda aldığınız məmulatın əyarını üzərindəki damğadan və qəbzdən yoxlayın.",
          },
        ],
      },
      {
        id: "price",
        title: "Əyar və qiymət",
        blocks: [
          {
            type: "p",
            text: "Metalın dəyəri əyarla mütənasibdir: ərintinin qram qiyməti xalis metalın qram qiymətinin əyara vurulub 1000-ə bölünməsinə bərabərdir. Jeparla bu hesabı hər gün AMB-nin metal məzənnəsi ilə aparır və tarixi ilə göstərir.",
          },
          {
            type: "links",
            items: [
              { label: "Bu günün metal qiymətləri", href: "/prices" },
              { label: "Qızılın qiyməti necə hesablanır", href: "/guides/gold-price-calculation" },
              { label: "585 və 750 əyar qızıl: fərq nədir", href: "/guides/585-vs-750-gold" },
              { label: "Əyar damğasını necə yoxlamaq olar", href: "/guides/hallmark-check" },
            ],
          },
        ],
      },
    ],
  },

  "bijouterie-vs-precious": {
    title: "Bijuteriya və qiymətli zərgərlik: fərq nədir",
    description:
      "Qiymətli metaldan zərgərliklə bijuteriya arasındakı fərq: material, əyar damğası, örtük, nikel və qiymətin necə yarandığı.",
    answer:
      "Qiymətli zərgərlik qızıl, gümüş, platin və ya palladium ərintisindən hazırlanır, onun əyarı olur və üzərinə əyar damğası vurulur; metalın dəyəri çəki və əyardan hesablanır. Bijuteriya polad, mis ərintiləri, muncuq, dəri kimi başqa materiallardan hazırlanır. Üzəri qızıl və ya gümüş təbəqəsi ilə örtülsə də, altındakı material qiymətli metal deyil. Jeparla-da bijuteriya ayrıca nişanla göstərilir və qiyməti metal məzənnəsinə bağlanmır.",
    sections: [
      {
        id: "precious",
        title: "Qiymətli zərgərlik",
        blocks: [
          {
            type: "p",
            text: "Qiymətli metal ərintisi müəyyən əyarla hazırlanır: məsələn, qızıl 585 və ya 750, gümüş 925. Edinburq Əyar İdarəsinin izahına görə, standart əyar damğası üç məcburi nişandan ibarətdir: istehsalçının və ya sifarişçinin nişanı, metal və əyar nişanı və əyar idarəsinin nişanı.",
          },
          {
            type: "p",
            text: "Belə məmulatda metalın dəyəri çəkidən və əyardan hesablanır, ona görə də qiymətin bir hissəsi metal məzənnəsi ilə dəyişir.",
          },
        ],
      },
      {
        id: "bijouterie",
        title: "Bijuteriya",
        blocks: [
          {
            type: "p",
            text: "Bijuteriya qiymətli metal olmayan materiallardan hazırlanır: polad, mis və onun ərintiləri, muncuq, şüşə, dəri və başqaları. Onun qiyməti material, dizayn və işlə müəyyən edilir və metal məzənnəsindən asılı deyil.",
          },
          {
            type: "p",
            text: "Bijuteriya pis və ya yaxşı deyil, sadəcə başqa məhsuldur. Vacib olan, satıcının məmulatın nədən hazırlandığını düzgün yazmasıdır.",
          },
        ],
      },
      {
        id: "plating",
        title: "Örtük: qızıl və ya gümüş suyu",
        blocks: [
          {
            type: "p",
            text: "Bəzi məmulatların üzəri nazik qızıl, gümüş və ya rodium təbəqəsi ilə örtülür. Örtük görünüşü dəyişir, amma əsas materialı dəyişmir: örtüklü polad qolbaq polad qolbaq olaraq qalır.",
          },
          {
            type: "p",
            text: "Örtük əbədi deyil. Məsələn, GIA ağ qızılın üzərindəki rodium örtüyünün zamanla sürtülə biləcəyini yazır. Örtüklü məmulat alarkən örtüyün nə olduğunu və əsas materialı satıcıdan soruşun.",
          },
        ],
      },
      {
        id: "nickel",
        title: "Nikel və dəri",
        blocks: [
          {
            type: "p",
            text: "Danimarka Ətraf Mühitin Mühafizəsi Agentliyinin izahına görə, nikellə dəri təması nikel allergiyasına səbəb ola bilər və bu allergiya ömürlük qalır. Avropa İttifaqında dəriyə uzun müddət toxunan məmulatlardan nikelin ayrılmasına hədd qoyulub; pirsinq zərgərliyi və sırğa ştiftləri üçün hədd daha sərtdir, örtüklü məmulatlarda isə örtük bu həddi ən azı iki il qorumalıdır.",
          },
          {
            type: "p",
            text: "Bu, yalnız bijuteriyaya aid deyil: GIA-ya görə ağ qızıl ərintisində də nikel ola bilər. Nikelə həssasınızsa, materialın tərkibini mağazadan soruşun.",
          },
        ],
      },
      {
        id: "on-jeparla",
        title: "Jeparla-da necə göstərilir",
        blocks: [
          {
            type: "ul",
            items: [
              'Bijuteriya məhsulu kartda və məhsul səhifəsində "Bijuteriya" nişanı ilə göstərilir; metal və əyar əvəzinə material yazılır.',
              "Bijuteriyanın qiyməti sabitdir: onu mağaza təyin edir, metal məzənnəsinə bağlanmır.",
              'Bijuteriya satan mağazadan sənəd tələb olunmur. Satıcını Jeparla komandası yoxlayır, "Sənədlər yoxlanılıb" nişanı isə göstərilmir.',
            ],
          },
          {
            type: "links",
            items: [
              { label: "Bijuteriya və əl işi kataloqu", href: "/products?kind=FASHION" },
              { label: "Əyar cədvəli", href: "/guides/fineness-chart" },
              { label: "Əyar damğasını necə yoxlamaq olar", href: "/guides/hallmark-check" },
            ],
          },
        ],
      },
    ],
  },

  "gold-jewelry-care": {
    title: "Qızıl zərgərliyə qulluq",
    description:
      "Qızılı necə təmizləməli, onu xlordan və aşındırıcı vasitələrdən niyə qorumalı, daşlı və ağ qızıl məmulatlarda nəyə diqqət etməli.",
    answer:
      "Qızıl məmulatı ilıq suda bir damcı yuyucu vasitə ilə isladıb yumşaq diş fırçası ilə təmizləyin, yaxalayın və yumşaq parça ilə qurulayın. Xlordan, ağardıcılardan və aşındırıcı vasitələrdən çəkinin: GIA-ya görə onlar qızıl ərintisindəki digər metallara və bəzi daşlara zərər verə bilər. Daşlı məmulatı ultrasəs cihazında təmizləməzdən əvvəl zərgərlə məsləhətləşin.",
    sections: [
      {
        id: "alloy",
        title: "Qızıl niyə ərintidir",
        blocks: [
          {
            type: "p",
            text: "Xalis qızıl üzük üçün çox yumşaqdır, ona görə də başqa metallarla qarışdırılır. GIA-ya görə sarı qızıla adətən mis, gümüş və sink, qırmızı qızıla mis və gümüş, ağ qızıla isə nikel, palladium və sink kimi ağ metallar qatılır. Qulluq qaydaları əsasən bu metalları və daşları qorumaq üçündür.",
          },
        ],
      },
      {
        id: "cleaning",
        title: "Necə təmizləməli",
        blocks: [
          {
            type: "ol",
            items: [
              "İlıq suya bir damcı yuyucu vasitə qatın və ya zərgərlik üçün nəzərdə tutulmuş təmizləyicidən istifadə edin.",
              "Məmulatı bir müddət isladın, sonra yumşaq diş fırçası ilə çirki təmizləyin.",
              "İlıq su ilə yaxalayın və yumşaq parça ilə tam qurulayın.",
            ],
          },
          {
            type: "p",
            text: "GIA qızıl üzük üçün su, ammonyak və bir damcı qab yuyucu vasitədən ibarət məhlulda 15–30 dəqiqə isladılmasını təsvir edir. Mirvari, mərcan və firuzə kimi məsaməli daşlar ammonyaklı vasitələrlə təmasda olmamalıdır: onları yalnız ilıq su və yumşaq sabunla təmizləyin.",
          },
        ],
      },
      {
        id: "avoid",
        title: "Nədən çəkinməli",
        blocks: [
          {
            type: "ul",
            items: [
              "Xlor və ağardıcılar: GIA-ya görə bəzi daşlara və metal ərintilərinə zərər verə bilər.",
              "Aşındırıcı vasitələr: GIA brilyantlı zərgərliyi məişət təmizləyici tozları və diş pastası ilə təmizləməməyi tövsiyə edir, çünki belə vasitələr qaşda istifadə olunan bəzi metalları aşındıra bilər.",
              "Evdə ultrasəs cihazı: GIA-ya görə bir çox qiymətli daş ultrasəs təmizləyicisində zədələnə bilər. Daşlı məmulatı belə cihazda təmizləməzdən əvvəl zərgərlə məsləhətləşin.",
            ],
          },
        ],
      },
      {
        id: "white-gold",
        title: "Ağ qızıl və rodium örtüyü",
        blocks: [
          {
            type: "p",
            text: "Ağ qızıl adətən rodiumla örtülür və bu örtük zamanla sürtülə bilər. GIA alarkən mağazadan lazım olanda üzüyü yenidən örtüb-örtməyəcəyini soruşmağı tövsiyə edir.",
          },
        ],
      },
      {
        id: "settings",
        title: "Daşların bərkidilməsi",
        blocks: [
          {
            type: "p",
            text: "GIA xəbərdarlıq edir ki, bərkidici yoxlanılmayıbsa, brilyant yerindən oynaya bilər. Daşlı üzüyü vaxtaşırı zərgərə göstərin.",
          },
          {
            type: "links",
            items: [
              { label: "Gümüş zərgərliyə qulluq", href: "/guides/silver-jewelry-care" },
              { label: "Brilyantın 4C-si", href: "/guides/diamond-4c" },
              { label: "Əyar cədvəli", href: "/guides/fineness-chart" },
            ],
          },
        ],
      },
    ],
  },

  "engagement-ring-buying": {
    title: "Nişan üzüyü alarkən nəyi yoxlamalı",
    description:
      "Azərbaycanda nişan üzüyü alarkən yoxlama siyahısı: metal və əyar, damğa, brilyantın 4C-si və laboratoriya hesabatı, ölçü və qəbz.",
    answer:
      "Əvvəlcə metalı və əyarı seçin və üzüyün içindəki damğanın təsvirdəki əyarla eyni olduğunu yoxlayın. Brilyant üçün 4C-yə birlikdə baxın; daşın laboratoriya hesabatı varsa, nömrəsini laboratoriyanın saytında yoxlayın. Ölçünü mağaza ilə dəqiqləşdirin və metal, əyar, çəki və daş məlumatları yazılmış qəbz istəyin.",
    sections: [
      {
        id: "metal",
        title: "Metal və əyar",
        blocks: [
          {
            type: "p",
            text: "Qızıl üzük ərintidən hazırlanır: xalis qızıl gündəlik taxılan üzük üçün çox yumşaqdır. Əyar nə qədər yüksəkdirsə, ərintidə bir o qədər çox qızıl var və metalın dəyəri bir o qədər yüksəkdir.",
          },
          {
            type: "ul",
            items: [
              "Sarı, ağ və qırmızı qızıl eyni əyarda ola bilər: rəngi ərintidəki digər metallar verir.",
              "Ağ qızıl adətən rodiumla örtülür; mağazadan sonradan yenidən örtmə xidmətini soruşun.",
              "Nikelə həssasınızsa, ərintinin tərkibini soruşun: GIA-ya görə ağ qızıl ərintisində nikel ola bilər.",
            ],
          },
        ],
      },
      {
        id: "hallmark",
        title: "Damğa",
        blocks: [
          {
            type: "p",
            text: "Üzüyün daxili tərəfində əyar rəqəmini tapın və onu təsvirdəki əyarla müqayisə edin. Azərbaycanda dövlət əyar nəzarəti var və əyar damğası olmadan qiymətli metal məmulatlarının satışa çıxarılmasına görə qanunvericiliklə məsuliyyət müəyyən edilib (AZƏRTAC xəbəri, mənbələrə baxın).",
          },
        ],
      },
      {
        id: "diamond",
        title: "Brilyant: 4C və laboratoriya hesabatı",
        blocks: [
          {
            type: "ul",
            items: [
              "Kəsim, rəng, təmizlik və karat çəkisinə birlikdə baxın: onlardan yalnız biri daşı təsvir etmir.",
              "Daşın gemoloji laboratoriya hesabatı varsa, mağazadan onu istəyin. GIA hesabatının nömrəsi ilə GIA-nın onlayn bazasında hesabatı yoxlamaq olar; bu nömrə bəzən daşın kənarına (rundistə) lazerlə yazılır.",
              'GIA daşları sertifikatlaşdırmır, qiymətləndirir: "GIA sertifikatlı brilyant" ifadəsi əslində GIA hesabatı olan daş deməkdir. GIA özü brilyant almır və satmır.',
              "Daşın təbii və ya laboratoriyada yetişdirilmiş olduğunu soruşun və bunun qəbzdə yazılmasını istəyin.",
            ],
          },
        ],
      },
      {
        id: "size",
        title: "Ölçü",
        blocks: [
          {
            type: "p",
            text: "Azərbaycanda üzük ölçüsü üzüyün daxili diametridir, millimetrlə. Ölçünü ölçü bələdçisində yoxlayın və sifarişdən əvvəl mağaza ilə dəqiqləşdirin: evdə alınan ölçü təxminidir.",
          },
          {
            type: "links",
            items: [{ label: "Üzük ölçüsü cədvəli və ölçü köməkçisi", href: "/size-guide" }],
          },
        ],
      },
      {
        id: "receipt",
        title: "Qəbzdə nə olmalıdır",
        blocks: [
          {
            type: "ol",
            items: [
              "Metal, əyar və çəki.",
              "Daşların növü, sayı və karat çəkisi; varsa, laboratoriya hesabatının nömrəsi.",
              "Qiymətin hissələri: metal, işçilik və daşlar.",
            ],
          },
        ],
      },
      {
        id: "on-jeparla",
        title: "Jeparla-da",
        blocks: [
          {
            type: "p",
            text: "Məhsul səhifəsində metal, əyar, çəki və daş məlumatlarını mağaza daxil edir. Metala bağlı qiymətlərdə metal hissəsi AMB-nin gündəlik məzənnəsi ilə hesablanır. Yekun qiyməti və məlumatları WhatsApp ilə mağazadan dəqiqləşdirin.",
          },
          {
            type: "links",
            items: [
              { label: "Brilyantın 4C-si", href: "/guides/diamond-4c" },
              { label: "Əyar damğasını necə yoxlamaq olar", href: "/guides/hallmark-check" },
              { label: "Qızılın qiyməti necə hesablanır", href: "/guides/gold-price-calculation" },
            ],
          },
        ],
      },
    ],
  },
};
