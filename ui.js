/* ═══════════════════════════════════════════════
   UI STATE
═══════════════════════════════════════════════ */
let selectedStart = null;
let rowCounter    = 0;
let notesVisible  = false;

/* ═══════════════════════════════════════════════
   LOCALSTORAGE AUTO-SAVE
═══════════════════════════════════════════════ */
const LS_KEY = 'budgetDist_v4';
let saveTimer = null;

function scheduleSave() {
  const ind = document.getElementById('autosaveIndicator');
  const txt = document.getElementById('autosaveText');
  if (ind) { ind.className = 'autosave-indicator saving'; txt.textContent = 'يحفظ...'; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 1200);
}

function saveToStorage() {
  try {
    const rows = [...document.querySelectorAll('#itemsBody tr')].map(tr => ({
      acct:  tr.querySelector('td:nth-child(2) input')?.value || '',
      desc:  tr.querySelector('td:nth-child(3) input')?.value || '',
      total: tr.querySelector('td:nth-child(4) input')?.value || '',
      first: tr.querySelector('.first-col input')?.value      || '',
      notes: tr.querySelector('.notes-col input')?.value      || '',
    }));
    const state = {
      rows,
      entity:     document.getElementById('entityName')?.value    || '',
      fiscal:     document.getElementById('fiscalYear')?.value    || '',
      numMonths:  document.getElementById('numMonths')?.value     || '12',
      variance:   document.getElementById('varianceLevel')?.value || '3',
      startMonth: selectedStart,
      useFirst:   document.getElementById('useFirstFixed')?.checked || false,
      capEnabled: document.getElementById('capEnabled')?.checked   || false,
      capMin:     document.getElementById('capMinAmt')?.value      || '',
      capMax:     document.getElementById('capMaxAmt')?.value      || '',
      notesVisible,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    const ind = document.getElementById('autosaveIndicator');
    const txt = document.getElementById('autosaveText');
    if (ind) {
      ind.className = 'autosave-indicator saved';
      txt.textContent = 'محفوظ ✔';
      setTimeout(() => { ind.className = 'autosave-indicator'; txt.textContent = 'محفوظ'; }, 2500);
    }
  } catch(e) { console.warn('localStorage save failed', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);

    if (s.entity)    document.getElementById('entityName').value    = s.entity;
    if (s.fiscal)    document.getElementById('fiscalYear').value    = s.fiscal;
    if (s.numMonths) document.getElementById('numMonths').value     = s.numMonths;
    if (s.variance)  document.getElementById('varianceLevel').value = s.variance;
    updateVarianceBadge(s.variance || 3);

    if (s.startMonth) { selectedStart = s.startMonth; buildChips(); }

    if (s.useFirst) {
      document.getElementById('useFirstFixed').checked = true;
      document.getElementById('firstMonthHeader').style.display = '';
      const capSec = document.getElementById('capSection');
      if (capSec) capSec.classList.remove('cap-hidden');
    }
    if (s.capEnabled) {
      document.getElementById('capEnabled').checked = true;
      const inputs   = document.getElementById('capInputs');
      const rangeBar = document.getElementById('capRangeBar');
      if (inputs)   inputs.style.display   = 'flex';
      if (rangeBar) rangeBar.style.display = 'block';
      const capSec = document.getElementById('capSection');
      if (capSec) capSec.classList.add('cap-active');
    }
    if (s.capMin) document.getElementById('capMinAmt').value = s.capMin;
    if (s.capMax) document.getElementById('capMaxAmt').value = s.capMax;

    if (typeof s.notesVisible === 'boolean' && s.notesVisible !== notesVisible) toggleNotes();

    if (s.rows && s.rows.length) {
      document.getElementById('itemsBody').innerHTML = '';
      rowCounter = 0;
      s.rows.forEach(r => addRow(r.acct, r.desc, r.total, r.first, r.notes));
      if (!s.useFirst) document.querySelectorAll('.first-col').forEach(el => el.style.display = 'none');
      refreshRowStates();
      updateRowCount();
    }
    return true;
  } catch(e) { console.warn('localStorage load failed', e); return false; }
}

/* ═══════════════════════════════════════════════
   MONTH CHIPS
═══════════════════════════════════════════════ */
function buildChips() {
  const container = document.getElementById('monthChips');
  container.innerHTML = '';
  if (!selectedStart) selectedStart = 1;
  for (let m = 1; m <= 12; m++) {
    const chip = document.createElement('div');
    chip.className = 'mchip' + (m === selectedStart ? ' active' : '');
    chip.textContent = MONTH_NAMES[m];
    chip.addEventListener('click', () => {
      document.querySelectorAll('.mchip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedStart = m;
      scheduleSave();
    });
    container.appendChild(chip);
  }
}

/* ═══════════════════════════════════════════════
   TOGGLE — FIRST-MONTH COLUMN
═══════════════════════════════════════════════ */
document.getElementById('useFirstFixed').addEventListener('change', function () {
  const show = this.checked;
  document.getElementById('firstMonthHeader').style.display = show ? '' : 'none';
  document.querySelectorAll('.first-col').forEach(el => (el.style.display = show ? '' : 'none'));
  const capSec = document.getElementById('capSection');
  if (capSec) capSec.classList.toggle('cap-hidden', !show);
  if (show) syncCapDisplay();
  scheduleSave();
});

/* ═══════════════════════════════════════════════
   NOTES TOGGLE
═══════════════════════════════════════════════ */
function toggleNotes() {
  notesVisible = !notesVisible;
  const btn = document.getElementById('toggleNotesBtn');
  if (btn) btn.classList.toggle('active', notesVisible);
  const hdr = document.getElementById('notesHeader');
  if (hdr) hdr.style.display = notesVisible ? '' : 'none';
  document.querySelectorAll('.notes-col').forEach(el => {
    el.style.display = notesVisible ? '' : 'none';
  });
  if (document.getElementById('results').style.display !== 'none' && lastResult) {
    renderPreview(lastResult.months, lastResult.result, lastResult.cap);
  }
  scheduleSave();
}

/* ═══════════════════════════════════════════════
   ROW MANAGEMENT
═══════════════════════════════════════════════ */
function addRow(acct = '', desc = '', total = '', first = '', notes = '') {
  rowCounter++;
  const id        = rowCounter;
  const tbody     = document.getElementById('itemsBody');
  const showFirst = document.getElementById('useFirstFixed').checked;
  const showNotes = notesVisible ? '' : 'none';

  const tr = document.createElement('tr');
  tr.id = 'row-' + id;
  tr.innerHTML = `
    <td class="row-num">${id}</td>
    <td><input class="cell-input ltr" type="text"   placeholder="0000000000" value="${escapeHtml(acct)}" /></td>
    <td><input class="cell-input"     type="text"   placeholder="اسم البند"  value="${escapeHtml(desc)}" style="min-width:200px" /></td>
    <td><input class="cell-input num" type="number" placeholder="0.00"       value="${escapeHtml(total)}" min="0" step="0.01" /></td>
    <td class="first-col" style="display:${showFirst ? '' : 'none'}">
      <input class="cell-input num" type="number" placeholder="0.00" value="${escapeHtml(first)}" min="0" step="0.01" />
    </td>
    <td class="notes-col" style="display:${showNotes}">
      <input class="cell-input" type="text" placeholder="ملاحظة..." value="${escapeHtml(notes)}" />
    </td>
    <td style="text-align:center">
      <button class="del-btn" onclick="deleteRow(${id})" title="حذف">✕</button>
    </td>`;
  tbody.appendChild(tr);

  // wire up inputs — only schedule save & refresh, no ensureTrailingRow here
  tr.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      scheduleSave();
      refreshRowStates();
      updateRowCount();
    });
  });
}

