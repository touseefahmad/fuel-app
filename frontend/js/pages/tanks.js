import { formatLiters } from '../dateutil.js';

export async function renderTanks(root, { state, api, escapeHtml }) {
  const isOwner = state.user.role === 'owner';
  const [{ tanks }, { products }] = await Promise.all([
    api.get(`/api/sites/${state.siteId}/tanks`),
    api.get('/api/products'),
  ]);

  root.innerHTML = `
    <div class="section-title"><h2>Tanks &amp; dip-to-litre calibration</h2></div>
    <p class="muted">Each tank converts a dip reading (mm) to stock in litres using its own calibration chart. Replace the starter straight-line chart below with your tank's real manufacturer / dip-chart values for accurate stock figures.</p>
    <div id="tanks-list" class="grid cols-2"></div>
    ${isOwner ? `
      <div class="card" id="add-tank-card">
        <h3>Add a tank</h3>
        <form id="add-tank-form">
          <div class="field-row">
            <div class="field"><label>Product</label>
              <select id="new-tank-product">${products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Tank name</label><input id="new-tank-name" placeholder="e.g. MS Tank 2" required /></div>
            <div class="field"><label>Capacity (L)</label><input id="new-tank-capacity" type="number" min="1" required /></div>
          </div>
          <button type="submit">Add tank</button>
        </form>
      </div>
    ` : ''}
  `;

  const list = document.getElementById('tanks-list');
  list.innerHTML = tanks.map((t) => `
    <div class="card" data-tank-card="${t.id}">
      <div class="section-title">
        <h3>${escapeHtml(t.name)} <span class="pill ${t.product_name.toLowerCase().includes('petrol') ? 'petrol' : 'hsd'}">${escapeHtml(t.product_name)}</span></h3>
      </div>
      <p class="muted">Capacity: ${formatLiters(t.capacity_liters)} L</p>
      <button class="secondary small" data-toggle-cal="${t.id}">View / edit dip chart</button>
      <div id="cal-${t.id}" style="margin-top:12px; display:none"></div>
    </div>
  `).join('') || '<p class="muted">No tanks yet.</p>';

  list.querySelectorAll('[data-toggle-cal]').forEach((btn) => {
    btn.addEventListener('click', () => toggleCalibration(btn.dataset.toggleCal));
  });

  async function toggleCalibration(tankId) {
    const box = document.getElementById(`cal-${tankId}`);
    if (box.style.display !== 'none' && box.innerHTML) {
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = '<p class="muted">Loading...</p>';
    const { calibration } = await api.get(`/api/tanks/${tankId}/calibration`);
    renderCalibrationTable(box, tankId, calibration, isOwner, api, escapeHtml);
  }

  const addForm = document.getElementById('add-tank-form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.post(`/api/sites/${state.siteId}/tanks`, {
          product_id: Number(document.getElementById('new-tank-product').value),
          name: document.getElementById('new-tank-name').value,
          capacity_liters: Number(document.getElementById('new-tank-capacity').value),
        });
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

function renderCalibrationTable(box, tankId, rows, isOwner, api, escapeHtml) {
  const sorted = [...rows].sort((a, b) => a.dip_mm - b.dip_mm);
  box.innerHTML = `
    <table>
      <thead><tr><th>Dip (mm)</th><th>Litres</th>${isOwner ? '<th></th>' : ''}</tr></thead>
      <tbody id="cal-rows-${tankId}">
        ${sorted.map((r, i) => `
          <tr data-row="${i}">
            <td><input type="number" step="0.1" class="cal-dip" value="${r.dip_mm}" ${isOwner ? '' : 'disabled'} /></td>
            <td><input type="number" step="0.1" class="cal-liters" value="${r.liters}" ${isOwner ? '' : 'disabled'} /></td>
            ${isOwner ? `<td><button type="button" class="secondary small" data-remove-row="${i}">Remove</button></td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${isOwner ? `
      <div class="toolbar" style="margin-top:10px">
        <button type="button" class="secondary small" id="add-row-${tankId}">+ Add row</button>
        <button type="button" class="small" id="save-cal-${tankId}">Save dip chart</button>
      </div>
      <p class="muted" id="cal-msg-${tankId}"></p>
    ` : ''}
  `;

  if (!isOwner) return;

  function addRow(dip = '', liters = '') {
    const tbody = document.getElementById(`cal-rows-${tankId}`);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="number" step="0.1" class="cal-dip" value="${dip}" /></td>
      <td><input type="number" step="0.1" class="cal-liters" value="${liters}" /></td>
      <td><button type="button" class="secondary small" data-remove-inline>Remove</button></td>
    `;
    tr.querySelector('[data-remove-inline]').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
  }

  box.querySelectorAll('[data-remove-row]').forEach((b) => b.addEventListener('click', () => b.closest('tr').remove()));
  document.getElementById(`add-row-${tankId}`).addEventListener('click', () => addRow());

  document.getElementById(`save-cal-${tankId}`).addEventListener('click', async () => {
    const msg = document.getElementById(`cal-msg-${tankId}`);
    const tbody = document.getElementById(`cal-rows-${tankId}`);
    const newRows = [...tbody.querySelectorAll('tr')].map((tr) => ({
      dip_mm: Number(tr.querySelector('.cal-dip').value),
      liters: Number(tr.querySelector('.cal-liters').value),
    }));
    try {
      await api.put(`/api/tanks/${tankId}/calibration`, { rows: newRows });
      msg.textContent = 'Saved.';
      msg.style.color = 'var(--good)';
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = 'var(--critical)';
    }
  });
}
