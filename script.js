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

import { firebaseConfig } from "./firebase-config.js?v=7";


/* ==================================================
   PENGATURAN
================================================== */

const MAX_THEME_PER_CLASS = 2;

const CLASSES = Array.from(
  { length: 16 },
  (_, i) => `XII F-${i + 1}`
);


/* ==================================================
   KATA UMUM
   Kata-kata ini TIDAK dihitung sebagai bentrok.
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
  "before",
  "style",
  "theme",
  "concept",
  "world"
]);


/* ==================================================
   KELOMPOK KATA / WORD FAMILY

   Kata-kata dalam satu kelompok dianggap sama.
================================================== */

const WORD_FAMILIES = [

  [
    "arab",
    "arabic",
    "arabian"
  ],

  [
    "america",
    "american"
  ],

  [
    "africa",
    "african"
  ],

  [
    "asia",
    "asian"
  ],

  [
    "europe",
    "european"
  ],

  [
    "japan",
    "japanese"
  ],

  [
    "china",
    "chinese"
  ],

  [
    "korea",
    "korean"
  ],

  [
    "india",
    "indian"
  ],

  [
    "italy",
    "italian"
  ],

  [
    "france",
    "french"
  ],

  [
    "germany",
    "german"
  ],

  [
    "spain",
    "spanish"
  ],

  [
    "brazil",
    "brazilian"
  ],

  [
    "mexico",
    "mexican"
  ],

  [
    "greece",
    "greek"
  ],

  [
    "egypt",
    "egyptian"
  ],

  [
    "viking",
    "vikings"
  ],

  [
    "pirate",
    "pirates"
  ],

  [
    "future",
    "futuristic"
  ],

  [
    "technology",
    "tech",
    "technological"
  ],

  [
    "fantasy",
    "fantastic"
  ],

  [
    "magic",
    "magical"
  ],

  [
    "mystery",
    "mysterious"
  ],

  [
    "adventure",
    "adventurous"
  ],

  [
    "dream",
    "dreamy"
  ],

  [
    "dark",
    "darkness"
  ],

  [
    "night",
    "nighttime"
  ],

  [
    "space",
    "spatial"
  ],

  [
    "ocean",
    "oceanic"
  ],

  [
    "nature",
    "natural"
  ]

];


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
   FIREBASE
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
   NORMALISASI
================================================== */

function normalizeTheme(text) {

  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


/* ==================================================
   NORMALISASI KATA
================================================== */

function normalizeWord(word) {

  let clean =
    word
      .toLowerCase()
      .trim();


  /*
    Cari apakah kata masuk
    salah satu word family.
  */

  for (
    const family of WORD_FAMILIES
  ) {

    if (
      family.includes(clean)
    ) {

      /*
        Semua anggota keluarga
        memiliki ID yang sama.
      */

      return family[0];
    }
  }


  return clean;
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

    .map(
      word =>
        normalizeWord(word)
    )

    .filter(
      word =>
        word &&
        !STOP_WORDS.has(word)
    );
}


/* ==================================================
   FIREBASE KEY
================================================== */

function themeKey(text) {

  return normalizeTheme(text)

    .replace(
      /[^a-z0-9]+/g,
      "_"
    )

    .replace(
      /^_+|_+$/g,
      "");
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
   SEMUA TEMA
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
   TEMA MILIK KELAS
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
   CEK KATA BENTROK
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


    for (
      const newWord of newWords
    ) {

      if (
        oldWords.includes(newWord)
      ) {

        return {

          word: newWord,

          theme: item.theme,

          takenBy: item.takenBy

        };
      }
    }
  }


  return null;
}


/* ==================================================
   RENDER
================================================== */

function render() {

  const arr =
    getAllThemes(records);


  arr.sort(
    (a, b) =>
      (a.takenAt || 0) -
      (b.takenAt || 0)
  );


  /* ==================================================
     LIST TEMA
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
   MODAL
================================================== */

function openModal() {

  const selectedClass =
    classSelect.value;

  const theme =
    themeInput.value.trim();


  if (!selectedClass) {

    setStatus(
      "⚠️ Pilih kelas terlebih dahulu.",
      "error"
    );

    return;
  }


  if (!theme) {

    setStatus(
      "⚠️ Tulis tema terlebih dahulu.",
      "error"
    );

    return;
  }


  /* ==================================================
     CEK MAX 2 TEMA
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
     CEK WORD FAMILY
  ================================================== */

  const conflict =
    findWordConflict(
      theme
    );


  if (conflict) {

    setStatus(
      `❌ Kata <b>“${esc(conflict.word)}”</b> bentrok dengan tema <b>“${esc(conflict.theme)}”</b> milik <b>${esc(conflict.takenBy)}</b>.`,
      "error"
    );

    return;
  }


  pendingTheme =
    theme;


  modalText.innerHTML =
    `Kelas <b>${esc(selectedClass)}</b> akan merebut tema <b>“${esc(theme)}”</b>.`;


  modal.classList.remove(
    "hidden"
  );
}


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
   KONFIRMASI
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
               MAX 2 TEMA
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
               WORD FAMILY CHECK
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
               SIMPAN
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
         GAGAL
      ================================================== */

      const latestData =
        records || {};


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


      const latestConflict =
        findWordConflict(
          theme,
          latestData
        );


      if (
        latestConflict
      ) {

        setStatus(
          `❌ Kata <b>“${esc(latestConflict.word)}”</b> bentrok dengan tema <b>“${esc(latestConflict.theme)}”</b> milik <b>${esc(latestConflict.takenBy)}</b>.`,
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
   START FIREBASE
================================================== */

async function start() {

  try {

    console.log(
      "1. Memulai Firebase..."
    );


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


    const app =
      initializeApp(
        firebaseConfig
      );


    db =
      getDatabase(
        app
      );


    auth =
      getAuth(
        app
      );


    setStatus(
      "⏳ Login Anonymous...",
      "info"
    );


    const credential =
      await signInAnonymously(
        auth
      );


    currentUser =
      credential.user;


    setStatus(
      "🟢 Anonymous berhasil — membaca database...",
      "success"
    );


    /* ==================================================
       REAL-TIME
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
          </b><br>
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
      "FIREBASE ERROR:",
      error
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
      <b>KODE: ${esc(code)}</b><br>
      <small>${esc(message)}</small>`,
      "error"
    );
  }
}


/* ==================================================
   JALANKAN
================================================== */

render();

start();
