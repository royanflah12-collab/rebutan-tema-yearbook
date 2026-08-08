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

import { firebaseConfig } from "./firebase-config.js?v=3";

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

function setStatus(text, type = "info") {
  statusBox.className = `status ${type}`;
  statusBox.innerHTML = text;
}

function norm(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function key(text) {
  return norm(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

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

function render() {
  const arr = Object.entries(records)
    .filter(([_, v]) => v && v.takenBy && v.theme)
    .map(([k, v]) => ({ key: k, ...v }));

  arr.sort((a, b) => (a.takenAt || 0) - (b.takenAt || 0));

  empty.style.display = arr.length ? "none" : "block";

  takenList.innerHTML = arr.map((r, i) => `
    <div class="taken-card">
      <div class="rank">${i + 1}</div>
      <div>
        <div class="theme-name">${esc(r.theme)}</div>
        <div class="owner">
          DIREBUT OLEH <b>${esc(r.takenBy)}</b>
        </div>
      </div>
      <div class="lock">🔒 TERKUNCI</div>
    </div>
  `).join("");

  const byClass = {};

  arr.forEach(r => {
    byClass[r.takenBy] = r.theme;
  });

  classStatus.innerHTML = CLASSES.map(c =>
    byClass[c]
      ? `
        <div class="class-card done">
          <b>${esc(c)}</b>
          <span>🔒 ${esc(byClass[c])}</span>
        </div>
      `
      : `
        <div class="class-card">
          <b>${esc(c)}</b>
          <span>🟢 Belum memilih</span>
        </div>
      `
  ).join("");
}

function openModal() {
  const c = classSelect.value;
  const t = themeInput.value.trim();

  if (!c) {
    setStatus("⚠️ Pilih kelas terlebih dahulu.", "error");
    return;
  }

  if (!t) {
    setStatus("⚠️ Tulis tema terlebih dahulu.", "error");
    return;
  }

  pendingTheme = t;

  modalText.innerHTML =
    `Kelas <b>${esc(c)}</b> akan merebut tema <b>“${esc(t)}”</b>.`;

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  pendingTheme = "";
}

takeBtn.onclick = openModal;
cancelBtn.onclick = closeModal;

confirmBtn.onclick = async () => {
  const c = classSelect.value;
  const t = pendingTheme.trim();

  if (!db || !currentUser) {
    setStatus(
      "❌ Firebase belum terhubung.",
      "error"
    );
    return;
  }

  closeModal();
  takeBtn.disabled = true;

  try {
    const themeRef = ref(db, `themes/${key(t)}`);

    const result = await runTransaction(
      themeRef,
      current => {
        if (current && current.takenBy) {
          return;
        }

        return {
          theme: t,
          takenBy: c,
          takenAt: Date.now(),
          uid: currentUser.uid
        };
      }
    );

    if (result.committed) {
      themeInput.value = "";

      setStatus(
        `🎉 BERHASIL! <b>${esc(c)}</b> mendapatkan tema <b>${esc(t)}</b>.`,
        "success"
      );
    } else {
      setStatus(
        `❌ Tema <b>${esc(t)}</b> sudah direbut kelas lain.`,
        "error"
      );
    }

  } catch (error) {
    console.error("Transaction error:", error);

    setStatus(
      `❌ Gagal merebut tema.<br>
       <small>${esc(error?.message || String(error))}</small>`,
      "error"
    );
  }

  takeBtn.disabled = false;
};

classSelect.onchange = () => {
  localStorage.setItem("ybClass", classSelect.value);
  render();
};

resetLocal.onclick = () => {
  classSelect.value = "";
  localStorage.removeItem("ybClass");
  render();
};

async function start() {

  try {

    console.log("1. Memulai Firebase");

    if (!firebaseConfig) {
      throw new Error("firebaseConfig tidak ditemukan");
    }

    if (!firebaseConfig.apiKey) {
      throw new Error("apiKey Firebase kosong");
    }

    console.log("2. Firebase config ditemukan");

    const app = initializeApp(firebaseConfig);

    console.log("3. Firebase berhasil diinisialisasi");

    db = getDatabase(app);
    auth = getAuth(app);

    console.log("4. Database dan Auth siap");

    setStatus(
      "⏳ Login Anonymous...",
      "info"
    );

    const credential = await signInAnonymously(auth);

    console.log(
      "5. Anonymous berhasil:",
      credential
    );

    currentUser = credential.user;

    setStatus(
      "🟢 Anonymous berhasil — membaca database...",
      "success"
    );

    onValue(
      ref(db, "themes"),

      snapshot => {
        records = snapshot.val() || {};

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
           <b>${esc(error?.code || "TIDAK ADA KODE")}</b><br>
           ${esc(error?.message || String(error))}`,
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
      "ERROR NAME:",
      error?.name
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
      String(error) ||
      "Tidak ada pesan error.";

    setStatus(
      `❌ Anonymous gagal.<br>
       <b>KODE: ${esc(code)}</b><br>
       <small>${esc(message)}</small>`,
      "error"
    );
  }
};

render();
start();