function getAllRows()  { return [...document.querySelectorAll('#itemsBody tr')]; }
function isRowEmpty(tr) { return [...tr.querySelectorAll('input')].every(i => !i.value.trim()); }

function refreshRowStates() {
  getAllRows().forEach(tr => tr.classList.toggle('row-empty', isRowEmpty(tr)));
}

function updateLiveTotal() {
  const rows  = readRows();
  const total = rows.reduce((s, r) => s + r.total, 0);
  const el    = document.getElementById('liveTotal');
  const cnt   = document.getElementById('liveCount');
  if (el)  el.textContent  = fmt(round2(total));
  if (cnt) cnt.textContent = rows.length;
  syncCapDisplay();
}

function updateRowCount() {
  const filled = readRows().length;
  const badge  = document.getElementById('rowCountBadge');
  if (badge) badge.textContent = filled + ' بند';
  updateLiveTotal();
  refreshRowStates();
}

function closeResults() {
  document.getElementById('results').style.display = 'none';
}

function deleteRow(id) {
  const el = document.getElementById('row-' + id);
  if (el) {
    el.remove();
    renumberRows();
    updateRowCount();
    scheduleSave();
  }
}

function renumberRows() {
  getAllRows().forEach((tr, i) => {
    const num = tr.querySelector('.row-num');
    if (num) num.textContent = i + 1;
  });
}

