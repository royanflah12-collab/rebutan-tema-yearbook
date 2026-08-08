WEBSITE REBUTAN TEMA YEARBOOK — V2
====================================

Versi ini menggunakan konsep:
16 kelas -> masing-masing bebas MENULIS tema sendiri -> klik REBUT TEMA ->
Firebase mengunci tema tersebut -> semua HP melihat daftar tema yang sudah direbut secara real-time.

FITUR
-----
- 16 kelas (XII F-1 s/d XII F-16)
- Tema diisi sendiri oleh kelas
- Tema yang sama tidak dapat direbut dua kali
- Real-time dengan Firebase Realtime Database
- Daftar "Tema yang Sudah Direbut" otomatis diperbarui
- Menampilkan kelas pemilik tema
- Setiap kelas hanya boleh memiliki satu tema (ditampilkan pada Status Kelas)
- Transaksi Firebase mencegah dua kelas mendapatkan tema yang sama saat menekan hampir bersamaan

PEMASANGAN FIREBASE
-------------------
1. Buka https://console.firebase.google.com/
2. Buat project baru.
3. Project settings -> General -> Your apps -> Web.
4. Daftarkan Web App dan salin Firebase config.
5. Masukkan config tersebut ke firebase-config.js.

AUTHENTICATION
--------------
Firebase Console -> Authentication -> Sign-in method -> Anonymous -> Enable.

REALTIME DATABASE
-----------------
Build -> Realtime Database -> Create Database.

Rules sederhana untuk sistem rebutan:

{
  "rules": {
    "themes": {
      "$theme": {
        ".read": true,
        ".write": "!data.exists() && newData.hasChildren(['theme','takenBy','takenAt','uid'])"
      }
    }
  }
}

PENTING:
Rule tersebut sengaja membuat data tema yang sudah ada tidak dapat ditimpa.
Jadi setelah tema direbut, kelas lain akan gagal meskipun menekan bersamaan.

GITHUB PAGES
------------
Upload 4 file:
- index.html
- style.css
- script.js
- firebase-config.js

Lalu GitHub -> repository -> Settings -> Pages -> Deploy from branch ->
main / root -> Save.

Buka URL GitHub Pages dan bagikan URL YANG SAMA kepada 16 kelas.

RESET
-----
Untuk mengulang perebutan:
Firebase Console -> Realtime Database -> Data -> hapus node "themes".
Kemudian refresh website.

CONTOH
-------
XII F-1 -> "The Great Gatsby" -> BERHASIL
XII F-2 -> "Mafia Vintage" -> BERHASIL
XII F-3 -> "The Great Gatsby" -> GAGAL karena sudah direbut XII F-1

Daftar di semua HP:
1. The Great Gatsby — XII F-1 — TERKUNCI
2. Mafia Vintage — XII F-2 — TERKUNCI

KEAMANAN
--------
Firebase Web config bukan password rahasia. Jangan memasukkan service-account private key
ke website. Keamanan sistem ditentukan oleh Authentication dan Database Rules.
