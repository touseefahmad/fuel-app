import { pastDate, today, formatMoney, formatLiters, formatDateLabel } from '../dateutil.js';
import { renderGroupedBarChart } from '../chart.js';

export async function renderDashboard(root, { state, api, escapeHtml }) {
  let from = pastDate(13);
  let to = today();

  root.innerHTML = `
    <div class="toolbar">
      <div class="field" style="max-width:170px">
        <label>From</label>
        <input type="date" id="from" value="${from}" />
      </div>
      <div class="field" style="max-width:170px">
        <label>To</label>
        <input type="date" id="to" value="${to}" />
      </div>
      <button class="secondary" id="range-7">Last 7 days</button>
      <button class="secondary" id="range-30">Last 30 days</button>
      <button id="refresh">Refresh</button>
    </div>
    <div id="dash-body"><p class="muted">Loading...</p></div>
  `;

  const body = document.getElementById('dash-body');

  async function load() {
    from = document.getElementById('from').value;
    to = document.getElementById('to').value;
    body.innerHTML = '<p class="muted">Loading...</p>';
    const siteParam = state.user.role === 'owner' ? 'all' : state.siteId;
    const data = await api.get(`/api/dashboard?site_id=${siteParam}&from=${from}&to=${to}`);
    renderBody(data);
  }

  function renderBody(data) {
    const t = data.totals;
    const netClass = t.variance_liters < 0 ? 'critical' : t.variance_liters > 0 ? 'good' : '';
    body.innerHTML = `
      <div class="grid cols-4">
        <div class="stat-tile">
          <div class="label">Total Sales</div>
          <div class="value">${formatLiters(t.sales_liters)} L</div>
          <div class="sub">Petrol + HSD, meter-based</div>
        </div>
        <div class="stat-tile">
          <div class="label">Sales Amount</div>
          <div class="value">Rs ${formatMoney(t.sales_amount)}</div>
          <div class="sub">${from} to ${to}</div>
        </div>
        <div class="stat-tile ${netClass}">
          <div class="label">Stock Variance (Gain/Loss)</div>
          <div class="value">${formatLiters(t.variance_liters)} L</div>
          <div class="sub">Dip stock vs. meter-implied stock</div>
        </div>
        <div class="stat-tile ${netClass}">
          <div class="label">Variance Value</div>
          <div class="value">Rs ${formatMoney(t.variance_amount)}</div>
          <div class="sub">Negative = loss, positive = gain</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><h3>Daily sales by product (Litres)</h3></div>
        <div id="sales-chart"></div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h3>By product (period totals)</h3>
          <table>
            <thead><tr><th>Product</th><th class="num">Sales (L)</th><th class="num">Sales Amount</th><th class="num">Variance (L)</th><th class="num">Latest Closing (L)</th></tr></thead>
            <tbody>
              ${data.perProductTotals.map((p) => `
                <tr>
                  <td>${escapeHtml(p.product_name)}</td>
                  <td class="num">${formatLiters(p.sales_liters)}</td>
                  <td class="num">Rs ${formatMoney(p.sales_amount)}</td>
                  <td class="num">${varianceCell(p.variance_liters)}</td>
                  <td class="num">${formatLiters(p.latest_closing_stock_liters)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="card">
          <h3>By site (latest entry)</h3>
          ${data.siteBreakdown.map((s) => `
            <div style="margin-bottom:14px">
              <strong>${escapeHtml(s.site_name)}</strong> <span class="muted">${s.as_of ? 'as of ' + s.as_of : '(no entries yet)'}</span>
              <table>
                <thead><tr><th>Product</th><th class="num">Closing Stock (L)</th><th class="num">Today's Variance</th></tr></thead>
                <tbody>
                  ${s.products.map((p) => `
                    <tr>
                      <td>${escapeHtml(p.product_name)}</td>
                      <td class="num">${formatLiters(p.actual_closing_liters)}</td>
                      <td class="num">${varianceCell(p.variance_liters)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const petrol = data.perProductTotals.find((p) => p.product_name.toLowerCase().includes('petrol'));
    const hsd = data.perProductTotals.find((p) => !p.product_name.toLowerCase().includes('petrol'));
    const dates = data.series.map((s) => s.date);
    // Need per-day per-product series - reconstruct from series (site-combined totals only give
    // combined sales); for a two-series chart we re-fetch is unnecessary - approximate using
    // proportion is wrong, so instead chart total sales_liters as series A and variance as series B
    // would mix units. Simplest correct approach: chart combined daily sales liters as one series
    // and combined variance liters as a second, both in litres.
    renderGroupedBarChart(document.getElementById('sales-chart'), {
      dates,
      seriesA: data.series.map((s) => Math.max(0, s.sales_liters)),
      seriesB: data.series.map((s) => Math.abs(Math.min(0, s.variance_liters))),
      labelA: 'Sales (L)',
      labelB: 'Stock loss (L)',
      valueFormatter: (v) => Math.round(v).toLocaleString(),
    });
  }

  function varianceCell(v) {
    if (v === null || v === undefined) return '-';
    const cls = v < -0.001 ? 'critical' : v > 0.001 ? 'good' : '';
    const sign = v > 0 ? '+' : '';
    return `<span class="${cls}">${sign}${formatLiters(v)}</span>`;
  }

  document.getElementById('refresh').addEventListener('click', load);
  document.getElementById('range-7').addEventListener('click', () => {
    document.getElementById('from').value = pastDate(6);
    document.getElementById('to').value = today();
    load();
  });
  document.getElementById('range-30').addEventListener('click', () => {
    document.getElementById('from').value = pastDate(29);
    document.getElementById('to').value = today();
    load();
  });

  await load();
}
