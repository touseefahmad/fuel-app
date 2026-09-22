import { pastDate, today, formatMoney, formatLiters } from '../dateutil.js';
import { getToken } from '../api.js';

export async function renderReports(root, { state, api, escapeHtml }) {
  const from = pastDate(29);
  const to = today();

  root.innerHTML = `
    <div class="section-title"><h2>Reports</h2></div>
    <div class="toolbar">
      <div class="field" style="max-width:170px"><label>From</label><input type="date" id="from" value="${from}" /></div>
      <div class="field" style="max-width:170px"><label>To</label><input type="date" id="to" value="${to}" /></div>
      <button id="load-report">Load</button>
      <button class="secondary" id="download-csv">Download CSV</button>
    </div>
    <div id="report-body"><p class="muted">Loading...</p></div>
  `;

  const body = document.getElementById('report-body');

  async function load() {
    const f = document.getElementById('from').value;
    const t = document.getElementById('to').value;
    body.innerHTML = '<p class="muted">Loading...</p>';
    const { entries } = await api.get(`/api/sites/${state.siteId}/entries?from=${f}&to=${t}`);
    if (entries.length === 0) {
      body.innerHTML = '<div class="card"><p class="muted">No entries saved in this date range yet.</p></div>';
      return;
    }
    body.innerHTML = `
      <div class="card">
        <table>
          <thead><tr><th>Date</th><th>Status</th><th class="num">Sales (L)</th><th class="num">Sales Amount</th><th class="num">Variance (L)</th><th class="num">Variance Amount</th><th class="num">Closing Stock Value</th></tr></thead>
          <tbody>
            ${entries.map((e) => `
              <tr>
                <td><a href="#/entry/${e.entry_date}">${e.entry_date}</a></td>
                <td><span class="badge ${e.status}">${e.status}</span></td>
                <td class="num">${formatLiters(e.totals.meter_sales_liters)}</td>
                <td class="num">Rs ${formatMoney(e.totals.meter_sales_amount)}</td>
                <td class="num">${formatLiters(e.totals.variance_liters)}</td>
                <td class="num">Rs ${formatMoney(e.totals.variance_amount)}</td>
                <td class="num">Rs ${formatMoney(e.totals.closing_stock_value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('load-report').addEventListener('click', load);
  document.getElementById('download-csv').addEventListener('click', () => {
    const f = document.getElementById('from').value;
    const t = document.getElementById('to').value;
    const url = `/api/sites/${state.siteId}/reports/export.csv?from=${f}&to=${t}`;
    fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `fuel_report_${f}_to_${t}.csv`;
        link.click();
      });
  });

  await load();
}
