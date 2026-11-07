# Odobli bolajonlar — bolalar uchun multfilm platformasi

3–7 yoshli bolalar uchun qisqa ta’limiy multfilmlar platformasi. Sayt uch tilda (o‘zbek, rus, ingliz) ishlaydi va kunduzgi/tungi rejimga ega. Foydalanuvchilar Google (Gmail) hisobi orqali kiradi. Admin panelda videolar, bo‘limlar, tariflar, «bilim» valyutasi, bog‘chalar bilan shartnomalar va monitoring boshqariladi.

Sayt statik: hech qanday server yoki «build» kerak emas. U to‘g‘ridan-to‘g‘ri **GitHub Pages**da ishlaydi.

- **Demo rejim.** `assets/js/config.js` bo‘sh bo‘lsa, sayt demo rejimda ishlaydi. Barcha ma’lumot faqat shu brauzerda saqlanadi, Google kirishi o‘rniga oddiy demo-kirish ishlaydi.
- **Haqiqiy rejim.** `config.js`ga Firebase sozlamalari yozilsa, Google orqali kirish va umumiy ma’lumotlar bazasi (Cloud Firestore) yoqiladi.

---

## 1. Saytni GitHub Pages’da ochish

1. Repozitoriyada **Settings → Pages** bo‘limiga kiring.
2. *Source*: **Deploy from a branch**; *Branch*: **main**, papka **/ (root)** → **Save**.
3. 1–2 daqiqadan so‘ng sayt shu manzilda ochiladi: `https://masterpure-rgb.github.io/dono/`

Shu bosqichdayoq sayt demo rejimda to‘liq ishlaydi. Demo rejimda birinchi kirgan foydalanuvchi avtomatik **admin** bo‘ladi.

## 2. Gmail (Google) orqali kirish — shartnoma kerakmi?

**Google bilan shartnoma tuzish shart emas.** Google orqali kirish Firebase Authentication xizmati orqali ishlaydi. Bu xizmatning bepul (Spark) tarifiga kiradi. Kerak bo‘ladigan narsalar:

- Google hisobi va Firebase loyihasi (bepul).
- OAuth rozilik oynasi (consent screen): ilova nomi, aloqa e-pochtasi. Maxfiylik siyosati sahifasi bo‘lishi tavsiya etiladi.
- Ixtiyoriy brend tekshiruvi (bepul). Kirish oynasida logotip va ilova nomi ko‘rinishini istasangiz, Google’ning brend tekshiruvidan o‘tish kerak. Usiz oynada faqat domen ko‘rinadi.

Sayt foydalanuvchidan faqat ism, e-pochta va rasmni oladi (asosiy `profile`/`email` ruxsatlari). Gmail xatlariga hech qanday kirish so‘ralmaydi.

> Kirish ota-onalar va tarbiyachilar uchun mo‘ljallangan; bolaning o‘zi ro‘yxatdan o‘tmaydi.

## 3. Firebase’ni ulash (haqiqiy rejim)

1. <https://console.firebase.google.com> → **Add project**. Google Analytics shart emas.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**. Loyiha uchun aloqa e-pochtasini tanlang.
3. **Authentication → Settings → Authorized domains** → **Add domain**: `masterpure-rgb.github.io`
4. **Build → Firestore Database → Create database**. Joylashuv: masalan `eur3` yoki `europe-west`. Rejim: *production*.
5. **Firestore → Rules** oynasiga ushbu repozitoriydagi `firestore.rules` faylining to‘liq matnini qo‘ying → **Publish**.
6. **Project settings → General → Your apps → Web (</>)**. Ilovani ro‘yxatdan o‘tkazing va berilgan `firebaseConfig` qiymatlarini `assets/js/config.js` fayliga ko‘chiring:

   ```js
   export const CONFIG = {
     firebase: {
       apiKey: "...",
       authDomain: "LOYIHA.firebaseapp.com",
       projectId: "LOYIHA",
       storageBucket: "LOYIHA.appspot.com",
       messagingSenderId: "...",
       appId: "..."
     },
     defaultLang: "uz"
   };
   ```

   Bu qiymatlar maxfiy emas: ular har qanday Firebase veb-ilovada ochiq turadi. Himoyani `firestore.rules` ta’minlaydi.
