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
};
