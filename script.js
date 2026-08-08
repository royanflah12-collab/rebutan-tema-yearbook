import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js?v=6";


/* ==================================================
   PENGATURAN
================================================== */

const MAX_THEME_PER_CLASS = 2;

const CLASSES = Array.from(
  { length: 16 },
  (_, i) => `XII F-${i + 1}`
);


/* ==================================================
   KATA UMUM YANG BOLEH DIGUNAKAN BERULANG
================================================== */

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "in",
  "on",
  "of",
  "and",
  "to",
  "for",
  "at",
  "by",
  "with",
  "from",
  "into",
  "over",
  "under",
  "is",
  "are",
  "be",
  "as",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "my",
  "your",
  "our",
  "their",
  "his",
  "her",
  "up",
  "down",
  "about",
  "after",
  "before"
]);


/* ==================================================
   ELEMENT HTML
================================================== */

const classSelect =
  document.querySelector("#classSelect");

const themeInput =
  document.querySelector("#themeInput");

const takeBtn =
  document.querySelector("#takeBtn");

const statusBox =
  document.querySelector("#status");

const takenList =
  document.querySelector("#takenList");

const empty =
  document.querySelector("#empty");

const classStatus =
  document.querySelector("#classStatus");

const resetLocal =
  document.querySelector("#resetLocal");

const modal =
  document.querySelector("#modal");

const modalText =
  document.querySelector("#modalText");

const cancelBtn =
  document.querySelector("#cancelBtn");

const confirmBtn =
  document.querySelector("#confirmBtn");


/* ==================================================
   FIREBASE VARIABLES
================================================== */

let db = null;

let auth = null;

let currentUser = null;

let records = {};

let pendingTheme = "";


/* ==================================================
   STATUS
================================================== */

function setStatus(
  text,
  type = "info"
) {

  statusBox.className =
    `status ${type}`;

  statusBox.innerHTML =
    text;
}


/* ==================================================
   NORMALISASI TEKS
================================================== */