7. O‘zgarishni GitHub’ga yuklang. Saytga Google orqali bir marta kiring.
8. **Birinchi adminni tayinlash.**
   - Firebase konsolida **Firestore → users** to‘plamini oching.
   - O‘z hujjatingizni toping (e-pochtangiz bo‘yicha).
   - `role` maydonini `user` dan `admin` ga o‘zgartiring.
   - Keyingi adminlarni sayt ichidagi **Admin → Foydalanuvchilar** bo‘limidan tayinlash mumkin.
9. **Admin → Sozlamalar → «Boshlang‘ich ma’lumotlarni yuklash»** tugmasini bosing. 12 qismli «Odobli bolajonlar» katalogi, tariflar va sozlamalar bazaga yoziladi.

> Firestore xavfsizlik qoidalarini jonli foydalanishdan oldin Firebase Emulator’da sinab ko‘rish tavsiya etiladi.

## 4. Video qo‘shish va yangi multfilm bo‘limlari

Har bir multfilm seriali o‘z **bo‘limi**ga ega. Masalan, «Odobli bolajonlar» — 12 qismli pleylist. Yangi multfilm qo‘shish tartibi:

1. **Admin → Bo‘limlar → Bo‘lim qo‘shish.** Nomi, tavsifi va rangini uch tilda kiriting.
2. Video faylni repozitoriyaga yuklang:
   - `videos/uz/…mp4`, `videos/ru/…mp4`, `videos/en/…mp4`,
   - yoki istalgan MP4 havolasidan foydalaning.
3. **Admin → Videolar → Video qo‘shish.** Quyidagilarni kiriting:
   - nomi, tavsifi, shiori;
   - har bir til uchun video havolasi, poster;
   - yosh, davomiylik;
   - kirish turi:
     - *Bepul* — hamma ko‘ra oladi;
     - *Ro‘yxatdan o‘tganlarga* — faqat kirgan foydalanuvchilar;
     - *Pullik* — bilim evaziga ochiladi;
   - savollar va topshiriq (ota-onalar uchun).
4. **Admin → Bosh sahifa.** Yangi bo‘limni bosh sahifa paneli sifatida qo‘shing va tartibini o‘zgartiring.

GitHub’da bitta fayl 100 MB dan oshmasligi kerak. Videolarni 720p, H.264 formatida saqlash tavsiya etiladi.

## 5. «Bilim» valyutasi, tariflar va to‘lovlar

- **Bilim** — platforma ichki birligi. Yangi foydalanuvchiga xush kelibsiz bonusi beriladi (sozlamalarda o‘zgartiriladi).
- **Paketlar.** Masalan, 50 / 100+20 / 250+50 bilim, narxi so‘mda.
- **Obunalar.** Masalan, 30 kun yoki 365 kun. Obuna davrida barcha pullik qismlar ochiq bo‘ladi.
- **To‘lov jarayoni.**
  1. Foydalanuvchi paketni tanlab **so‘rov** yuboradi.
  2. Admin to‘lovni qabul qilgach, **Admin → To‘lov so‘rovlari**da tasdiqlaydi.
  3. Bilim avtomatik hisobga tushadi.
  - Avtomatik onlayn to‘lov (Payme, Click, Uzum) uchun to‘lov tizimi bilan alohida shartnoma va server qismi kerak bo‘ladi.
- Har bir harakat **Bilim tranzaksiyalari** jurnalida saqlanadi. Jurnalni CSV ga eksport qilish mumkin.
- Pullik qismni sotib olishdan oldin **ota-ona tekshiruvi** chiqadi (oddiy ko‘paytma savoli), bola tasodifan sotib olmasligi uchun.

## 6. Bog‘chalar bilan shartnomalar

**Admin → Bog‘chalar** bo‘limida har bir shartnoma uchun quyidagilar kiritiladi:

- bog‘cha nomi, shartnoma raqami;
- mas’ul shaxs, telefon;
- boshlanish va tugash sanasi, maksimal a’zolar soni;
- qamrov: **barcha pullik qismlar** yoki tanlangan bo‘limlar/qismlar;
- **qo‘shilish kodi** (avtomatik yaratiladi).

Tarbiyachi kodni ota-onalarga beradi. Ota-ona **Profil → Bog‘cha shartnomasi** oynasiga kodni kiritadi. Shundan so‘ng shartnomadagi multfilmlar u uchun ochiladi. Shartnoma muddati tugasa yoki o‘chirilsa, kirish avtomatik yopiladi.

## 7. Monitoring

