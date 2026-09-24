import { today, addDaysStr, formatMoney, formatLiters } from '../dateutil.js';

export async function renderEntry(root, { state, api, escapeHtml, params }) {
  const date = params[0] || today();

  root.innerHTML = `
    <div class="toolbar">
      <button class="secondary" id="prev-day">&larr; Prev day</button>
      <div class="field" style="max-width:180px">
        <label>Date</label>
        <input type="date" id="entry-date" value="${date}" max="${today()}" />
      </div>
      <button class="secondary" id="next-day">Next day &rarr;</button>
      <div class="spacer" style="flex:1"></div>
      <span id="status-badge"></span>
    </div>
    <div id="entry-error"></div>
    <form id="entry-form"></form>
  `;

  document.getElementById('prev-day').addEventListener('click', () => {
    location.hash = `#/entry/${addDaysStr(date, -1)}`;
  });
  document.getElementById('next-day').addEventListener('click', () => {
    location.hash = `#/entry/${addDaysStr(date, 1)}`;
  });
  document.getElementById('entry-date').addEventListener('change', (e) => {
    location.hash = `#/entry/${e.target.value}`;
  });

  const data = await api.get(`/api/sites/${state.siteId}/entries/${date}`);
  const isFinalized = data.entry.status === 'finalized';
  const canEdit = state.user.role === 'owner' || !isFinalized;

  document.getElementById('status-badge').innerHTML =
    `<span class="badge ${isFinalized ? 'finalized' : 'draft'}">${isFinalized ? 'Finalized' : 'Draft'}</span>`;

  const form = document.getElementById('entry-form');
  form.innerHTML = `
    <div class="card">
      <h3>Tank dip readings</h3>
      <p class="muted">Enter dip in millimetres. Opening dip is pre-filled from yesterday's closing dip - override if needed (e.g. first-ever entry).</p>
      ${data.tank_readings.map((t) => `
        <div class="tank-card">
          <h4>${escapeHtml(t.tank_name)} <span class="pill ${t.product_name.toLowerCase().includes('petrol') ? 'petrol' : 'hsd'}">${escapeHtml(t.product_name)}</span></h4>
          <div class="field-row">
            <div class="field">
              <label>Opening dip (mm)</label>
              <input type="number" step="0.1" class="tank-open" data-tank="${t.tank_id}" value="${t.opening_dip_mm ?? ''}" ${canEdit ? '' : 'disabled'} />
            </div>
            <div class="field">
              <label>Closing dip (mm)</label>
              <input type="number" step="0.1" class="tank-close" data-tank="${t.tank_id}" value="${t.closing_dip_mm ?? ''}" ${canEdit ? '' : 'disabled'} />
            </div>
            <div class="field">
              <label>Receipt / delivery (L)</label>
              <input type="number" step="0.1" class="tank-receipt" data-tank="${t.tank_id}" value="${t.receipt_liters ?? 0}" ${canEdit ? '' : 'disabled'} />
            </div>
            <div class="field">
              <label>Invoice / DO No.</label>
              <input type="text" class="tank-invoice" data-tank="${t.tank_id}" value="${escapeHtml(t.receipt_invoice_no ?? '')}" ${canEdit ? '' : 'disabled'} />
            </div>
          </div>
          <p class="muted" style="margin:6px 0 0">Tank capacity: ${formatLiters(t.capacity_liters)} L</p>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>Nozzle / dispenser meter readings</h3>
      <p class="muted">Opening meter is pre-filled from yesterday's closing meter. "Test litres" are excluded from sales (e.g. calibration draws).</p>
      ${data.nozzle_readings.map((n) => `
        <div class="nozzle-card">
          <h4>${escapeHtml(n.nozzle_name)} <span class="pill ${data.tank_readings.find(t=>t.product_id===n.product_id)?.product_name.toLowerCase().includes('petrol') ? 'petrol' : 'hsd'}">${escapeHtml(data.tank_readings.find(t=>t.product_id===n.product_id)?.product_name || '')}</span></h4>
          <div class="field-row">
            <div class="field">
              <label>Opening meter (L)</label>
              <input type="number" step="0.01" class="noz-open" data-nozzle="${n.nozzle_id}" value="${n.opening_meter ?? ''}" ${canEdit ? '' : 'disabled'} />
            </div>
            <div class="field">
              <label>Closing meter (L)</label>
              <input type="number" step="0.01" class="noz-close" data-nozzle="${n.nozzle_id}" value="${n.closing_meter ?? ''}" ${canEdit ? '' : 'disabled'} />
            </div>
            <div class="field">
              <label>Test litres</label>
              <input type="number" step="0.01" class="noz-test" data-nozzle="${n.nozzle_id}" value="${n.test_liters ?? 0}" ${canEdit ? '' : 'disabled'} />
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>Notes</h3>
      <textarea id="entry-notes" rows="2" ${canEdit ? '' : 'disabled'}>${escapeHtml(data.entry.notes ?? '')}</textarea>
    </div>

    <div class="toolbar">
      ${canEdit ? '<button type="submit">Save entry</button>' : ''}
      <button type="button" class="secondary" id="toggle-final">${isFinalized ? 'Reopen day' : 'Finalize day'}</button>
    </div>

    <div class="card" id="summary-card"></div>
  `;

  renderSummary(document.getElementById('summary-card'), data.summary, escapeHtml);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('entry-error');
    errBox.innerHTML = '';
    const tank_readings = data.tank_readings.map((t) => ({
      tank_id: t.tank_id,
      opening_dip_mm: numOrNull(form.querySelector(`.tank-open[data-tank="${t.tank_id}"]`).value),
      closing_dip_mm: numOrNull(form.querySelector(`.tank-close[data-tank="${t.tank_id}"]`).value),
      receipt_liters: numOrNull(form.querySelector(`.tank-receipt[data-tank="${t.tank_id}"]`).value) || 0,
      receipt_invoice_no: form.querySelector(`.tank-invoice[data-tank="${t.tank_id}"]`).value || null,
    }));
    const nozzle_readings = data.nozzle_readings.map((n) => ({
      nozzle_id: n.nozzle_id,
      opening_meter: numOrNull(form.querySelector(`.noz-open[data-nozzle="${n.nozzle_id}"]`).value),
      closing_meter: numOrNull(form.querySelector(`.noz-close[data-nozzle="${n.nozzle_id}"]`).value),
      test_liters: numOrNull(form.querySelector(`.noz-test[data-nozzle="${n.nozzle_id}"]`).value) || 0,
    }));
    const notes = document.getElementById('entry-notes').value;

    try {
      const result = await api.put(`/api/sites/${state.siteId}/entries/${date}`, { tank_readings, nozzle_readings, notes });
      renderSummary(document.getElementById('summary-card'), result.summary, escapeHtml);
      errBox.innerHTML = `<div class="info-box">Saved.</div>`;
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
  });

  document.getElementById('toggle-final').addEventListener('click', async () => {
    const errBox = document.getElementById('entry-error');
    try {
      await api.post(`/api/sites/${state.siteId}/entries/${date}/finalize`, { status: isFinalized ? 'draft' : 'finalized' });
      location.reload();
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
  });
}

function renderSummary(el, summary, escapeHtml) {
  el.innerHTML = `
    <h3>Summary for this day</h3>
    <table>
      <thead>
        <tr><th>Product</th><th class="num">Opening (L)</th><th class="num">Receipts (L)</th><th class="num">Meter Sales (L)</th>
          <th class="num">Expected Closing (L)</th><th class="num">Dip Closing (L)</th><th class="num">Variance (L)</th>
          <th class="num">Price/L</th><th class="num">Sales Amount</th><th class="num">Variance Amount</th></tr>
      </thead>
      <tbody>
        ${summary.products.map((p) => `
          <tr>
            <td>${escapeHtml(p.product_name)}</td>
            <td class="num">${formatLiters(p.opening_stock_liters)}</td>
            <td class="num">${formatLiters(p.receipts_liters)}</td>
            <td class="num">${formatLiters(p.meter_sales_liters)}</td>
            <td class="num">${formatLiters(p.expected_closing_liters)}</td>
            <td class="num">${formatLiters(p.actual_closing_liters)}</td>
            <td class="num"><span class="badge ${p.variance_type}">${p.variance_liters > 0 ? '+' : ''}${formatLiters(p.variance_liters)}</span></td>
            <td class="num">${p.price_per_liter ?? '-'}</td>
            <td class="num">Rs ${formatMoney(p.sales_amount)}</td>
            <td class="num">Rs ${formatMoney(p.variance_amount)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="8"><strong>Totals</strong></td>
          <td class="num"><strong>Rs ${formatMoney(summary.totals.meter_sales_amount)}</strong></td>
          <td class="num"><strong>Rs ${formatMoney(summary.totals.variance_amount)}</strong></td>
        </tr>
      </tfoot>
    </table>
  `;
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
