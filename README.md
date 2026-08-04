/* ===================================================================
   Aplikasi Pertanggungjawaban Laporan BOS 2026
   Data disimpan di localStorage milik peramban perangkat ini.
=================================================================== */

const STORAGE_KEY = "bos2026_data_v2";
const OLD_STORAGE_KEY = "bos2026_data_v1";

const DEFAULT_KOMPONEN = [
  "Pengembangan Perpustakaan",
  "Kegiatan Penerimaan Peserta Didik Baru",
  "Kegiatan Pembelajaran dan Ekstrakurikuler",
  "Kegiatan Asesmen/Evaluasi Pembelajaran",
  "Administrasi Kegiatan Sekolah",
  "Pengembangan Profesi Guru & Tenaga Kependidikan",
  "Langganan Daya dan Jasa",
  "Pemeliharaan Sarana dan Prasarana Sekolah",
  "Penyediaan Alat Multi Media Pembelajaran",
  "Pembayaran Honor",
];

function defaultState() {
  return {
    profil: {
      nama: "", npsn: "", alamat: "", wilayah: "",
      kepsek: "", kepsekNip: "", bendahara: "", bendaharaNip: "",
      tahun: 2026
    },
    penerimaan: [],
    bku: [],
    rkas: DEFAULT_KOMPONEN.map(program => ({
      id: uid(), kode: "", program, uraian: "", vol: 0, satuan: "", harga: 0
    })),
    nota: [],
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // coba migrasi dari versi data lama (format RKAS sebelumnya)
      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (old) {
        const oldParsed = JSON.parse(old);
        const migrated = defaultState();
        migrated.profil = Object.assign(migrated.profil, oldParsed.profil || {});
        migrated.penerimaan = oldParsed.penerimaan || [];
        migrated.rkas = (oldParsed.rkas || []).map(k => ({
          id: k.id || uid(), kode: "", program: k.nama || "", uraian: "",
          vol: k.anggaran ? 1 : 0, satuan: "paket", harga: k.anggaran || 0
        }));
        const rkasByName = {};
        migrated.rkas.forEach(k => rkasByName[k.program] = k.id);
        migrated.bku = (oldParsed.bku || []).map(r => ({
          ...r, komponenId: rkasByName[r.komponen] || ""
        }));
        migrated.nota = [];
        return migrated;
      }
      return defaultState();
    }
    const parsed = JSON.parse(raw);
    const merged = defaultState();
    return Object.assign(merged, parsed, {
      profil: Object.assign(merged.profil, parsed.profil || {})
    });
  } catch (e) {
    console.error("Gagal memuat data, memakai data kosong.", e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let notaDraftItems = [];
let selectedNotaId = null;

/* ---------------- FORMATTERS ---------------- */
function rupiah(n) {
  n = Number(n) || 0;
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}
function tglIndo(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function quarterOf(iso) {
  if (!iso) return null;
  const m = new Date(iso + "T00:00:00").getMonth();
  return Math.floor(m / 3) + 1;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function val(id) { return document.getElementById(id).value.trim(); }

/* ---------------- TOAST ---------------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ---------------- NAVIGATION ---------------- */
document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("page-" + btn.dataset.page).classList.add("active");
});

/* ---------------- RKAS HELPERS ---------------- */
function rkasAnggaran(k) {
  return (Number(k.vol) || 0) * (Number(k.harga) || 0);
}
function rkasLabel(k) {
  const kode = k.kode ? k.kode + " — " : "";
  return kode + (k.program || "(tanpa nama program)");
}
function rkasById(id) {
  return state.rkas.find(k => k.id === id);
}

/* ---------------- BKU RUNNING BALANCE ---------------- */
function bkuSorted() {
  return [...state.bku].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "") || (a._seq || 0) - (b._seq || 0));
}
function bkuWithSaldo() {
  let saldo = 0;
  return bkuSorted().map(row => {
    saldo += (row.jenis === "penerimaan" ? row.jumlah : -row.jumlah);
    const rk = rkasById(row.komponenId);
    return { ...row, saldo, komponenLabel: rk ? rkasLabel(rk) : (row.komponen || "—") };
  });
}
function totalPenerimaanDana() {
  return state.penerimaan.reduce((s, r) => s + Number(r.jumlah || 0), 0);
}
function totalPenerimaanLain() {
  return state.bku.filter(r => r.jenis === "penerimaan").reduce((s, r) => s + Number(r.jumlah || 0), 0);
}
function totalPengeluaran() {
  return state.bku.filter(r => r.jenis === "pengeluaran").reduce((s, r) => s + Number(r.jumlah || 0), 0);
}
function saldoAkhir() {
  return totalPenerimaanDana() + totalPenerimaanLain() - totalPengeluaran();
}
function realisasiPerKomponen(id) {
  return state.bku
    .filter(r => r.jenis === "pengeluaran" && r.komponenId === id)
    .reduce((s, r) => s + Number(r.jumlah || 0), 0);
}