**Admin → Monitoring** oynasi har 30 soniyada yangilanadi. Unda quyidagilar ko‘rinadi:

- hozir saytda turganlar soni;
- bugungi va 14 kunlik ko‘rishlar, oxirigacha ko‘rish ulushi;
- yangi foydalanuvchilar, faol obunalar, muomaladagi bilim;
- kutilayotgan to‘lovlar;
- kunlik grafik, eng ko‘p ko‘rilgan qismlar, til va qurilma kesimi;
- ochiq sahifalar, so‘nggi faoliyat lentasi;
- **xatolar jurnali**: brauzerdagi JavaScript xatolari avtomatik yoziladi.

## 8. Admin panel imkoniyatlari

| Bo‘lim | Nima qilinadi |
|---|---|
| Monitoring | Jonli statistika, grafiklar, faoliyat lentasi, xatolar jurnali |
| Videolar | Qo‘shish, tahrirlash, o‘chirish, chop etish/yashirish, 3 tildagi manbalar, kirish turi va narx |
| Bo‘limlar | Yangi multfilm seriallari uchun bo‘limlar |
| Bosh sahifa | Asosiy banner matni, e’lon, panellarni yoqish/o‘chirish va tartiblash |
| Foydalanuvchilar | Qidiruv, rol (foydalanuvchi/tarbiyachi/admin), bilim qo‘shish/ayirish, bog‘chaga biriktirish, bloklash, CSV |
| Bog‘chalar | Shartnomalar, qo‘shilish kodlari, a’zolar ro‘yxati |
| Tariflar | Bilim paketlari va obunalar |
| To‘lov so‘rovlari | Tasdiqlash/rad etish, izoh |
| Bilim tranzaksiyalari | To‘liq jurnal, jami ko‘rsatkichlar, CSV |
| Sozlamalar | Sayt nomi, standart til, bonus, ota-ona tekshiruvi, avto-keyingi qism, texnik ishlar rejimi, kontaktlar, yo‘nalishlar, eksport/import |

## 9. Muhim cheklovlar

- **Pullik videolar himoyasi.** Ochiq GitHub repozitoriyasidagi `videos/` papkasidagi fayllarni istalgan odam to‘g‘ridan-to‘g‘ri havola orqali yuklab olishi mumkin. Sayt pullik qism havolasini faqat huquqi borlarga ko‘rsatadi, lekin bu to‘liq himoya emas. Haqiqiy himoya uchun pullik videolarni yopiq omborga joylash kerak. Masalan, xavfsizlik qoidalari bilan Cloud Storage for Firebase. 2024-yil oxiridan boshlab yangi Firebase loyihalarida Cloud Storage uchun Blaze (to‘lovli) tarif talab qilinadi; uning ham bepul limiti mavjud.
- **Demo rejim** ma’lumotlari faqat bitta brauzerda saqlanadi va boshqa qurilmalarga o‘tmaydi.
- Ekran vaqti limiti va «davom ettirish» joyi qurilmaning o‘zida saqlanadi.

## 10. Kelgusida qo‘shish mumkin bo‘lgan imkoniyatlar

- Payme / Click / Uzum orqali avtomatik to‘lov (server funksiyasi bilan).
- Promokodlar va chegirmalar, bog‘chalar uchun ommaviy kodlar.
- Tarbiyachi kabineti: guruh bo‘yicha ko‘rish statistikasi.
- Yangi qism chiqqanda e-pochta yoki push-bildirishnoma.
- Videolarni oldindan rejalashtirib chop etish (sana bo‘yicha).
- Ota-onalar fikrlari va ularni moderatsiya qilish.
- Har bir qism uchun bosma topshiriq varaqlari (PDF).
- Avtomatik zaxira nusxa (Firestore eksport).

## Fayl tuzilmasi

```
index.html              — yagona sahifa
assets/css/app.css      — dizayn (kun/tun rejimi)
assets/js/app.js        — sahifalar va marshrutlar
assets/js/admin.js      — admin panel
assets/js/i18n.js       — UZ / RU / EN matnlar
assets/js/store-*.js    — ma’lumotlar qatlami (demo yoki Firebase)
assets/js/config.js     — Firebase sozlamalari
data/seed.json          — boshlang‘ich katalog (12 qism, tariflar)
videos/uz|ru|en/        — video fayllar
firestore.rules         — Firestore xavfsizlik qoidalari
tools/make_seed.py      — seed.json ni qayta yaratish
```