function normalizeTheme(text) {

  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


/* ==================================================
   AMBIL KATA PENTING
================================================== */

function getImportantWords(text) {

  return normalizeTheme(text)

    .replace(
      /[^a-z0-9\s]/g,
      " "
    )

    .split(/\s+/)

    .filter(word =>
      word &&
      !STOP_WORDS.has(word)
    );
}


/* ==================================================
   KEY FIREBASE
================================================== */

function themeKey(text) {

  return normalizeTheme(text)

    .replace(
      /[^a-z0-9]+/g,
      "_"
    )

    .replace(
      /^_+|_+$/g,
      ""
    );
}


/* ==================================================
   ESCAPE HTML
================================================== */

function esc(text) {

  return String(text).replace(
    /[&<>"']/g,

    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}


/* ==================================================
   AMBIL SEMUA TEMA
================================================== */

function getAllThemes(
  data = records
) {

  return Object.values(
    data || {}
  ).filter(
    item =>
      item &&
      item.theme &&
      item.takenBy
  );
}


/* ==================================================
   AMBIL TEMA MILIK KELAS
================================================== */

function getClassThemes(
  className,
  data = records
) {

  return getAllThemes(data)
    .filter(
      item =>
        item.takenBy === className
    );
}


/* ==================================================
   CARI KATA YANG BENTROK
================================================== */

function findWordConflict(
  theme,
  data = records
) {

  const newWords =
    getImportantWords(theme);


  for (
    const item of getAllThemes(data)
  ) {

    const oldWords =
      getImportantWords(
        item.theme
      );


    const conflict =
      newWords.find(
        word =>
          oldWords.includes(word)
      );


    if (conflict) {

      return {

        word: conflict,

        theme: item.theme,

        takenBy: item.takenBy

      };
    }
  }


  return null;
}


/* ==================================================
   RENDER DAFTAR TEMA
================================================== */

function render() {

  const arr =
    getAllThemes(records);


  /* Urut berdasarkan waktu */

  arr.sort(
    (a, b) =>
      (a.takenAt || 0) -
      (b.takenAt || 0)
  );


  /* ==================================================
     DAFTAR TEMA
  ================================================== */

  empty.style.display =
    arr.length
      ? "none"
      : "block";


  takenList.innerHTML =
    arr.map(
      (item, index) => `

        <div class="taken-card">

          <div class="rank">
            ${index + 1}
          </div>

          <div>

            <div class="theme-name">
              ${esc(item.theme)}
            </div>

            <div class="owner">
              DIREBUT OLEH
              <b>
                ${esc(item.takenBy)}
              </b>
            </div>

          </div>

          <div class="lock">
            🔒 TERKUNCI
          </div>

        </div>

      `
    ).join("");


  /* ==================================================
     STATUS KELAS
  ================================================== */

  classStatus.innerHTML =
    CLASSES.map(
      className => {

        const classThemes =
          getClassThemes(
            className
          );


        if (
          classThemes.length
        ) {

          return `

            <div class="class-card done">

              <b>
                ${esc(className)}
              </b>

              <span>
                🔒
                ${classThemes.length}/2 tema
              </span>

              ${classThemes
                .map(
                  item => `
                    <small>
                      • ${esc(item.theme)}
                    </small>
                  `
                )
                .join("")}

            </div>

          `;
        }


        return `

          <div class="class-card">

            <b>
              ${esc(className)}
            </b>

            <span>
              🟢 0/2 tema
            </span>

          </div>

        `;
      }
    ).join("");
}


/* ==================================================
   BUKA MODAL
================================================== */

function openModal() {

  const selectedClass =
    classSelect.value;

  const theme =
    themeInput.value.trim();


  /* Kelas belum dipilih */

  if (!selectedClass) {

    setStatus(
      "⚠️ Pilih kelas terlebih dahulu.",
      "error"
    );

    return;
  }


  /* Tema kosong */

  if (!theme) {

    setStatus(
      "⚠️ Tulis tema terlebih dahulu.",
      "error"
    );

    return;
  }


  /* ==================================================
     CEK MAKSIMAL 2 TEMA
  ================================================== */

  const classThemes =
    getClassThemes(
      selectedClass
    );


  if (
    classThemes.length >=
    MAX_THEME_PER_CLASS
  ) {

    setStatus(
      `❌ <b>${esc(selectedClass)}</b> sudah memiliki 2 tema. Maksimal 2 tema.`,
      "error"
    );

    return;
  }


  /* ==================================================
     CEK KATA BENTROK
  ================================================== */

  const conflict =
    findWordConflict(
      theme
    );


  if (conflict) {

    setStatus(
      `❌ Kata <b>“${esc(conflict.word)}”</b> sudah digunakan dalam tema <b>“${esc(conflict.theme)}”</b> oleh <b>${esc(conflict.takenBy)}</b>.`,
      "error"
    );

    return;
  }


  /* ==================================================
     BUKA MODAL
  ================================================== */

  pendingTheme =
    theme;


  modalText.innerHTML =
    `Kelas <b>${esc(selectedClass)}</b> akan merebut tema <b>“${esc(theme)}”</b>.`;


  modal.classList.remove(
    "hidden"
  );
}


/* ==================================================
   TUTUP MODAL
================================================== */

function closeModal() {

  modal.classList.add(
    "hidden"
  );

  pendingTheme = "";
}


takeBtn.onclick =
  openModal;

cancelBtn.onclick =
  closeModal;


/* ==================================================
   KONFIRMASI REBUT TEMA
================================================== */

confirmBtn.onclick =
  async () => {

    const selectedClass =
      classSelect.value;

    const theme =
      pendingTheme.trim();


    if (
      !selectedClass ||
      !theme
    ) {

      closeModal();

      return;
    }


    if (
      !db ||
      !currentUser
    ) {

      setStatus(
        "❌ Firebase belum terhubung.",
        "error"
      );

      return;
    }


    closeModal();

    takeBtn.disabled =
      true;


    setStatus(
      "⏳ Memproses rebutan tema...",
      "info"
    );


    try {

      /* ==================================================
         TRANSACTION
      ================================================== */

      const themesRef =
        ref(
          db,
          "themes"
        );


      const result =
        await runTransaction(
          themesRef,

          currentData => {

            currentData =
              currentData || {};


            /* ==================================================
               CEK JUMLAH TEMA KELAS
            ================================================== */

            const classThemes =
              getClassThemes(
                selectedClass,
                currentData
              );


            if (
              classThemes.length >=
              MAX_THEME_PER_CLASS
            ) {

              return;
            }


            /* ==================================================
               CEK KATA BENTROK
            ================================================== */

            const conflict =
              findWordConflict(
                theme,
                currentData
              );


            if (conflict) {

              return;
            }


            /* ==================================================
               SIMPAN TEMA
            ================================================== */

            currentData[
              themeKey(theme)
            ] = {

              theme:

                theme,

              takenBy:

                selectedClass,

              takenAt:

                Date.now(),

              uid:

                currentUser.uid
            };


            return currentData;
          }
        );


      /* ==================================================
         BERHASIL
      ================================================== */

      if (
        result.committed
      ) {

        themeInput.value =
          "";


        setStatus(
          `🎉 BERHASIL! <b>${esc(selectedClass)}</b> mendapatkan tema <b>${esc(theme)}</b>.`,
          "success"
        );


        return;
      }


      /* ==================================================
         GAGAL — CEK ULANG DATA
      ================================================== */

      const latestData =
        records || {};


      /* Cek kelas */

      const latestClassThemes =
        getClassThemes(
          selectedClass,
          latestData
        );


      if (
        latestClassThemes.length >=
        MAX_THEME_PER_CLASS
      ) {

        setStatus(
          `❌ <b>${esc(selectedClass)}</b> sudah memiliki 2 tema. Maksimal 2 tema.`,
          "error"
        );

        return;
      }


      /* Cek kata */

      const latestConflict =
        findWordConflict(
          theme,
          latestData
        );


      if (
        latestConflict
      ) {

        setStatus(
          `❌ Kata <b>“${esc(latestConflict.word)}”</b> sudah digunakan dalam tema <b>“${esc(latestConflict.theme)}”</b> oleh <b>${esc(latestConflict.takenBy)}</b>.`,
          "error"
        );

        return;
      }


      setStatus(
        "❌ Tema gagal direbut. Silakan coba lagi.",
        "error"
      );


    } catch (error) {

      console.error(
        "TRANSACTION ERROR:",
        error
      );


      setStatus(
        `❌ Gagal merebut tema.<br>
        <small>
          ${esc(
            error?.message ||
            String(error)
          )}
        </small>`,
        "error"
      );


    } finally {

      takeBtn.disabled =
        false;
    }
  };


/* ==================================================
   PILIH KELAS
================================================== */

classSelect.onchange =
  () => {

    localStorage.setItem(
      "ybClass",
      classSelect.value
    );

    render();
  };


/* ==================================================
   GANTI KELAS
================================================== */

resetLocal.onclick =
  () => {

    classSelect.value =
      "";

    localStorage.removeItem(
      "ybClass"
    );

    render();
  };


/* ==================================================
   MULAI FIREBASE
================================================== */

async function start() {

  try {

    console.log(
      "1. Memulai Firebase..."
    );


    /* Cek config */

    if (!firebaseConfig) {

      throw new Error(
        "firebaseConfig tidak ditemukan."
      );
    }


    if (
      !firebaseConfig.apiKey
    ) {

      throw new Error(
        "API Key Firebase kosong."
      );
    }


    console.log(
      "2. Firebase config ditemukan."
    );


    /* Initialize */

    const app =
      initializeApp(
        firebaseConfig
      );


    console.log(
      "3. Firebase berhasil diinisialisasi."
    );


    /* Database */

    db =
      getDatabase(
        app
      );


    /* Auth */

    auth =
      getAuth(
        app
      );


    console.log(
      "4. Database dan Auth siap."
    );


    setStatus(
      "⏳ Login Anonymous...",
      "info"
    );


    /* Anonymous login */

    const credential =
      await signInAnonymously(
        auth
      );


    currentUser =
      credential.user;


    console.log(
      "5. Anonymous berhasil:",
      currentUser.uid
    );


    setStatus(
      "🟢 Anonymous berhasil — membaca database...",
      "success"
    );


    /* ==================================================
       REAL-TIME LISTENER
    ================================================== */

    onValue(

      ref(
        db,
        "themes"
      ),

      snapshot => {

        records =
          snapshot.val() ||
          {};


        render();


        setStatus(
          "🟢 Terhubung — sistem real-time aktif.",
          "success"
        );
      },


      error => {

        console.error(
          "DATABASE ERROR:",
          error
        );


        setStatus(
          `❌ Database error:<br>

          <b>
            ${esc(
              error?.code ||
              "UNKNOWN"
            )}
          </b>

          <br>

          ${esc(
            error?.message ||
            String(error)
          )}`,

          "error"
        );
      }
    );


  } catch (error) {

    console.error(
      "======================"
    );


    console.error(
      "FIREBASE ERROR:",
      error
    );


    console.error(
      "ERROR CODE:",
      error?.code
    );


    console.error(
      "ERROR MESSAGE:",
      error?.message
    );


    console.error(
      "======================"
    );


    const code =
      error?.code ||
      error?.name ||
      "UNKNOWN";


    const message =
      error?.message ||
      String(error);


    setStatus(
      `❌ Anonymous gagal.<br>

      <b>
        KODE: ${esc(code)}
      </b>

      <br>

      <small>
        ${esc(message)}
      </small>`,

      "error"
    );
  }
}


/* ==================================================
   JALANKAN SISTEM
================================================== */

render();

start();
