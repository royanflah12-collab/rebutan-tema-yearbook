import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const CLASSES = Array.from({length:16},(_,i)=>`XII F-${i+1}`);
const classSelect=document.querySelector("#classSelect"), themeInput=document.querySelector("#themeInput");
const takeBtn=document.querySelector("#takeBtn"), statusBox=document.querySelector("#status");
const takenList=document.querySelector("#takenList"), empty=document.querySelector("#empty");
const classStatus=document.querySelector("#classStatus"), resetLocal=document.querySelector("#resetLocal");
const modal=document.querySelector("#modal"), modalText=document.querySelector("#modalText");
const cancelBtn=document.querySelector("#cancelBtn"), confirmBtn=document.querySelector("#confirmBtn");

let db,auth,currentUser=null,records={},pendingTheme="";
const saved=localStorage.getItem("ybClass"); if(saved && CLASSES.includes(saved)) classSelect.value=saved;

function setStatus(t,type="info"){statusBox.className=`status ${type}`;statusBox.innerHTML=t}
function norm(s){return s.trim().toLowerCase().replace(/\s+/g," ")}
function key(s){return norm(s).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function render(){
  const arr=Object.entries(records).filter(([_,v])=>v && v.takenBy && v.theme).map(([k,v])=>({key:k,...v}));
  arr.sort((a,b)=>(a.takenAt||0)-(b.takenAt||0));
  empty.style.display=arr.length?"none":"block";
  takenList.innerHTML=arr.map((r,i)=>`
    <div class="taken-card">
      <div class="rank">${i+1}</div>
      <div><div class="theme-name">${esc(r.theme)}</div><div class="owner">DIREBUT OLEH <b>${esc(r.takenBy)}</b></div></div>
      <div class="lock">🔒 TERKUNCI</div>
    </div>`).join("");

  const byClass={}; arr.forEach(r=>byClass[r.takenBy]=r.theme);
  classStatus.innerHTML=CLASSES.map(c=>byClass[c]
    ? `<div class="class-card done"><b>${esc(c)}</b><span>🔒 ${esc(byClass[c])}</span></div>`
    : `<div class="class-card"><b>${esc(c)}</b><span>🟢 Belum memilih</span></div>`).join("");
}
function openModal(){
  const c=classSelect.value,t=themeInput.value.trim();
  if(!c){setStatus("⚠️ Pilih kelas terlebih dahulu.","error");return}
  if(!t){setStatus("⚠️ Tulis tema terlebih dahulu.","error");return}
  pendingTheme=t;
  modalText.innerHTML=`Kelas <b>${esc(c)}</b> akan merebut tema <b>“${esc(t)}”</b>. Setelah berhasil, tema ini tidak dapat dipakai kelas lain.`;
  modal.classList.remove("hidden");
}
function closeModal(){modal.classList.add("hidden");pendingTheme=""}
takeBtn.onclick=openModal; cancelBtn.onclick=closeModal;

confirmBtn.onclick=async()=>{
  const c=classSelect.value,t=pendingTheme.trim();
  if(!db||!c||!t)return;
  closeModal();takeBtn.disabled=true;setStatus("⏳ Mengamankan tema…","info");
  const k=key(t), themeRef=ref(db,`themes/${k}`);
  try{
    const result=await runTransaction(themeRef,current=>{
      if(current && current.takenBy) return;
      return {theme:t,takenBy:c,takenAt:Date.now(),uid:currentUser?.uid||""};
    });
    if(result.committed){
      themeInput.value="";
      setStatus(`🎉 BERHASIL! <b>${esc(c)}</b> mendapatkan tema <b>${esc(t)}</b>.`,"success");
    }else{
      setStatus(`❌ Tema <b>${esc(t)}</b> sudah direbut kelas lain. Silakan pilih tema berbeda.`,"error");
    }
  }catch(e){
    console.error(e);setStatus("❌ Gagal terhubung ke database. Periksa Firebase Rules dan koneksi.","error");
  }finally{takeBtn.disabled=false}
};

classSelect.onchange=()=>{
  localStorage.setItem("ybClass",classSelect.value);render();
};
resetLocal.onclick=()=>{classSelect.value="";localStorage.removeItem("ybClass");render()};
async function start(){
  try {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("GANTI_")) {
      setStatus("❌ Firebase config belum benar.", "error");
      return;
    }

    const app = initializeApp(firebaseConfig);

    db = getDatabase(app);
    auth = getAuth(app);

    setStatus("⏳ Menghubungkan ke Firebase...", "info");

    // LOGIN ANONYMOUS DULU
    const userCredential = await signInAnonymously(auth);
    currentUser = userCredential.user;

    console.log("Anonymous login berhasil:", currentUser.uid);

    // BARU SETELAH LOGIN, BACA DATABASE
    onValue(
      ref(db, "themes"),
      (snap) => {
        records = snap.val() || {};
        render();
        setStatus("🟢 Terhubung — sistem real-time aktif.", "success");
      },
      (error) => {
        console.error("Database error:", error);

        if (error.code === "PERMISSION_DENIED") {
          setStatus(
            "❌ Database ditolak. Periksa Firebase Realtime Database Rules.",
            "error"
          );
        } else {
          setStatus(
            "❌ Tidak bisa membaca database: " + error.message,
            "error"
          );
        }
      }
    );

  } catch (e) {
    console.error("Firebase/Auth error:", e);

    if (e.code === "auth/operation-not-allowed") {
      setStatus(
        "❌ Anonymous Authentication belum diaktifkan.",
        "error"
      );
    } else if (e.code === "auth/unauthorized-domain") {
      setStatus(
        "❌ Domain GitHub Pages belum diizinkan di Firebase Authentication.",
        "error"
      );
    } else if (e.code === "auth/network-request-failed") {
      setStatus(
        "❌ Gagal terhubung ke Firebase. Periksa koneksi internet.",
        "error"
      );
    } else {
      setStatus(
        "❌ Anonymous gagal: " + e.code,
        "error"
      );
    }
  }
}

render();
start();
