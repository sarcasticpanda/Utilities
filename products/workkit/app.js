import { clockMinutes } from './time.js';

const revealElements = document.querySelectorAll('[data-reveal]');
if (revealElements.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  revealElements.forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
}

const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const currencyLocales = { USD: 'en-US', INR: 'en-IN', GBP: 'en-GB', EUR: 'en-IE', CAD: 'en-CA', AUD: 'en-AU', AED: 'en-AE' };
const currencyCode = () => document.querySelector('#currency')?.value || 'USD';
const moneyFor = (value, currency) => new Intl.NumberFormat(currencyLocales[currency] || 'en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
const money = (value) => moneyFor(value, currencyCode());
const number = (value, places = 2) => (Number.isFinite(value) ? value : 0).toFixed(places);
const page = document.body.dataset.page;

if (page === 'timecard') {
  const list = document.querySelector('#shift-list');
  const template = document.querySelector('#shift-template');
  const rate = document.querySelector('#hourly-rate');
  const currency = document.querySelector('#currency');
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
    try { localStorage.setItem(key, JSON.stringify({ shifts: readRows(), rate: rate.value, threshold: threshold.value, currency: currency.value })); }
    catch { document.querySelector('#save-status').textContent = 'Saving is unavailable in this browser'; }
  }

  function calculate() {
    const rows = readRows();
    let totalMinutes = 0;
    let invalid = '';
    const scheduled = [];
    for (const row of rows) {
      const breakMinutes = Number(row.breakMinutes);
      if (!row.start && !row.end) continue;
      if (!row.start || !row.end) { invalid = 'Enter both a start and end time for each shift.'; continue; }
      if (!Number.isFinite(breakMinutes) || breakMinutes < 0) { invalid = 'Break minutes must be zero or more.'; continue; }
      if (row.start === row.end) { invalid = 'Start and end times cannot match. Change one time so the shift length is clear.'; continue; }
      const mins = clockMinutes(row);
      if (breakMinutes > mins) { invalid = 'A break cannot be longer than its shift.'; continue; }
      const dayOffset = dayNames.indexOf(row.day) * 1440;
      const [startHour, startMinute] = row.start.split(':').map(Number);
      const [endHour, endMinute] = row.end.split(':').map(Number);
      const startAt = dayOffset + startHour * 60 + startMinute;
      let endAt = dayOffset + endHour * 60 + endMinute;
      if (endAt <= startAt) endAt += 1440;
      scheduled.push({ startAt, endAt });
      totalMinutes += mins - breakMinutes;
    }
    const weekMinutes = 7 * 1440;
    for (let i = 0; i < scheduled.length && !invalid; i++) {
      for (let j = i + 1; j < scheduled.length && !invalid; j++) {
        const overlaps = [-weekMinutes, 0, weekMinutes].some((offset) =>
          scheduled[i].startAt < scheduled[j].endAt + offset && scheduled[j].startAt + offset < scheduled[i].endAt
        );
        if (overlaps) invalid = 'Shifts overlap. Adjust the times so the same minutes are not counted twice.';
      }
    }
    if (invalid) {
      msg.textContent = invalid;
      ['#total-hours','#decimal-hours','#regular-hours','#overtime-hours','#gross-pay','#hours-minutes'].forEach((selector) => { document.querySelector(selector).textContent = '—'; });
      lastTotals = null;
      return;
    }
    msg.textContent = '';
    const hours = totalMinutes / 60;
    const otAfter = Number(threshold.value || 40);
    const regular = Math.min(hours, otAfter);
    const overtime = Math.max(0, hours - otAfter);
    const hourly = Number(rate.value || 0);
    const gross = regular * hourly + overtime * hourly * 1.5;
    document.querySelector('#total-hours').textContent = number(hours);
    document.querySelector('#decimal-hours').textContent = number(hours);
    const wholeMinutes = Math.round(totalMinutes);
    document.querySelector('#hours-minutes').textContent = `${Math.floor(wholeMinutes / 60)}h ${String(wholeMinutes % 60).padStart(2, '0')}m`;
    document.querySelector('#regular-hours').textContent = number(regular);
    document.querySelector('#overtime-hours').textContent = number(overtime);
    document.querySelector('#gross-pay').textContent = money(gross);
    lastTotals = { rows, hours, regular, overtime, gross };
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && Array.isArray(saved.shifts) && saved.shifts.length) {
        saved.shifts.forEach(addRow);
        rate.value = saved.rate || '';
        threshold.value = saved.threshold || '40';
        if (saved.currency && [...currency.options].some((option) => option.value === saved.currency)) currency.value = saved.currency;
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
  const updateCurrencyLabel = () => {
    const code = currency.value;
    const locale = currencyLocales[code] || 'en-US';
    document.querySelector('#currency-symbol').textContent = new Intl.NumberFormat(locale, { style: 'currency', currency: code }).formatToParts(0).find((part) => part.type === 'currency')?.value || code;
    calculate(); saveDraft();
  };
  currency.addEventListener('change', updateCurrencyLabel);
  document.querySelector('#export-csv').addEventListener('click', () => {
    calculate();
    if (!lastTotals || msg.textContent) { msg.textContent = msg.textContent || 'Add at least one complete shift before exporting.'; return; }
    const rows = [['Day','Start','End','Unpaid break minutes','Hours'], ...lastTotals.rows.map((r) => {
      const m = r.start && r.end ? clockMinutes(r) : 0;
      const h = r.start && r.end ? Math.max(0, m - r.breakMinutes) / 60 : 0;
      return [r.day, r.start, r.end, r.breakMinutes, number(h)];
    }), ['Total','','','',number(lastTotals.hours)], ['Estimated gross pay',money(lastTotals.gross)]];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'workkit-timesheet.csv' }); a.click(); URL.revokeObjectURL(url);
  });
  document.querySelector('#print-timesheet').addEventListener('click', () => {
    calculate();
    if (!lastTotals || !lastTotals.rows.some((row) => row.start && row.end)) { msg.textContent = msg.textContent || 'Add at least one complete shift before printing.'; return; }
    window.print();
  });
  restore(); updateCurrencyLabel();
}

