/* ═══════════════════════════════════════════════
   APPLICATION STATE
═══════════════════════════════════════════════ */
let lastResult = null;

/* ═══════════════════════════════════════════════
   READ CAP SETTINGS
═══════════════════════════════════════════════ */
function readCapSettings() {
  const enabled = document.getElementById('capEnabled').checked;
  const minAmt  = parseFloat(document.getElementById('capMinAmt').value) || 0;
  const maxRaw  = document.getElementById('capMaxAmt').value.trim();
  const maxAmt  = maxRaw === '' ? Infinity : (parseFloat(maxRaw) || Infinity);
  return { enabled, minAmt, maxAmt };
}

/* ═══════════════════════════════════════════════
   DISTRIBUTE
═══════════════════════════════════════════════ */
function distribute() {
  const btn = document.getElementById('btnDistribute');
  const numMonths = parseInt(document.getElementById('numMonths').value) || 12;
  const variance  = parseInt(document.getElementById('varianceLevel').value) || 3;
  const cap       = readCapSettings();
  const rows      = readRows();

  if (!rows.length) {
    showToast('⚠ أضف بنداً واحداً على الأقل مع إدخال الاعتماد', 'error');
    return;
  }
  if (!selectedStart) {
    showToast('⚠ يرجى اختيار شهر البداية', 'error');
    return;
  }

  if (btn) btn.classList.add('loading');

  requestAnimationFrame(() => {
    const months   = buildMonths(selectedStart, numMonths);
    const seedBase = Date.now() & 0xffff;
    const result   = [];

    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];

      if (r.first !== null && r.first > r.total && !cap.enabled) {
        if (btn) btn.classList.remove('loading');
        showToast(`⚠ "${r.desc}": الشهر الأول أكبر من الإجمالي`, 'error');
        return;
      }

      const { amounts, firstAdjusted } = distributeWithCapAmt(
        r.total, numMonths, variance,
        seedBase + ri,
        r.first,
        cap.minAmt,
        cap.maxAmt,
        cap.enabled
      );

      result.push({ ...r, amounts, firstAdjusted });
    }

    // ── Column-level cap: if sum of first month across ALL rows exceeds maxAmt,
    //    scale each row's first-month value down proportionally so the column
    //    total equals exactly maxAmt.
    if (cap.enabled && isFinite(cap.maxAmt) && cap.maxAmt > 0) {
      const colFirstSum = round2(result.reduce((s, r) => s + r.amounts[0], 0));
      if (colFirstSum > cap.maxAmt) {
        const scale = cap.maxAmt / colFirstSum;
        let runningFirst = 0;
        result.forEach((r, ri) => {
          const newFirst = ri < result.length - 1
            ? round2(r.amounts[0] * scale)
            : round2(cap.maxAmt - runningFirst); // last row absorbs rounding drift
          runningFirst = round2(runningFirst + newFirst);
          const diff      = round2(r.amounts[0] - newFirst);
          r.amounts[0]    = newFirst;
          // redistribute the diff into remaining months proportionally
          if (diff !== 0 && r.amounts.length > 1) {
            const restSum = round2(r.amounts.slice(1).reduce((a, b) => a + b, 0));
            if (restSum > 0) {
              let runningRest = 0;
              for (let mi = 1; mi < r.amounts.length; mi++) {
                const extra = mi < r.amounts.length - 1
                  ? round2(diff * (r.amounts[mi] / restSum))
                  : round2(diff - runningRest);
                runningRest     = round2(runningRest + extra);
                r.amounts[mi]   = round2(r.amounts[mi] + extra);
              }
            } else {
              // all remaining months were 0, add diff to last month
              r.amounts[r.amounts.length - 1] = round2(r.amounts[r.amounts.length - 1] + diff);
            }
          }
          r.firstAdjusted = true;
        });
      }
    }

    lastResult = { months, result, cap };
    renderPreview(months, result, cap);
    if (btn) btn.classList.remove('loading');
    showToast(`✔ تم توزيع ${result.length} بند على ${months.length} شهر`, 'success');
  });
}

function redistribute() { distribute(); }

/* ═══════════════════════════════════════════════
   CAP UI
═══════════════════════════════════════════════ */
function toggleCap() {
  const enabled  = document.getElementById('capEnabled').checked;
  const inputs   = document.getElementById('capInputs');
  const rangeBar = document.getElementById('capRangeBar');
  if (inputs)   inputs.style.display   = enabled ? 'flex' : 'none';
  if (rangeBar) rangeBar.style.display = enabled ? 'block' : 'none';
  const capSec = document.getElementById('capSection');
  if (capSec) capSec.classList.toggle('cap-active', enabled);
  if (enabled) syncCapDisplay();
  scheduleSave();
}

