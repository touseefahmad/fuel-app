// Local-calendar date helpers. Deliberately avoid Date#toISOString() for
// "what is today's date" style calculations: toISOString() converts to UTC,
// which silently rolls back to the previous day during early-morning hours
// in timezones ahead of UTC (e.g. Asia/Karachi, UTC+5, between 00:00-05:00
// local). Everything here stays in local calendar-date arithmetic instead,
// which is what a fuel station operator means by "today".
function pad(n) { return String(n).padStart(2, '0'); }

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function today() { return localDateStr(new Date()); }

function addDaysStr(dateStr, delta) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

function pastDate(days) { return addDaysStr(today(), -days); }

function enumerateDates(from, to) {
  const dates = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 5000) {
    dates.push(cur);
    cur = addDaysStr(cur, 1);
    guard++;
  }
  return dates;
}

module.exports = { today, pastDate, addDaysStr, enumerateDates };
