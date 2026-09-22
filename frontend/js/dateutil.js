// Local-calendar date helpers mirroring backend/src/utils/date.js - avoid
// toISOString() for "today" (it shifts to UTC and can roll back a day in
// timezones ahead of UTC during early-morning hours).
function pad(n) { return String(n).padStart(2, '0'); }
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function today() { return localDateStr(new Date()); }
export function addDaysStr(dateStr, delta) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}
export function pastDate(days) { return addDaysStr(today(), -days); }
export function formatMoney(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatLiters(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