function clearRows() {
  if (!confirm('هل تريد مسح جميع البنود؟\nسيتم حذف البيانات المحفوظة أيضاً.')) return;
  document.getElementById('itemsBody').innerHTML = '';
  rowCounter = 0;
  localStorage.removeItem(LS_KEY);
  addRow(); addRow(); // two default blank rows
  updateRowCount();
  const ind = document.getElementById('autosaveIndicator');
  const txt = document.getElementById('autosaveText');
  if (ind) { ind.className = 'autosave-indicator'; txt.textContent = 'تم المسح'; }
}

/* ═══════════════════════════════════════════════
   SAMPLE DATA
═══════════════════════════════════════════════ */
function addSampleData() {
  document.getElementById('itemsBody').innerHTML = '';
  rowCounter = 0;
  document.getElementById('useFirstFixed').checked = true;
  document.getElementById('firstMonthHeader').style.display = '';
  const capSec = document.getElementById('capSection');
  if (capSec) capSec.classList.remove('cap-hidden');
  SAMPLE.forEach(([acct, desc, total, first, notes]) => addRow(acct, desc, total, first, notes || ''));
  document.querySelectorAll('.first-col').forEach(el => (el.style.display = ''));
  updateRowCount();
  if (document.getElementById('capEnabled').checked) syncCapDisplay();
  scheduleSave();
}

/* ═══════════════════════════════════════════════
   READ INPUT ROWS
═══════════════════════════════════════════════ */
function readRows() {
  const useFirst = document.getElementById('useFirstFixed').checked;
  return [...document.querySelectorAll('#itemsBody tr')]
    .map(tr => {
      const acctEl  = tr.querySelector('td:nth-child(2) input');
      const descEl  = tr.querySelector('td:nth-child(3) input');
      const totalEl = tr.querySelector('td:nth-child(4) input');
      const firstEl = tr.querySelector('.first-col input');
      const notesEl = tr.querySelector('.notes-col input');
      return {
        acct:  acctEl?.value.trim()          || '',
        desc:  descEl?.value.trim()          || '',
        total: parseFloat(totalEl?.value)    || 0,
        first: useFirst ? (parseFloat(firstEl?.value) || 0) : null,
        notes: notesEl?.value.trim()         || '',
      };
    })
    .filter(r => r.total > 0);
}