function syncCapDisplay() {
  const minAmt   = parseFloat(document.getElementById('capMinAmt').value) || 0;
  const maxRaw   = document.getElementById('capMaxAmt').value.trim();
  const maxAmt   = maxRaw === '' ? null : (parseFloat(maxRaw) || null);
  const labelsEl = document.getElementById('capRangeLabels');
  const fillEl   = document.getElementById('capRangeFill');
  const hMinEl   = document.getElementById('capHandleMin');
  const hMaxEl   = document.getElementById('capHandleMax');

  const minTxt = fmt(minAmt);
  const maxTxt = maxAmt !== null ? fmt(maxAmt) : '∞';
  if (labelsEl) labelsEl.textContent = `${minTxt} — ${maxTxt}`;

  const rows       = readRows();
  const grandTotal = rows.length ? round2(rows.reduce((s, r) => s + r.total, 0)) : 0;
  if (fillEl && grandTotal > 0) {
    const minPct = Math.min((minAmt / grandTotal) * 100, 100);
    const maxPct = maxAmt !== null ? Math.min((maxAmt / grandTotal) * 100, 100) : 100;
    fillEl.style.left  = minPct + '%';
    fillEl.style.width = (maxPct - minPct) + '%';
    if (hMinEl) hMinEl.style.left = minPct + '%';
    if (hMaxEl) hMaxEl.style.left = maxPct + '%';
  }

  const previewEl = document.getElementById('capPreview');
  if (!previewEl) return;

  const capSec = document.getElementById('capSection');
  if (capSec?.classList.contains('cap-hidden')) return;

  if (grandTotal > 0) {
    const maxDisplay = maxAmt !== null ? fmt(maxAmt) : 'غير محدود';
    previewEl.innerHTML = `
      <div class="cpv"><span class="cpv-label">إجمالي الاعتمادات</span><span class="cpv-val">${fmt(grandTotal)}</span></div>
      <div class="cpv"><span class="cpv-label">الحد الأدنى</span><span class="cpv-val">${fmt(minAmt)} ج</span></div>
      <div class="cpv"><span class="cpv-label">الحد الأقصى</span><span class="cpv-val">${maxDisplay} ج</span></div>`;
  } else {
    previewEl.innerHTML = '<span class="cap-preview-empty">أدخل البيانات لرؤية المعاينة</span>';
  }
}

function updateVarianceBadge(val) {
  const labels = ['', 'متقارب جداً', 'متقارب', 'معتدل', 'متباين', 'متباين جداً'];
  const el = document.getElementById('varianceBadge');
  if (el) el.textContent = labels[+val] || 'معتدل';
}

/* ═══════════════════════════════════════════════
   EXPORT MODAL
═══════════════════════════════════════════════ */
function exportXLSX() {
  if (!lastResult) { showToast('⚠ قم بالتوزيع أولاً', 'error'); return; }
  const fiscal = document.getElementById('fiscalYear')?.value || new Date().getFullYear();
  const inp    = document.getElementById('exportFileName');
  if (inp) inp.value = `خطة_التدفقات_النقدية_${fiscal}`;
  document.getElementById('exportModal').style.display = 'flex';
  setTimeout(() => inp && inp.select(), 50);
}

function closeExportModal() {
  document.getElementById('exportModal').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('exportModal').style.display === 'flex') {
    closeExportModal();
  }
});

function confirmExport() {
  const raw      = (document.getElementById('exportFileName').value || '').trim();
  const fiscal   = document.getElementById('fiscalYear')?.value || new Date().getFullYear();
  const fileName = (raw || `خطة_التدفقات_النقدية_${fiscal}`) + '.xlsx';
  closeExportModal();
  doExport(fileName);
}