/* ---------------- RENDER: TOPBAR ---------------- */
function renderTopbar() {
  document.getElementById("topbarSchool").textContent = state.profil.nama || "Nama Sekolah Belum Diisi";
  document.getElementById("topbarSub").textContent =
    `NPSN ${state.profil.npsn || "—"} · Tahun Anggaran ${state.profil.tahun || 2026}`;
  document.getElementById("topbarSaldo").textContent = rupiah(saldoAkhir());
}

/* ---------------- RENDER: DASHBOARD ---------------- */
function renderDashboard() {
  const terima = totalPenerimaanDana() + totalPenerimaanLain();
  const keluar = totalPengeluaran();
  document.getElementById("cardTerima").textContent = rupiah(terima);
  document.getElementById("cardRealisasi").textContent = rupiah(keluar);
  document.getElementById("cardSaldo").textContent = rupiah(terima - keluar);
  document.getElementById("cardPersen").textContent = terima > 0 ? Math.round((keluar / terima) * 100) + "%" : "0%";

  const chart = document.getElementById("chartKomponen");
  chart.innerHTML = "";
  state.rkas.forEach(k => {
    const anggaran = rkasAnggaran(k);
    const real = realisasiPerKomponen(k.id);
    const pct = anggaran > 0 ? Math.min(100, (real / anggaran) * 100) : (real > 0 ? 100 : 0);
    const over = anggaran > 0 && real > anggaran;
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <span title="${escapeHtml(rkasLabel(k))}">${escapeHtml(rkasLabel(k))}</span>
      <span class="chart-track"><span class="chart-fill ${over ? "over" : ""}" style="width:${pct}%"></span></span>
      <span class="chart-val">${rupiah(real)}</span>`;
    chart.appendChild(row);
  });
  if (state.rkas.length === 0) {
    chart.innerHTML = `<p class="hint">Belum ada baris RKAS. Tambahkan pada menu RKAS &amp; Kode Rekening.</p>`;
  }

  const tbody = document.querySelector("#tableRecent tbody");
  tbody.innerHTML = "";
  const recent = bkuWithSaldo().slice(-5).reverse();
  if (recent.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada transaksi.</td></tr>`;
  } else {
    recent.forEach(r => {
      tbody.innerHTML += `<tr>
        <td>${tglIndo(r.tanggal)}</td><td>${r.noBukti || "—"}</td><td>${r.uraian}</td><td>${escapeHtml(r.komponenLabel)}</td>
        <td class="num">${r.jenis === "penerimaan" ? rupiah(r.jumlah) : "—"}</td>
        <td class="num">${r.jenis === "pengeluaran" ? rupiah(r.jumlah) : "—"}</td>
      </tr>`;
    });
  }
}

/* ---------------- RENDER: PROFIL ---------------- */
function renderProfil() {
  const p = state.profil;
  document.getElementById("fNamaSekolah").value = p.nama;
  document.getElementById("fNpsn").value = p.npsn;
  document.getElementById("fAlamat").value = p.alamat;
  document.getElementById("fWilayah").value = p.wilayah;
  document.getElementById("fKepsek").value = p.kepsek;
  document.getElementById("fKepsekNip").value = p.kepsekNip;
  document.getElementById("fBendahara").value = p.bendahara;
  document.getElementById("fBendaharaNip").value = p.bendaharaNip;
  document.getElementById("fTahun").value = p.tahun;
}
document.getElementById("btnSimpanProfil").addEventListener("click", () => {
  state.profil = {
    nama: val("fNamaSekolah"), npsn: val("fNpsn"), alamat: val("fAlamat"), wilayah: val("fWilayah"),
    kepsek: val("fKepsek"), kepsekNip: val("fKepsekNip"),
    bendahara: val("fBendahara"), bendaharaNip: val("fBendaharaNip"),
    tahun: Number(val("fTahun")) || 2026
  };
  saveState();
  renderTopbar();
  toast("Profil sekolah disimpan.");
});

/* ---------------- RENDER: PENERIMAAN ---------------- */
function renderPenerimaan() {
  const tbody = document.querySelector("#tablePenerimaan tbody");
  tbody.innerHTML = "";
  if (state.penerimaan.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada data penerimaan.</td></tr>`;
  } else {
    [...state.penerimaan].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "")).forEach(r => {
      tbody.innerHTML += `<tr>
        <td>${tglIndo(r.tanggal)}</td><td>${r.tahap}</td><td>${r.ref || "—"}</td><td>${r.ket || "—"}</td>
        <td class="num">${rupiah(r.jumlah)}</td>
        <td><button class="row-del" data-id="${r.id}">Hapus</button></td>
      </tr>`;
    });
  }
  document.getElementById("totalPenerimaan").textContent = rupiah(totalPenerimaanDana());
}
document.getElementById("btnTambahPenerimaan").addEventListener("click", () => {
  const tanggal = val("pTanggal"), jumlah = Number(val("pJumlah"));
  if (!tanggal || !jumlah) { toast("Isi tanggal dan jumlah terlebih dahulu."); return; }
  state.penerimaan.push({ id: uid(), tanggal, tahap: document.getElementById("pTahap").value, ref: val("pRef"), jumlah, ket: val("pKet") });
  ["pTanggal","pRef","pJumlah","pKet"].forEach(id => document.getElementById(id).value = "");
  saveState(); renderAll();
  toast("Penerimaan dana ditambahkan.");
});
document.querySelector("#tablePenerimaan tbody").addEventListener("click", (e) => {
  if (!e.target.matches(".row-del")) return;
  state.penerimaan = state.penerimaan.filter(r => r.id !== e.target.dataset.id);
  saveState(); renderAll();
});

/* ---------------- KOMPONEN <select> OPTIONS (dipakai BKU & Nota) ---------------- */
function refreshKomponenSelects() {
  const opts = state.rkas.map(k => `<option value="${k.id}">${escapeHtml(rkasLabel(k))}</option>`).join("");
  const bSel = document.getElementById("bKomponen");
  const nSel = document.getElementById("nRkasRef");
  if (bSel) bSel.innerHTML = opts || `<option value="">(belum ada baris RKAS)</option>`;
  if (nSel) nSel.innerHTML = opts || `<option value="">(belum ada baris RKAS)</option>`;
}

/* ---------------- RENDER: BKU ---------------- */
function renderBku() {
  const tbody = document.querySelector("#tableBku tbody");
  tbody.innerHTML = "";
  const rows = bkuWithSaldo();
  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Belum ada transaksi pada Buku Kas Umum.</td></tr>`;
  } else {
    rows.forEach(r => {
      tbody.innerHTML += `<tr>
        <td>${tglIndo(r.tanggal)}</td><td>${r.noBukti || "—"}</td><td>${r.uraian}</td><td>${escapeHtml(r.komponenLabel)}</td>
        <td class="num">${r.jenis === "penerimaan" ? rupiah(r.jumlah) : "—"}</td>
        <td class="num">${r.jenis === "pengeluaran" ? rupiah(r.jumlah) : "—"}</td>
        <td class="num">${rupiah(r.saldo)}</td>
        <td><button class="row-del" data-id="${r.id}">Hapus</button></td>
      </tr>`;
    });
  }
}
document.getElementById("btnTambahBku").addEventListener("click", () => {
  const tanggal = val("bTanggal"), uraian = val("bUraian"), jumlah = Number(val("bJumlah"));
  if (!tanggal || !uraian || !jumlah) { toast("Lengkapi tanggal, uraian, dan jumlah."); return; }
  state.bku.push({
    id: uid(), _seq: state.bku.length,
    tanggal, noBukti: val("bNoBukti"), uraian,
    jenis: document.getElementById("bJenis").value,
    komponenId: document.getElementById("bKomponen").value || "",
    jumlah
  });
  ["bTanggal","bNoBukti","bUraian","bJumlah"].forEach(id => document.getElementById(id).value = "");
  saveState(); renderAll();
  toast("Transaksi ditambahkan ke BKU.");
});
document.querySelector("#tableBku tbody").addEventListener("click", (e) => {
  if (!e.target.matches(".row-del")) return;
  state.bku = state.bku.filter(r => r.id !== e.target.dataset.id);
  saveState(); renderAll();
});

/* ---------------- RENDER: RKAS ---------------- */
function renderRkas() {
  const tbody = document.querySelector("#tableRkas tbody");
  tbody.innerHTML = "";
  if (state.rkas.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">Belum ada baris RKAS.</td></tr>`;
  } else {
    state.rkas.forEach(k => {
      const anggaran = rkasAnggaran(k);
      const real = realisasiPerKomponen(k.id);
      const sisa = anggaran - real;
      tbody.innerHTML += `<tr>
        <td>${escapeHtml(k.kode || "—")}</td>
        <td>${escapeHtml(k.program || "—")}</td>
        <td>${escapeHtml(k.uraian || "—")}</td>
        <td class="num">${k.vol || 0}</td>
        <td>${escapeHtml(k.satuan || "—")}</td>
        <td class="num">${rupiah(k.harga)}</td>
        <td class="num">${rupiah(anggaran)}</td>
        <td class="num">${rupiah(real)}</td>
        <td class="num" style="${sisa < 0 ? "color:#A0392C" : ""}">${rupiah(sisa)}</td>
        <td><button class="row-del" data-id="${k.id}">Hapus</button></td>
      </tr>`;
    });
  }
  const totalA = state.rkas.reduce((s, r) => s + rkasAnggaran(r), 0);
  const totalR = state.rkas.reduce((s, r) => s + realisasiPerKomponen(r.id), 0);
  document.getElementById("totalAnggaran").textContent = rupiah(totalA);
  document.getElementById("totalRealisasiRkas").textContent = rupiah(totalR);
  document.getElementById("totalSisaRkas").textContent = rupiah(totalA - totalR);
  refreshKomponenSelects();
}
document.getElementById("btnTambahKomponen").addEventListener("click", () => {
  const program = val("rProgram");
  if (!program) { toast("Isi Program Kegiatan SNP terlebih dahulu."); return; }
  state.rkas.push({
    id: uid(),
    kode: val("rKode"),
    program,
    uraian: val("rUraian"),
    vol: Number(val("rVol")) || 0,
    satuan: val("rSatuan"),
    harga: Number(val("rHarga")) || 0
  });
  ["rKode","rProgram","rUraian","rVol","rSatuan","rHarga"].forEach(id => document.getElementById(id).value = "");
  saveState(); renderAll();
  toast("Baris RKAS ditambahkan.");
});
document.querySelector("#tableRkas tbody").addEventListener("click", (e) => {
  if (!e.target.matches(".row-del")) return;
  state.rkas = state.rkas.filter(r => r.id !== e.target.dataset.id);
  saveState(); renderAll();
});

/* ---------------- RENDER: NOTA PESANAN ---------------- */
function renderNotaDraftTable() {
  const tbody = document.querySelector("#tableNotaDraft tbody");
  tbody.innerHTML = notaDraftItems.map((it, idx) => `<tr>
      <td>${escapeHtml(it.nama)}</td><td class="num">${it.vol}</td><td>${escapeHtml(it.satuan)}</td>
      <td class="num">${rupiah(it.harga)}</td><td class="num">${rupiah(it.vol * it.harga)}</td>
      <td><button class="row-del" data-idx="${idx}">Hapus</button></td>
    </tr>`).join("") || `<tr class="empty-row"><td colspan="6">Belum ada item ditambahkan.</td></tr>`;
  const total = notaDraftItems.reduce((s, it) => s + it.vol * it.harga, 0);
  document.getElementById("totalNotaDraft").textContent = rupiah(total);
}
document.getElementById("btnTambahItemNota").addEventListener("click", () => {
  const nama = val("niNama"), vol = Number(val("niVol")), harga = Number(val("niHarga"));
  if (!nama || !vol || !harga) { toast("Lengkapi nama barang, volume, dan harga satuan."); return; }
  notaDraftItems.push({ nama, vol, satuan: val("niSatuan") || "-", harga });
  ["niNama","niVol","niSatuan","niHarga"].forEach(id => document.getElementById(id).value = "");
  renderNotaDraftTable();
});
document.querySelector("#tableNotaDraft tbody").addEventListener("click", (e) => {
  if (!e.target.matches(".row-del")) return;
  notaDraftItems.splice(Number(e.target.dataset.idx), 1);
  renderNotaDraftTable();
});
document.getElementById("btnSimpanNota").addEventListener("click", () => {
  const rkasRefId = document.getElementById("nRkasRef").value;
  const noNota = val("nNoNota"), tanggal = val("nTanggal"), penyedia = val("nPenyedia");
  if (!rkasRefId) { toast("Pilih referensi RKAS / Kode Rekening terlebih dahulu."); return; }
  if (!noNota || !tanggal || !penyedia) { toast("Lengkapi no. nota, tanggal, dan nama penyedia."); return; }
  if (notaDraftItems.length === 0) { toast("Tambahkan minimal 1 item barang/jasa."); return; }
  const nota = {
    id: uid(), noNota, tanggal, penyedia, alamat: val("nAlamat"),
    rkasRefId, items: notaDraftItems
  };
  state.nota.push(nota);
  notaDraftItems = [];
  ["nNoNota","nTanggal","nPenyedia","nAlamat"].forEach(id => document.getElementById(id).value = "");
  renderNotaDraftTable();
  saveState();
  selectedNotaId = nota.id;
  renderNotaPage();
  toast("Nota pesanan disimpan.");
});

function renderNotaList() {
  const tbody = document.querySelector("#tableNotaList tbody");
  if (state.nota.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada nota pesanan tersimpan.</td></tr>`;
    return;
  }
  tbody.innerHTML = [...state.nota].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "")).map(n => {
    const rk = rkasById(n.rkasRefId);
    const total = n.items.reduce((s, it) => s + it.vol * it.harga, 0);
    return `<tr>
      <td>${escapeHtml(n.noNota)}</td><td>${tglIndo(n.tanggal)}</td><td>${escapeHtml(n.penyedia)}</td>
      <td>${rk ? escapeHtml(rkasLabel(rk)) : "(baris RKAS dihapus)"}</td>
      <td class="num">${rupiah(total)}</td>
      <td>
        <button class="row-del" data-view="${n.id}" style="color:var(--navy);">Lihat</button>
        &middot; <button class="row-del" data-del="${n.id}">Hapus</button>
      </td>
    </tr>`;
  }).join("");
}
document.querySelector("#tableNotaList tbody").addEventListener("click", (e) => {
  if (e.target.dataset.view) {
    selectedNotaId = e.target.dataset.view;
    renderNotaDoc();
    document.getElementById("notaDoc").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (e.target.dataset.del) {
    state.nota = state.nota.filter(n => n.id !== e.target.dataset.del);
    if (selectedNotaId === e.target.dataset.del) selectedNotaId = null;
    saveState(); renderNotaPage();
  }
});
function renderNotaDoc() {
  const nota = state.nota.find(n => n.id === selectedNotaId) || state.nota[state.nota.length - 1];
  document.getElementById("notaSchoolLine").textContent =
    `${state.profil.nama || "Nama Sekolah"} — NPSN ${state.profil.npsn || "—"}`;
  if (!nota) {
    document.getElementById("notaNoView").textContent = "—";
    document.getElementById("notaTglView").textContent = "—";
    document.getElementById("notaPenyediaView").textContent = "—";
    document.getElementById("notaKodeView").textContent = "—";
    document.querySelector("#notaItemsView tbody").innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada nota dipilih. Simpan atau pilih "Lihat" pada daftar di atas.</td></tr>`;
    document.getElementById("notaTotalView").textContent = "Rp 0";
    document.getElementById("notaSignPenyedia").textContent = "(______________________)";
    document.getElementById("notaSignBendahara").textContent = "(______________________)";
    document.getElementById("notaSignBendaharaNip").textContent = "";
    return;
  }
  const rk = rkasById(nota.rkasRefId);
  document.getElementById("notaNoView").textContent = nota.noNota;
  document.getElementById("notaTglView").textContent = tglIndo(nota.tanggal);
  document.getElementById("notaPenyediaView").textContent = nota.penyedia + (nota.alamat ? " — " + nota.alamat : "");
  document.getElementById("notaKodeView").textContent = rk ? rkasLabel(rk) : "(baris RKAS dihapus)";
  const total = nota.items.reduce((s, it) => s + it.vol * it.harga, 0);
  document.querySelector("#notaItemsView tbody").innerHTML = nota.items.map((it, i) => `<tr>
      <td>${i + 1}</td><td>${escapeHtml(it.nama)}</td><td class="num">${it.vol}</td><td>${escapeHtml(it.satuan)}</td>
      <td class="num">${rupiah(it.harga)}</td><td class="num">${rupiah(it.vol * it.harga)}</td>
    </tr>`).join("");
  document.getElementById("notaTotalView").textContent = rupiah(total);
  document.getElementById("notaSignPenyedia").textContent = `(${nota.penyedia})`;
  document.getElementById("notaSignBendahara").textContent = `(${state.profil.bendahara || "______________________"})`;
  document.getElementById("notaSignBendaharaNip").textContent = state.profil.bendaharaNip ? `NIP. ${state.profil.bendaharaNip}` : "";
}
document.getElementById("btnCetakNota").addEventListener("click", () => {
  if (!selectedNotaId && state.nota.length === 0) { toast("Belum ada nota pesanan untuk dicetak."); return; }
  window.print();
});
function renderNotaPage() {
  renderNotaList();
  renderNotaDoc();
}

/* ---------------- RENDER: LAPORAN ---------------- */
function filteredBkuByPeriod() {
  const val = document.getElementById("lwTriwulan").value;
  const rows = bkuWithSaldo();
  if (val === "all") return rows;
  return rows.filter(r => quarterOf(r.tanggal) === Number(val));
}
function renderLaporan() {
  const rows = filteredBkuByPeriod();
  const terima = rows.filter(r => r.jenis === "penerimaan").reduce((s, r) => s + Number(r.jumlah || 0), 0) + totalPenerimaanDana();
  const keluar = rows.filter(r => r.jenis === "pengeluaran").reduce((s, r) => s + Number(r.jumlah || 0), 0);

  document.getElementById("reportSchoolLine").textContent =
    `${state.profil.nama || "Nama Sekolah"} — NPSN ${state.profil.npsn || "—"} — ${state.profil.wilayah || "—"}`;
  const twLabel = { "1": "Triwulan I (Jan–Mar)", "2": "Triwulan II (Apr–Jun)", "3": "Triwulan III (Jul–Sep)", "4": "Triwulan IV (Okt–Des)", "all": "Seluruh Tahun" }[document.getElementById("lwTriwulan").value];
  document.getElementById("reportPeriodLine").textContent = `Periode: ${twLabel} — Tahun Anggaran ${state.profil.tahun || 2026}`;

  document.getElementById("repTerima").textContent = rupiah(terima);
  document.getElementById("repKeluar").textContent = rupiah(keluar);
  document.getElementById("repSaldo").textContent = rupiah(saldoAkhir());

  const rkasBody = document.querySelector("#reportRkasTable tbody");
  rkasBody.innerHTML = state.rkas.map(k => {
    const anggaran = rkasAnggaran(k);
    const real = realisasiPerKomponen(k.id);
    return `<tr><td>${escapeHtml(rkasLabel(k))}</td><td class="num">${rupiah(anggaran)}</td><td class="num">${rupiah(real)}</td><td class="num">${rupiah(anggaran - real)}</td></tr>`;
  }).join("") || `<tr class="empty-row"><td colspan="4">Belum ada data.</td></tr>`;

  const bkuBody = document.querySelector("#reportBkuTable tbody");
  bkuBody.innerHTML = rows.map(r => `<tr>
      <td>${tglIndo(r.tanggal)}</td><td>${r.noBukti || "—"}</td><td>${r.uraian}</td><td>${escapeHtml(r.komponenLabel)}</td>
      <td class="num">${r.jenis === "penerimaan" ? rupiah(r.jumlah) : "—"}</td>
      <td class="num">${r.jenis === "pengeluaran" ? rupiah(r.jumlah) : "—"}</td>
      <td class="num">${rupiah(r.saldo)}</td>
    </tr>`).join("") || `<tr class="empty-row"><td colspan="7">Tidak ada transaksi pada periode ini.</td></tr>`;

  document.getElementById("signKepsek").textContent = `(${state.profil.kepsek || "______________________"})`;
  document.getElementById("signKepsekNip").textContent = state.profil.kepsekNip ? `NIP. ${state.profil.kepsekNip}` : "";
  document.getElementById("signBendahara").textContent = `(${state.profil.bendahara || "______________________"})`;
  document.getElementById("signBendaharaNip").textContent = state.profil.bendaharaNip ? `NIP. ${state.profil.bendaharaNip}` : "";
}
document.getElementById("lwTriwulan").addEventListener("change", renderLaporan);
document.getElementById("btnCetak").addEventListener("click", () => window.print());
document.getElementById("btnCsv").addEventListener("click", () => {
  const rows = filteredBkuByPeriod();
  let csv = "Tanggal,No Bukti,Uraian,Komponen,Penerimaan,Pengeluaran,Saldo\n";
  rows.forEach(r => {
    csv += [tglIndo(r.tanggal), r.noBukti || "", `"${(r.uraian||"").replace(/"/g,'""')}"`, `"${(r.komponenLabel||"").replace(/"/g,'""')}"`,
      r.jenis === "penerimaan" ? r.jumlah : "", r.jenis === "pengeluaran" ? r.jumlah : "", r.saldo].join(",") + "\n";
  });
  downloadFile(`BKU_BOS_${state.profil.tahun || 2026}.csv`, csv, "text/csv");
  toast("CSV diunduh.");
});

/* ---------------- BACKUP / RESTORE ---------------- */
document.getElementById("btnExportJson").addEventListener("click", () => {
  downloadFile(`cadangan_bos_${state.profil.tahun || 2026}.json`, JSON.stringify(state, null, 2), "application/json");
  toast("Cadangan data diunduh.");
});
document.getElementById("fileImportJson").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = Object.assign(defaultState(), parsed);
      saveState(); renderAll();
      toast("Data berhasil dipulihkan.");
    } catch (err) {
      toast("Berkas tidak valid.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});
document.getElementById("btnResetData").addEventListener("click", () => {
  if (!confirm("Yakin ingin menghapus seluruh data pada aplikasi ini? Tindakan ini tidak dapat dibatalkan.")) return;
  state = defaultState();
  saveState(); renderAll();
  toast("Seluruh data telah dihapus.");
});

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- RENDER ALL ---------------- */
function renderAll() {
  renderTopbar();
  renderRkas();
  renderDashboard();
  renderProfil();
  renderPenerimaan();
  renderBku();
  renderNotaPage();
  renderLaporan();
}

// set default tanggal ke hari ini pada form-form
(function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  ["pTanggal", "bTanggal", "nTanggal"].forEach(id => { document.getElementById(id).value = today; });
})();

renderAll();
