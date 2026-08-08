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

import { firebaseConfig } from "./firebase-config.js?v=2";

const CLASSES = Array.from(
  { length: 16 },
  (_, i) => `XII F-${i + 1}`
);

const classSelect = document.querySelector("#classSelect");
const themeInput = document.querySelector("#themeInput");
const takeBtn = document.querySelector("#takeBtn");
const statusBox = document.querySelector("#status");

const takenList = document.querySelector("#takenList");
const empty = document.querySelector("#empty");
const classStatus = document.querySelector("#classStatus");

const resetLocal = document.querySelector("#resetLocal");

const modal = document.querySelector("#modal");
const modalText = document.querySelector("#modalText");
const cancelBtn = document.querySelector("#cancelBtn");
const confirmBtn = document.querySelector("#confirmBtn");

let db = null;
let auth = null;
let currentUser = null;

let records = {};
let pendingTheme = "";

/* =========================
   CLASS YANG TERSIMPAN
========================= */

const savedClass = localStorage.getItem("ybClass");

if (savedClass && CLASSES.includes(savedClass)) {
  classSelect.value = savedClass;
}

/* =========================
   STATUS
========================= */

function setStatus(text, type = "info") {
  statusBox.className = `status ${type}`;
  statusBox.innerHTML = text;
}

/* =========================
   NORMALISASI TEMA
========================= */

