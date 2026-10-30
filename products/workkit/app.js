const revealElements = document.querySelectorAll('[data-reveal]');
if (revealElements.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  revealElements.forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
}

const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(value) ? value : 0);
const number = (value, places = 2) => (Number.isFinite(value) ? value : 0).toFixed(places);
const page = document.body.dataset.page;

if (page === 'timecard') {
  const list = document.querySelector('#shift-list');
  const template = document.querySelector('#shift-template');
  const rate = document.querySelector('#hourly-rate');
  const threshold = document.querySelector('#ot-threshold');
  const msg = document.querySelector('#form-message');
  const key = 'workkit-timesheet-v1';
  let lastTotals = null;

  function addRow(data = {}) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('.shift-day').value = data.day || dayNames[Math.min(list.children.length, 6)];
    row.querySelector('.shift-start').value = data.start || '';
    row.querySelector('.shift-end').value = data.end || '';
    row.querySelector('.shift-break').value = Number.isFinite(data.breakMinutes) ? data.breakMinutes : 0;
    row.querySelector('.remove-shift').addEventListener('click', () => { row.remove(); saveDraft(); calculate(); });
    row.querySelectorAll('input,select').forEach((input) => input.addEventListener('input', () => { saveDraft(); calculate(); }));
    list.append(row);
  }

  function readRows() {
    return [...list.children].map((row) => ({
      day: row.querySelector('.shift-day').value,
      start: row.querySelector('.shift-start').value,
      end: row.querySelector('.shift-end').value,
      breakMinutes: Number(row.querySelector('.shift-break').value || 0)
    }));
  }

  function saveDraft() {
    try { localStorage.setItem(key, JSON.stringify({ shifts: readRows(), rate: rate.value, threshold: threshold.value })); }
    catch { document.querySelector('#save-status').textContent = 'Saving is unavailable in this browser'; }
  }

  function calculate() {
    const rows = readRows();
    let totalMinutes = 0;
    let invalid = '';
    for (const row of rows) {
      const breakMinutes = Number(row.breakMinutes);
      if (!row.start && !row.end) continue;
      if (!row.start || !row.end) { invalid = 'Enter both a start and end time for each shift.'; continue; }
      if (!Number.isFinite(breakMinutes) || breakMinutes < 0) { invalid = 'Break minutes must be zero or more.'; continue; }
      const [sh, sm] = row.start.split(':').map(Number);
      const [eh, em] = row.end.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins === 0) { invalid = 'Start and end times cannot match. Change one time so the shift length is clear.'; continue; }
      if (mins < 0) mins += 1440;
      if (breakMinutes > mins) { invalid = 'A break cannot be longer than its shift.'; continue; }
      totalMinutes += mins - breakMinutes;
    }
    msg.textContent = invalid;
    const hours = totalMinutes / 60;
    const otAfter = Number(threshold.value || 40);
    const regular = Math.min(hours, otAfter);
    const overtime = Math.max(0, hours - otAfter);
    const hourly = Number(rate.value || 0);
    const gross = regular * hourly + overtime * hourly * 1.5;
    document.querySelector('#total-hours').textContent = number(hours);
    document.querySelector('#decimal-hours').textContent = number(hours);
    document.querySelector('#regular-hours').textContent = number(regular);
    document.querySelector('#overtime-hours').textContent = number(overtime);
    document.querySelector('#gross-pay').textContent = money(gross);
    lastTotals = { rows, hours, regular, overtime, gross };
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && Array.isArray(saved.shifts) && saved.shifts.length) {
        saved.shifts.slice(0, 14).forEach(addRow);
        rate.value = saved.rate || '';
        threshold.value = saved.threshold || '40';
        return;
      }
    } catch { /* Start with an empty timesheet when saved data is malformed. */ }
    addRow({ day: 'Monday' });
  }

  document.querySelector('#add-shift').addEventListener('click', () => { addRow(); saveDraft(); });
  document.querySelector('#clear-shifts').addEventListener('click', () => { list.replaceChildren(); rate.value = ''; addRow(); saveDraft(); calculate(); });
  document.querySelector('#calculate').addEventListener('click', () => { calculate(); saveDraft(); });
  rate.addEventListener('input', () => { calculate(); saveDraft(); });
  threshold.addEventListener('input', () => { calculate(); saveDraft(); });
  document.querySelector('#export-csv').addEventListener('click', () => {
    calculate();
    if (!lastTotals || msg.textContent) { msg.textContent = msg.textContent || 'Add at least one complete shift before exporting.'; return; }
    const rows = [['Day','Start','End','Unpaid break minutes','Hours'], ...lastTotals.rows.map((r) => {
      const [sh, sm] = (r.start || '00:00').split(':').map(Number);
      const [eh, em] = (r.end || '00:00').split(':').map(Number);
      let m = eh * 60 + em - (sh * 60 + sm); if (m <= 0 && (r.start || r.end)) m += 1440;
      const h = r.start && r.end ? Math.max(0, m - r.breakMinutes) / 60 : 0;
      return [r.day, r.start, r.end, r.breakMinutes, number(h)];
    }), ['Total','','','',number(lastTotals.hours)], ['Estimated gross pay',money(lastTotals.gross)]];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'workkit-timesheet.csv' }); a.click(); URL.revokeObjectURL(url);
  });
  restore(); calculate();
}

if (page === 'overtime') {
  document.querySelector('#overtime-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const hours = Number(document.querySelector('#ot-hours').value);
    const after = Number(document.querySelector('#ot-after').value);
    const rate = Number(document.querySelector('#ot-rate').value);
    const multiplier = Number(document.querySelector('#ot-multiplier').value);
    const regular = Math.min(hours, after);
    const overtime = Math.max(0, hours - after);
    document.querySelector('#ot-regular').textContent = number(regular);
    document.querySelector('#ot-extra').textContent = number(overtime);
    document.querySelector('#ot-pay').textContent = money(regular * rate + overtime * rate * multiplier);
  });
}

if (page === 'salary') {
  document.querySelector('#salary-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const total = Number(document.querySelector('#salary-rate').value) * Number(document.querySelector('#salary-hours').value) * Number(document.querySelector('#salary-weeks').value);
    document.querySelector('#annual-pay').textContent = money(total);
    document.querySelector('#monthly-pay').textContent = money(total / 12);
    document.querySelector('#weekly-pay').textContent = money(total / Math.max(1, Number(document.querySelector('#salary-weeks').value)));
  });
}