if (page === 'overtime') {
  const form = document.querySelector('#overtime-form');
  const sourceCurrency = document.querySelector('#currency');
  const targetCurrency = document.querySelector('#ot-target-currency');
  const fxAmount = document.querySelector('#ot-fx-pay');
  const fxStatus = document.querySelector('#ot-fx-rate');
  const fxRates = new Map();
  let overtimeGross = null;
  let fxRequestId = 0;

  async function updateOvertimeCurrency(forceRefresh = false) {
    const requestId = ++fxRequestId;
    if (!Number.isFinite(overtimeGross)) {
      fxAmount.textContent = '—';
      fxStatus.textContent = 'Calculate your overtime pay to see the reference conversion.';
      return;
    }
    const base = sourceCurrency.value;
    const quote = targetCurrency.value;
    if (base === quote) {
      fxAmount.textContent = moneyFor(overtimeGross, quote);
      fxStatus.textContent = `Same currency selected · ${base} estimate shown above.`;
      return;
    }
    const key = `${base}/${quote}`;
    if (forceRefresh) fxRates.delete(key);
    fxStatus.textContent = 'Loading the latest daily reference rate…';
    try {
      let observation = fxRates.get(key);
      if (!observation) {
        const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`, { headers: { Accept: 'application/json' }, cache: forceRefresh ? 'no-cache' : 'default' });
        if (!response.ok) throw new Error(`Rate service returned ${response.status}.`);
        const data = await response.json();
        const rate = Number(data.rate);
        if (!(rate > 0) || data.base !== base || data.quote !== quote || !/^\d{4}-\d{2}-\d{2}$/u.test(data.date)) throw new Error('Rate response was incomplete.');
        observation = { rate, date: data.date };
        fxRates.set(key, observation);
      }
      if (requestId !== fxRequestId) return;
      fxAmount.textContent = moneyFor(overtimeGross * observation.rate, quote);
      const formattedRate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(observation.rate);
      fxStatus.textContent = `1 ${base} = ${formattedRate} ${quote} · daily mid-market reference · ${observation.date} · Frankfurter`;
    } catch {
      if (requestId !== fxRequestId) return;
      fxAmount.textContent = '—';
      fxStatus.textContent = 'A reference rate is unavailable right now. Check your connection and refresh to try again.';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const hours = Number(document.querySelector('#ot-hours').value);
    const after = Number(document.querySelector('#ot-after').value);
    const rate = Number(document.querySelector('#ot-rate').value);
    const multiplier = Number(document.querySelector('#ot-multiplier').value);
    const regular = Math.min(hours, after);
    const overtime = Math.max(0, hours - after);
    document.querySelector('#ot-regular').textContent = number(regular);
    document.querySelector('#ot-extra').textContent = number(overtime);
    overtimeGross = regular * rate + overtime * rate * multiplier;
    document.querySelector('#ot-pay').textContent = money(overtimeGross);
    updateOvertimeCurrency();
  });
  document.querySelector('#currency').addEventListener('change', () => { if (form.checkValidity()) form.requestSubmit(); });
  targetCurrency.addEventListener('change', () => updateOvertimeCurrency());
  document.querySelector('#ot-fx-refresh').addEventListener('click', () => updateOvertimeCurrency(true));
}

if (page === 'salary') {
  const form = document.querySelector('#salary-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const total = Number(document.querySelector('#salary-rate').value) * Number(document.querySelector('#salary-hours').value) * Number(document.querySelector('#salary-weeks').value);
    document.querySelector('#annual-pay').textContent = money(total);
    document.querySelector('#monthly-pay').textContent = money(total / 12);
    document.querySelector('#weekly-pay').textContent = money(total / Math.max(1, Number(document.querySelector('#salary-weeks').value)));
  });
  document.querySelector('#currency').addEventListener('change', () => { if (form.checkValidity()) form.requestSubmit(); });
}