function norm(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/* =========================
   MEMBUAT KEY DATABASE
========================= */

function key(text) {
  return norm(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/* =========================
   KEAMANAN TAMPILAN HTML
========================= */

function esc(text) {
  return String(text).replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}

/* =========================
   MENAMPILKAN DATA
========================= */

function render() {
  const arr = Object.entries(records)
    .filter(
      ([_, value]) =>
        value &&
        value.takenBy &&
        value.theme
    )
    .map(([databaseKey, value]) => ({
      key: databaseKey,
      ...value
    }));

  arr.sort(
    (a, b) =>
      (a.takenAt || 0) -
      (b.takenAt || 0)
  );

  /* DAFTAR TEMA */

  empty.style.display =
    arr.length ? "none" : "block";

  takenList.innerHTML = arr
    .map(
      (record, index) => `
        <div class="taken-card">

          <div class="rank">
            ${index + 1}
          </div>

          <div>
            <div class="theme-name">
              ${esc(record.theme)}
            </div>

            <div class="owner">
              DIREBUT OLEH
              <b>${esc(record.takenBy)}</b>
            </div>
          </div>

          <div class="lock">
            🔒 TERKUNCI
          </div>

        </div>
      `
    )
    .join("");

  /* STATUS 16 KELAS */

  const byClass = {};

  arr.forEach((record) => {
    byClass[record.takenBy] =
      record.theme;
  });

  classStatus.innerHTML = CLASSES
    .map((className) =>
      byClass[className]
        ? `
          <div class="class-card done">
            <b>${esc(className)}</b>
            <span>
              🔒 ${esc(byClass[className])}
            </span>
          </div>
        `
        : `
          <div class="class-card">
            <b>${esc(className)}</b>
            <span>
              🟢 Belum memilih
            </span>
          </div>
        `
    )
    .join("");
}

/* =========================
   MODAL KONFIRMASI
========================= */

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

  pendingTheme = theme;

  modalText.innerHTML = `
    Kelas <b>${esc(selectedClass)}</b>
    akan merebut tema
    <b>“${esc(theme)}”</b>.
    <br><br>
    Setelah berhasil,
    tema ini tidak dapat dipakai
    kelas lain.
  `;

  modal.classList.remove("hidden");
}

/* =========================
   TUTUP MODAL
========================= */

function closeModal() {
  modal.classList.add("hidden");
  pendingTheme = "";
}

/* =========================
   TOMBOL REBUT
========================= */

takeBtn.onclick = openModal;

cancelBtn.onclick = closeModal;

/* =========================
   KONFIRMASI REBUT TEMA
========================= */

confirmBtn.onclick = async () => {

  const selectedClass =
    classSelect.value;

  const theme =
    pendingTheme.trim();

  if (!db || !currentUser) {
    setStatus(
      "❌ Firebase belum terhubung. Tunggu sampai status berubah menjadi Terhubung.",
      "error"
    );
    return;
  }

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

  closeModal();

  takeBtn.disabled = true;

  setStatus(
    "⏳ Mengamankan tema...",
    "info"
  );

  const databaseKey = key(theme);

  const themeRef =
    ref(db, `themes/${databaseKey}`);

  try {

    const result =
      await runTransaction(
        themeRef,
        (currentData) => {

          /* JIKA SUDAH ADA,
             JANGAN TIMPA */

          if (
            currentData &&
            currentData.takenBy
          ) {
            return;
          }

          /* TEMA BARU */

          return {
            theme: theme,
            takenBy: selectedClass,
            takenAt: Date.now(),
            uid: currentUser.uid
          };
        }
      );

    if (result.committed) {

      themeInput.value = "";

      setStatus(
        `🎉 BERHASIL!
        <b>${esc(selectedClass)}</b>
        mendapatkan tema
        <b>${esc(theme)}</b>.`,
        "success"
      );

    } else {

      setStatus(
        `❌ Tema
        <b>${esc(theme)}</b>
        sudah direbut kelas lain.
        Silakan pilih tema berbeda.`,
        "error"
      );
    }

  } catch (error) {

    console.error(
      "Transaction error:",
      error
    );

    setStatus(
      `❌ Gagal merebut tema.
      <br>
      <small>
      ${esc(error?.message || String(error))}
      </small>`,
      "error"
    );

  } finally {

    takeBtn.disabled = false;
  }
};

/* =========================
   GANTI KELAS
========================= */

classSelect.onchange = () => {

  localStorage.setItem(
    "ybClass",
    classSelect.value
  );

  render();
};

/* =========================
   RESET PILIHAN KELAS DI HP
========================= */

resetLocal.onclick = () => {

  classSelect.value = "";

  localStorage.removeItem(
    "ybClass"
  );

  render();
};

/* =========================
   MULAI FIREBASE
========================= */

async function start() {

  try {

    /* CEK CONFIG */

    if (
      !firebaseConfig ||
      !firebaseConfig.apiKey ||
      firebaseConfig.apiKey.startsWith("GANTI_") ||
      !firebaseConfig.databaseURL
    ) {

      setStatus(
        "❌ Firebase config belum benar.",
        "error"
      );

      return;
    }

    /* INISIALISASI FIREBASE */

    const app =
      initializeApp(firebaseConfig);

    db = getDatabase(app);

    auth = getAuth(app);

    setStatus(
      "⏳ Menghubungkan ke Firebase...",
      "info"
    );

    /* =========================
       LOGIN ANONYMOUS
    ========================= */

    const userCredential =
      await signInAnonymously(auth);

    currentUser =
      userCredential.user;

    console.log(
      "Anonymous login berhasil:",
      currentUser.uid
    );

    /* =========================
       BACA DATABASE
    ========================= */

    onValue(
      ref(db, "themes"),

      (snapshot) => {

        records =
          snapshot.val() || {};

        render();

        setStatus(
          "🟢 Terhubung — sistem real-time aktif.",
          "success"
        );
      },

      (error) => {

        console.error(
          "Database error:",
          error
        );

        setStatus(
          `❌ Tidak bisa membaca database.
          <br>
          <small>
          Kode:
          ${esc(error?.code || "UNKNOWN")}
          </small>
          <br>
          <small>
          ${esc(error?.message || String(error))}
          </small>`,
          "error"
        );
      }
    );

  } catch (error) {

    console.error(
      "Firebase/Auth error:",
      error
    );

    const errorCode =
      error?.code || "UNKNOWN";

    const errorMessage =
      error?.message ||
      String(error);

    setStatus(
      `❌ Anonymous gagal.
      <br>
      <small>
      Kode: ${esc(errorCode)}
      </small>
      <br>
      <small>
      ${esc(errorMessage)}
      </small>`,
      "error"
    );
  }
}

/* =========================
   JALANKAN WEBSITE
========================= */

render();
start();
