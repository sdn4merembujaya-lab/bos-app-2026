/* ===================================================================
   Aplikasi Pertanggungjawaban Laporan BOS 2026
   Data disimpan di localStorage milik peramban perangkat ini.
=================================================================== */

const STORAGE_KEY = "bos2026_data_v1";

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
    rkas: DEFAULT_KOMPONEN.map(nama => ({ id: uid(), nama, anggaran: 0 })),
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    console.error("Gagal memuat data, memakai data kosong.", e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

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

/* ---------------- BKU RUNNING BALANCE ---------------- */
function bkuSorted() {
  return [...state.bku].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "") || a._seq - b._seq);
}
function bkuWithSaldo() {
  let saldo = 0;
  return bkuSorted().map(row => {
    saldo += (row.jenis === "penerimaan" ? row.jumlah : -row.jumlah);
    return { ...row, saldo };
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
function realisasiPerKomponen(nama) {
  return state.bku
    .filter(r => r.jenis === "pengeluaran" && r.komponen === nama)
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
  const totalAnggaranAll = state.rkas.reduce((s, r) => s + Number(r.anggaran || 0), 0) || 1;
  state.rkas.forEach(k => {
    const real = realisasiPerKomponen(k.nama);
    const pct = k.anggaran > 0 ? Math.min(100, (real / k.anggaran) * 100) : (real > 0 ? 100 : 0);
    const over = k.anggaran > 0 && real > k.anggaran;
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <span title="${k.nama}">${k.nama}</span>
      <span class="chart-track"><span class="chart-fill ${over ? "over" : ""}" style="width:${pct}%"></span></span>
      <span class="chart-val">${rupiah(real)}</span>`;
    chart.appendChild(row);
  });
  if (state.rkas.length === 0) {
    chart.innerHTML = `<p class="hint">Belum ada komponen RKAS. Tambahkan pada menu RKAS &amp; Komponen.</p>`;
  }

  const tbody = document.querySelector("#tableRecent tbody");
  tbody.innerHTML = "";
  const recent = bkuWithSaldo().slice(-5).reverse();
  if (recent.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada transaksi.</td></tr>`;
  } else {
    recent.forEach(r => {
      tbody.innerHTML += `<tr>
        <td>${tglIndo(r.tanggal)}</td><td>${r.noBukti || "—"}</td><td>${r.uraian}</td><td>${r.komponen || "—"}</td>
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
function val(id) { return document.getElementById(id).value.trim(); }

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
  state.penerimaan.push({ id: uid(), tanggal, tahap: val("pTahap") || document.getElementById("pTahap").value, ref: val("pRef"), jumlah, ket: val("pKet") });
  ["pTanggal","pRef","pJumlah","pKet"].forEach(id => document.getElementById(id).value = "");
  saveState(); renderAll();
  toast("Penerimaan dana ditambahkan.");
});
document.querySelector("#tablePenerimaan tbody").addEventListener("click", (e) => {
  if (!e.target.matches(".row-del")) return;
  state.penerimaan = state.penerimaan.filter(r => r.id !== e.target.dataset.id);
  saveState(); renderAll();
});

/* ---------------- KOMPONEN <select> OPTIONS ---------------- */
function refreshKomponenSelect() {
  const sel = document.getElementById("bKomponen");
  sel.innerHTML = state.rkas.map(k => `<option value="${escapeHtml(k.nama)}">${escapeHtml(k.nama)}</option>`).join("");
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

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
        <td>${tglIndo(r.tanggal)}</td><td>${r.noBukti || "—"}</td><td>${r.uraian}</td><td>${r.komponen || "—"}</td>
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
    komponen: document.getElementById("bKomponen").value || "",
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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada komponen kegiatan.</td></tr>`;
  } else {
    state.rkas.forEach(k => {
      const real = realisasiPerKomponen(k.nama);
      const sisa = Number(k.anggaran || 0) - real;
      tbody.innerHTML += `<tr>
        <td>${escapeHtml(k.nama)}</td>
        <td class="num">${rupiah(k.anggaran)}</td>
        <td class="num">${rupiah(real)}</td>
        <td class="num" style="${sisa < 0 ? "color:#A0392C" : ""}">${rupiah(sisa)}</td>
        <td><button class="row-del" data-id="${k.id}">Hapus</button></td>
      </tr>`;
    });
  }
  const totalA = state.rkas.reduce((s, r) => s + Number(r.anggaran || 0), 0);
  const totalR = state.rkas.reduce((s, r) => s + realisasiPerKomponen(r.nama), 0);
  document.getElementById("totalAnggaran").textContent = rupiah(totalA);
  document.getElementById("totalRealisasiRkas").textContent = rupiah(totalR);
  document.getElementById("totalSisaRkas").textContent = rupiah(totalA - totalR);
  refreshKomponenSelect();
}
document.getElementById("btnTambahKomponen").addEventListener("click", () => {
  const nama = val("rNama"), anggaran = Number(val("rAnggaran")) || 0;
  if (!nama) { toast("Isi nama komponen."); return; }
  state.rkas.push({ id: uid(), nama, anggaran });
  ["rNama","rAnggaran"].forEach(id => document.getElementById(id).value = "");
  saveState(); renderAll();
  toast("Komponen ditambahkan.");
});
document.querySelector("#tableRkas tbody").addEventListener("click", (e) => {
  if (!e.target.matches(".row-del")) return;
  state.rkas = state.rkas.filter(r => r.id !== e.target.dataset.id);
  saveState(); renderAll();
});

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
    const real = realisasiPerKomponen(k.nama);
    return `<tr><td>${escapeHtml(k.nama)}</td><td class="num">${rupiah(k.anggaran)}</td><td class="num">${rupiah(real)}</td><td class="num">${rupiah(k.anggaran - real)}</td></tr>`;
  }).join("") || `<tr class="empty-row"><td colspan="4">Belum ada data.</td></tr>`;

  const bkuBody = document.querySelector("#reportBkuTable tbody");
  bkuBody.innerHTML = rows.map(r => `<tr>
      <td>${tglIndo(r.tanggal)}</td><td>${r.noBukti || "—"}</td><td>${r.uraian}</td><td>${r.komponen || "—"}</td>
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
    csv += [tglIndo(r.tanggal), r.noBukti || "", `"${(r.uraian||"").replace(/"/g,'""')}"`, `"${(r.komponen||"").replace(/"/g,'""')}"`,
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
  renderLaporan();
}

// set default tanggal ke hari ini pada form-form
(function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  ["pTanggal", "bTanggal"].forEach(id => { document.getElementById(id).value = today; });
})();

renderAll();