/* ═══════════════════════════════════════════════
   SMART PASTE  (paste from Excel into any cell)
═══════════════════════════════════════════════ */
function getInputColIndex(input) {
  const td = input.closest('td');
  const tr = td.closest('tr');
  return [...tr.children].indexOf(td);
}
function getInputAt(tr, colIndex) {
  const td = tr.children[colIndex];
  return td ? td.querySelector('input') : null;
}
function cleanNumericPaste(val) {
  let c = val
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[,،٬]/g, '')
    .replace(/[^\d.\-]/g, '');
  const parts = c.split('.');
  if (parts.length > 2) c = parts[0] + '.' + parts.slice(1).join('');
  return c;
}

document.getElementById('itemsBody').addEventListener('paste', function (e) {
  const target = e.target;
  if (target.tagName !== 'INPUT') return;
  const raw = (e.clipboardData || window.clipboardData).getData('text');
  if (!raw) return;

  const lines = raw.split('\n').map(l => l.replace(/\r/g, ''));
  if (lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) return;

  const isMultiCol = lines.some(l => l.includes('\t'));

  if (isMultiCol) {
    e.preventDefault();
    const grid       = lines.map(l => l.split('\t'));
    const startTr    = target.closest('tr');
    const startIndex = getAllRows().indexOf(startTr);
    if (startIndex === -1) return;
    const colIndex   = getInputColIndex(target);

    // add rows if needed
    const needed = startIndex + grid.length - getAllRows().length;
    for (let i = 0; i < needed; i++) addRow();

    const freshRows = getAllRows();
    grid.forEach((cols, ri) => {
      const tr = freshRows[startIndex + ri];
      if (!tr) return;
      cols.forEach((val, ci) => {
        const input = getInputAt(tr, colIndex + ci);
        if (!input) return;
        input.value = input.type === 'number' ? cleanNumericPaste(val.trim()) : val.trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    updateRowCount();
    scheduleSave();
    showToast(`✔ تم لصق ${grid.length} صف`);
    return;
  }

  // single-column multi-row paste
  const trimmed = lines.map(l => l.trim());
  if (trimmed.length <= 1) {
    if (target.type === 'number') {
      e.preventDefault();
      target.value = cleanNumericPaste(trimmed[0] || '');
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }

  e.preventDefault();
  const colIndex   = getInputColIndex(target);
  const allRows    = getAllRows();
  const startIndex = allRows.indexOf(target.closest('tr'));
  if (startIndex === -1) return;

  const needed = startIndex + trimmed.length - allRows.length;
  for (let i = 0; i < needed; i++) addRow();

  const freshRows = getAllRows();
  trimmed.forEach((val, i) => {
    const tr    = freshRows[startIndex + i];
    if (!tr) return;
    const input = getInputAt(tr, colIndex);
    if (!input) return;
    input.value = input.type === 'number' ? cleanNumericPaste(val) : val;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const lastInput = getInputAt(freshRows[startIndex + trimmed.length - 1], colIndex);
  if (lastInput) lastInput.focus();
  updateRowCount();
  scheduleSave();
  showToast(`✔ تم لصق ${trimmed.length} قيمة`);
});

/* ═══════════════════════════════════════════════
   RENDER PREVIEW TABLE
═══════════════════════════════════════════════ */
function renderPreview(months, result, cap) {
  /* ── Header ── */
  let hRow = '<tr><th>الحساب</th><th>البيان</th><th class="th-credits">الاعتمادات</th>';
  months.forEach(m => {
    hRow += `<th class="th-month">${MONTH_NAMES[m]}<br><small style="font-weight:400;opacity:.7">(${MONTH_EN[m]})</small></th>`;
  });
  hRow += '<th class="sep-col"></th><th class="th-sum">المجموع</th>';
  if (notesVisible) hRow += '<th class="th-notes">ملاحظات</th>';
  hRow += '</tr>';
  document.getElementById('previewHead').innerHTML = hRow;

  /* ── Body ── */
  const tbody = document.getElementById('previewBody');
  tbody.innerHTML = '';

  result.forEach(r => {
    const sum = round2(r.amounts.reduce((a, b) => a + b, 0));
    const ok  = Math.abs(sum - r.total) < 0.05;
    let row   = '<tr>'
      + `<td class="acct">${escapeHtml(r.acct)}</td>`
      + `<td class="desc" title="${escapeHtml(r.desc)}">${escapeHtml(r.desc)}</td>`
      + `<td class="td-credits">${fmt(r.total)}</td>`;
    r.amounts.forEach((a, mi) => {
      row += `<td class="${mi === 0 && r.firstAdjusted ? 'num first-adj' : 'num'}">${fmt(a)}</td>`;
    });
    row += '<td class="sep-col"></td>';
    row += `<td class="td-sum ${ok ? '' : 'sum-err'}">${fmt(sum)}</td>`;
    if (notesVisible) row += `<td class="td-notes">${escapeHtml(r.notes || '')}</td>`;
    row += '</tr>';
    tbody.insertAdjacentHTML('beforeend', row);
  });

  /* ── Separator ── */
  const sepCount = 3 + months.length + 1 + 1 + (notesVisible ? 1 : 0);
  tbody.insertAdjacentHTML('beforeend',
    `<tr class="sep-row">${'<td class="sep-col"></td>'.repeat(sepCount)}</tr>`);

  /* ── Footer ── */
  const grandTotal = round2(result.reduce((s, r) => s + r.total, 0));
  const colTotals  = months.map((_, mi) => round2(result.reduce((s, r) => s + r.amounts[mi], 0)));
  const grandSum   = round2(colTotals.reduce((a, b) => a + b, 0));

  let fRow = '<tr><td class="lbl" colspan="2">الإجمالي</td>'
    + `<td class="td-credits">${fmt(grandTotal)}</td>`;
  colTotals.forEach(t => { fRow += `<td>${fmt(t)}</td>`; });
  fRow += `<td class="sep-col"></td><td class="td-sum">${fmt(grandSum)}</td>`;
  if (notesVisible) fRow += '<td></td>';
  fRow += '</tr>';
  document.getElementById('previewFoot').innerHTML = fRow;

  /* ── Status chips ── */
  const diffOk      = Math.abs(grandSum - grandTotal) < 0.05;
  const adjustedCnt = result.filter(r => r.firstAdjusted).length;
  const entity      = document.getElementById('entityName')?.value || '';
  const fiscal      = document.getElementById('fiscalYear')?.value || '';

  document.getElementById('statusBar').innerHTML = [
    entity ? `<div class="stat-chip gold"><span class="stat-chip-label">الجهة</span><span class="stat-chip-val">${escapeHtml(entity)}</span></div>` : '',
    fiscal ? `<div class="stat-chip gold"><span class="stat-chip-label">السنة المالية</span><span class="stat-chip-val">${fiscal}</span></div>` : '',
    `<div class="stat-chip gold"><span class="stat-chip-label">عدد البنود</span><span class="stat-chip-val">${result.length}</span></div>`,
    `<div class="stat-chip gold"><span class="stat-chip-label">عدد الشهور</span><span class="stat-chip-val">${months.length}</span></div>`,
    `<div class="stat-chip"><span class="stat-chip-label">إجمالي الاعتمادات</span><span class="stat-chip-val">${fmt(grandTotal)} ج</span></div>`,
    `<div class="stat-chip ${diffOk ? 'ok' : 'warn'}"><span class="stat-chip-label">إجمالي التوزيع ${diffOk ? '✔' : '⚠'}</span><span class="stat-chip-val">${fmt(grandSum)} ج</span></div>`,
    `<div class="stat-chip"><span class="stat-chip-label">متوسط الشهر</span><span class="stat-chip-val">${fmt(round2(grandTotal / months.length))} ج</span></div>`,
    adjustedCnt > 0 ? `<div class="stat-chip warn"><span class="stat-chip-label">⚠ تم تعديل الشهر الأول</span><span class="stat-chip-val">${adjustedCnt} بند</span></div>` : '',
  ].join('');

  const resultsEl = document.getElementById('results');
  resultsEl.style.display = 'block';
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3200);
}