/* ═══════════════════════════════════════════════
   EXPORT TO .XLSX
═══════════════════════════════════════════════ */
function doExport(fileName) {
  if (!lastResult) return;

  try {
    const { months, result } = lastResult;
    const entity  = document.getElementById('entityName')?.value?.trim() || 'جهة حكومية';
    const fiscal  = document.getElementById('fiscalYear')?.value?.trim()  || new Date().getFullYear();
    const today   = new Date().toLocaleDateString('ar-EG');
    const hasNotes = notesVisible;

    /* ─────────────────────────────────────────
       helpers
    ───────────────────────────────────────── */
    const NF   = '#,##0.00';
    const FONT = 'Calibri';
    const bd   = (style, rgb) => ({ style, color: { rgb } });

    function cellStyle(opts) {
      const s = {};
      if (opts.bg)     s.fill = { patternType: 'solid', fgColor: { rgb: opts.bg } };
      if (opts.fg || opts.bold || opts.sz || opts.italic)
        s.font = { name: FONT, sz: opts.sz || 10,
                   bold: !!opts.bold, italic: !!opts.italic,
                   color: { rgb: opts.fg || '000000' } };
      if (opts.ha || opts.va || opts.wrap)
        s.alignment = { horizontal: opts.ha || 'center',
                        vertical:   opts.va || 'center',
                        wrapText:   !!opts.wrap,
                        readingOrder: opts.rtl ? 2 : 1 };
      if (opts.border) {
        const b = opts.border;
        s.border = {
          top:    bd(b.top    || 'thin', b.color || 'BFBFBF'),
          bottom: bd(b.bottom || 'thin', b.color || 'BFBFBF'),
          left:   bd(b.left   || 'thin', b.color || 'BFBFBF'),
          right:  bd(b.right  || 'thin', b.color || 'BFBFBF'),
        };
      }
      if (opts.nf) s.numFmt = opts.nf;
      return s;
    }

    function setCell(ws, r, c, val, style) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const isNum = typeof val === 'number';
      ws[addr] = { t: isNum ? 'n' : 's', v: val ?? '', z: isNum ? NF : undefined };
      if (style) ws[addr].s = style;
    }

    /* ─────────────────────────────────────────
       SHEET 1 — main distribution
    ───────────────────────────────────────── */
    const ws1 = {};

    const COLS = 3 + months.length + 1 + (hasNotes ? 1 : 0);
    // col indices
    const C_ACCT  = 0;
    const C_DESC  = 1;
    const C_TOT   = 2;
    const C_M0    = 3;
    const C_SUM   = 3 + months.length;
    const C_NOTES = hasNotes ? C_SUM + 1 : -1;

    let row = 0;

    // ── title row
    setCell(ws1, row, 0, `جمهورية مصر العربية — ${entity}`,
      cellStyle({ bg: '1E3A5F', fg: 'FFFFFF', bold: true, sz: 13,
                  ha: 'center', va: 'center', rtl: true }));
    for (let c = 1; c < COLS; c++)
      setCell(ws1, row, c, '',
        cellStyle({ bg: '1E3A5F' }));
    row++;

    // ── subtitle
    setCell(ws1, row, 0, `خطة التدفقات النقدية وحد الصرف — السنة المالية ${fiscal}`,
      cellStyle({ bg: '2C5282', fg: 'E2E8F0', bold: true, sz: 11,
                  ha: 'center', va: 'center', rtl: true }));
    for (let c = 1; c < COLS; c++)
      setCell(ws1, row, c, '', cellStyle({ bg: '2C5282' }));
    row++;

    // ── date
    setCell(ws1, row, 0, `تاريخ الإصدار: ${today}`,
      cellStyle({ bg: 'EBF4FF', fg: '475569', sz: 9, ha: 'right', rtl: true }));
    for (let c = 1; c < COLS; c++)
      setCell(ws1, row, c, '', cellStyle({ bg: 'EBF4FF' }));
    row++;

    // ── blank gap
    for (let c = 0; c < COLS; c++)
      setCell(ws1, row, c, '', cellStyle({ bg: 'F8FAFC' }));
    row++;

    // ── header row
    const hdrBorder = { top: 'medium', bottom: 'medium', color: '1E3A5F' };
    const hdrStyle  = (bg, fg) => cellStyle({ bg, fg, bold: true, sz: 10,
                                              ha: 'center', va: 'center',
                                              wrap: true, rtl: true,
                                              border: hdrBorder });
    setCell(ws1, row, C_ACCT,  'كود الحساب',    hdrStyle('1A365D', 'FFFFFF'));
    setCell(ws1, row, C_DESC,  'البيان',         hdrStyle('1A365D', 'FFFFFF'));
    setCell(ws1, row, C_TOT,   'الاعتمادات',     hdrStyle('744210', 'FFFFFF'));
    months.forEach((m, mi) =>
      setCell(ws1, row, C_M0 + mi,
        `${MONTH_NAMES[m]}\n(${MONTH_EN[m]})`,
        hdrStyle('2B6CB0', 'FFFFFF')));
    setCell(ws1, row, C_SUM, 'المجموع', hdrStyle('744210', 'FFFFFF'));
    if (hasNotes) setCell(ws1, row, C_NOTES, 'ملاحظات', hdrStyle('475569', 'FFFFFF'));
    row++;

    // ── data rows
    const dataBorder = { color: 'D1D5DB' };
    result.forEach((r, ri) => {
      const even = ri % 2 === 0;
      const bg   = even ? 'FFFFFF' : 'EFF6FF';
      const sum  = round2(r.amounts.reduce((a, b) => a + b, 0));
      const ok   = Math.abs(sum - r.total) < 0.05;

      setCell(ws1, row, C_ACCT, r.acct,
        cellStyle({ bg, fg: '0F766E', sz: 9, ha: 'left', border: dataBorder }));
      setCell(ws1, row, C_DESC, r.desc,
        cellStyle({ bg, fg: '1E293B', ha: 'right', va: 'center', rtl: true, border: dataBorder }));
      setCell(ws1, row, C_TOT, r.total,
        cellStyle({ bg: 'FFFBEB', fg: '92400E', bold: true, ha: 'right', border: dataBorder, nf: NF }));
      r.amounts.forEach((a, mi) =>
        setCell(ws1, row, C_M0 + mi, a,
          cellStyle({ bg: ri === 0 && r.firstAdjusted ? 'FEF3C7' : bg,
                      fg: '1E293B', ha: 'right', border: dataBorder, nf: NF })));
      setCell(ws1, row, C_SUM, sum,
        cellStyle({ bg: ok ? 'F0FDF4' : 'FEF2F2',
                    fg: ok ? '166534' : '991B1B',
                    bold: true, ha: 'right', border: dataBorder, nf: NF }));
      if (hasNotes)
        setCell(ws1, row, C_NOTES, r.notes || '',
          cellStyle({ bg: 'FAFAFA', fg: '64748B', italic: true, ha: 'right', rtl: true, border: dataBorder }));
      row++;
    });

    // ── blank gap
    for (let c = 0; c < COLS; c++)
      setCell(ws1, row, c, '', cellStyle({ bg: 'F1F5F9' }));
    row++;

    // ── totals row
    const grandTotal = round2(result.reduce((s, r) => s + r.total, 0));
    const colTotals  = months.map((_, mi) =>
      round2(result.reduce((s, r) => s + r.amounts[mi], 0)));
    const grandSum   = round2(colTotals.reduce((a, b) => a + b, 0));
    const totBorder  = { top: 'medium', bottom: 'medium', color: '1E3A5F' };

    setCell(ws1, row, C_ACCT, '',         cellStyle({ bg: 'E2E8F0', border: totBorder }));
    setCell(ws1, row, C_DESC, 'الإجمالي',cellStyle({ bg: 'E2E8F0', bold: true, sz: 11,
                                                      ha: 'center', rtl: true, border: totBorder }));
    setCell(ws1, row, C_TOT, grandTotal,  cellStyle({ bg: 'FEF9C3', fg: '92400E', bold: true,
                                                       ha: 'right', border: totBorder, nf: NF }));
    colTotals.forEach((t, mi) =>
      setCell(ws1, row, C_M0 + mi, t,
        cellStyle({ bg: 'EFF6FF', fg: '1E3A5F', bold: true,
                    ha: 'right', border: totBorder, nf: NF })));
    setCell(ws1, row, C_SUM, grandSum,
      cellStyle({ bg: 'DCFCE7', fg: '166534', bold: true,
                  ha: 'right', border: totBorder, nf: NF }));
    if (hasNotes) setCell(ws1, row, C_NOTES, '', cellStyle({ bg: 'E2E8F0', border: totBorder }));

    // ── sheet range & cols
    ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } });
    ws1['!cols'] = [
      { wch: 16 }, { wch: 40 }, { wch: 18 },
      ...months.map(() => ({ wch: 13 })),
      { wch: 16 },
      ...(hasNotes ? [{ wch: 24 }] : []),
    ];
    ws1['!rows'] = [
      { hpt: 26 }, { hpt: 22 }, { hpt: 16 }, { hpt: 6 }, { hpt: 30 },
      ...result.map(() => ({ hpt: 18 })),
      { hpt: 6 }, { hpt: 24 },
    ];
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
    ];
    ws1['!sheetViews'] = [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6' }];

    /* ─────────────────────────────────────────
       SHEET 2 — cumulative
    ───────────────────────────────────────── */
    const ws2 = {};
    let row2 = 0;

    setCell(ws2, row2, 0, `جمهورية مصر العربية — ${entity}`,
      cellStyle({ bg: '1E3A5F', fg: 'FFFFFF', bold: true, sz: 13, ha: 'center', rtl: true }));
    for (let c = 1; c < COLS; c++) setCell(ws2, row2, c, '', cellStyle({ bg: '1E3A5F' }));
    row2++;

    setCell(ws2, row2, 0, `التراكمي للتدفقات النقدية — السنة المالية ${fiscal}`,
      cellStyle({ bg: '164E63', fg: 'E0F2FE', bold: true, sz: 11, ha: 'center', rtl: true }));
    for (let c = 1; c < COLS; c++) setCell(ws2, row2, c, '', cellStyle({ bg: '164E63' }));
    row2++;

    setCell(ws2, row2, 0, `تاريخ الإصدار: ${today}`,
      cellStyle({ bg: 'EBF4FF', fg: '475569', sz: 9, ha: 'right', rtl: true }));
    for (let c = 1; c < COLS; c++) setCell(ws2, row2, c, '', cellStyle({ bg: 'EBF4FF' }));
    row2++;
    for (let c = 0; c < COLS; c++) setCell(ws2, row2, c, '', cellStyle({ bg: 'F8FAFC' }));
    row2++;

    setCell(ws2, row2, C_ACCT, 'كود الحساب',    hdrStyle('1A365D', 'FFFFFF'));
    setCell(ws2, row2, C_DESC, 'البيان',         hdrStyle('1A365D', 'FFFFFF'));
    setCell(ws2, row2, C_TOT,  'الاعتمادات',     hdrStyle('744210', 'FFFFFF'));
    months.forEach((m, mi) =>
      setCell(ws2, row2, C_M0 + mi,
        `تراكمي حتى\n${MONTH_NAMES[m]}`,
        hdrStyle('1A5276', 'FFFFFF')));
    setCell(ws2, row2, C_SUM, 'نسبة الإنجاز', hdrStyle('276749', 'FFFFFF'));
    if (hasNotes) setCell(ws2, row2, C_NOTES, 'ملاحظات', hdrStyle('475569', 'FFFFFF'));
    row2++;

    result.forEach((r, ri) => {
      const even = ri % 2 === 0;
      const bg   = even ? 'FFFFFF' : 'F0F9FF';
      let running = 0;
      const cumAmts = r.amounts.map(a => { running = round2(running + a); return running; });
      const pct = r.total > 0
        ? (round2(cumAmts[cumAmts.length - 1] / r.total * 100)).toFixed(1) + '%'
        : '0%';

      setCell(ws2, row2, C_ACCT, r.acct,
        cellStyle({ bg, fg: '0F766E', sz: 9, ha: 'left', border: dataBorder }));
      setCell(ws2, row2, C_DESC, r.desc,
        cellStyle({ bg, fg: '1E293B', ha: 'right', rtl: true, border: dataBorder }));
      setCell(ws2, row2, C_TOT, r.total,
        cellStyle({ bg: 'FFFBEB', fg: '92400E', bold: true, ha: 'right', border: dataBorder, nf: NF }));
      cumAmts.forEach((a, mi) =>
        setCell(ws2, row2, C_M0 + mi, a,
          cellStyle({ bg, fg: '1E293B', ha: 'right', border: dataBorder, nf: NF })));
      setCell(ws2, row2, C_SUM, pct,
        cellStyle({ bg: 'F0FDF4', fg: '166534', bold: true, ha: 'center', border: dataBorder }));
      if (hasNotes)
        setCell(ws2, row2, C_NOTES, r.notes || '',
          cellStyle({ bg: 'FAFAFA', fg: '64748B', italic: true, ha: 'right', rtl: true, border: dataBorder }));
      row2++;
    });

    ws2['!ref']       = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row2, c: COLS - 1 } });
    ws2['!cols']      = ws1['!cols'];
    ws2['!rows']      = ws1['!rows'];
    ws2['!merges']    = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
    ];
    ws2['!sheetViews'] = [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6' }];

    /* ── write ── */
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: 'خطة التدفقات النقدية', Author: entity };
    XLSX.utils.book_append_sheet(wb, ws1, 'خطة التدفقات النقدية');
    XLSX.utils.book_append_sheet(wb, ws2, 'التراكمي');
    XLSX.writeFile(wb, fileName);
    showToast(`📥 تم تصدير "${fileName}"`, 'success');

  } catch(err) {
    console.error('Export error:', err);
    showToast('⚠ خطأ في التصدير: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  buildChips();
  updateVarianceBadge(3);

  ['entityName','fiscalYear','numMonths','varianceLevel','capMinAmt','capMaxAmt']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', scheduleSave);
    });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      distribute();
    }
  });

  const loaded = loadFromStorage();
  if (!loaded) {
    addRow();
    addRow(); // two default blank rows
  }
  updateLiveTotal();
  refreshRowStates();
});
