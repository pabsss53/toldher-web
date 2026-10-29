# toldher® — web portfolio brand

Website portfolio brand (belum ada toko / keranjang). Murni **HTML + CSS + JavaScript**, tanpa build step.
Semua library & font sudah disimpan lokal di folder ini, jadi tinggal push ke GitHub dan langsung jalan.

## Isi

- **Hero**: hamparan rumput 3D (WebGL / Three.js) yang tertiup angin + logo plush "TOLD HER" melayang. Kursor = angin, klik = logo muter.
- **Scroll**: kamera terbang dari langit ke dalam rumput, teks tagline muncul bergantian, blob cerita.
- **Doodles**: scene hijau (pinned) dengan teks spidol yang "ditulis", doodle digambar, foto nempel.
- **Lookbook**: geser ke samping saat scroll.
- **Two colors**: lingkaran merah melebar menggantikan versi putih.
- **Drop + captcha iseng + footer**.

## Struktur folder

```
toldher-web/
├── index.html        <- semua konten/teks
├── css/style.css     <- semua styling (warna ada di :root paling atas)
├── js/
│   ├── main.js       <- animasi scroll (GSAP + Lenis)
│   ├── grass.js      <- rumput 3D (Three.js)
│   ├── fx.js         <- jejak spidol di kursor + confetti
│   └── config.js     <- ISI LINK INSTAGRAM / TIKTOK / EMAIL DI SINI
├── assets/img/       <- gambar (sudah dikonversi ke WebP, ringan)
├── assets/fonts/     <- Bagel Fat One, Covered By Your Grace, Space Grotesk
└── vendor/           <- three.js, GSAP, ScrollTrigger, Lenis (lokal, tanpa CDN)
```

## Menjalankan di komputer

Jangan dobel-klik `index.html` (browser memblokir JavaScript modul lewat `file://`). Pakai server lokal, pilih salah satu:

```bash
# opsi 1 (butuh Node.js)
npx serve .

# opsi 2 (butuh Python)
python3 -m http.server 8000
```

Lalu buka `http://localhost:3000` (opsi 1) atau `http://localhost:8000` (opsi 2).
Atau pakai ekstensi **Live Server** di VS Code (klik kanan `index.html` -> Open with Live Server).

## Push ke GitHub + online gratis (GitHub Pages)

1. Buat repo baru di github.com (misal `toldher-web`), **jangan** centang "Add README".
2. Di terminal, dari dalam folder ini:

```bash
git init
git add .
git commit -m "toldher web v1"
git branch -M main
git remote add origin https://github.com/USERNAME/toldher-web.git
git push -u origin main
```

3. Di GitHub: **Settings -> Pages -> Build and deployment -> Source: Deploy from a branch -> Branch: `main` / `(root)` -> Save**.
4. Tunggu 1-2 menit. Web kamu online di `https://USERNAME.github.io/toldher-web/`.

Semua path di project ini relatif, jadi aman walau berada di sub-folder `/toldher-web/`.
Mau domain sendiri (misal `toldher.com`)? Settings -> Pages -> Custom domain.

## Yang perlu kamu ganti

| Apa | Di mana |
|---|---|
| Link Instagram / TikTok / email | `js/config.js` (kalau kosong, tombol cuma muncul "link coming soon") |
| Teks / tagline | `index.html` (cari teks-nya, ganti langsung) |
| Warna brand | `css/style.css`, bagian `:root` paling atas |
| Teks pas tombol "i want it" diklik | `js/config.js` -> `WANT_MESSAGES` |
| Ganti foto | timpa file di `assets/img/` dengan nama yang sama (disarankan WebP, lebar maks ~1200px) |

## Kalau terasa berat / patah-patah

Rumput otomatis menurunkan kualitas kalau FPS rendah. Mau dipaksa manual, tambahkan `?q=0.5` di URL
(angka 0.1 sampai 1 = jumlah helai rumput), atau ubah angka `quality` di `js/grass.js`.
Kalau WebGL tidak tersedia, web otomatis pakai tampilan cadangan (langit + logo statis). Mode "reduce motion" di OS juga dihormati.

## Lisensi library

three.js (MIT), Lenis (MIT), GSAP + ScrollTrigger (lisensi GSAP, gratis termasuk komersial), font dari Google Fonts (SIL OFL).
