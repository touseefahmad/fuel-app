import { today, formatMoney } from '../dateutil.js';

export async function renderPrices(root, { state, api, escapeHtml }) {
  const isOwner = state.user.role === 'owner';
  const [{ prices, current }, { products }] = await Promise.all([
    api.get(`/api/sites/${state.siteId}/prices`),
    api.get('/api/products'),
  ]);

  root.innerHTML = `
    <div class="section-title"><h2>Prices</h2></div>
    <div class="grid cols-2">
      ${current.map((c) => `
        <div class="stat-tile">
          <div class="label">${escapeHtml(c.product_name)} - current price</div>
          <div class="value">${c.price_per_liter != null ? 'Rs ' + formatMoney(c.price_per_liter) : 'Not set'}</div>
          <div class="sub">per litre</div>
        </div>
      `).join('')}
    </div>

    ${isOwner ? `
      <div class="card">
        <h3>Add / update price</h3>
        <form id="price-form">
          <div class="field-row">
            <div class="field"><label>Product</label>
              <select id="price-product">${products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Price per litre (Rs)</label><input id="price-value" type="number" step="0.01" min="0.01" required /></div>
            <div class="field"><label>Effective from</label><input id="price-date" type="date" value="${today()}" required /></div>
          </div>
          <button type="submit">Save price</button>
        </form>
        <p class="muted" id="price-msg"></p>
      </div>
    ` : ''}

    <div class="card">
      <h3>Price history</h3>
      <table>
        <thead><tr><th>Effective from</th><th>Product</th><th class="num">Price / Litre</th></tr></thead>
        <tbody>
          ${prices.map((p) => `
            <tr><td>${p.effective_from}</td><td>${escapeHtml(p.product_name)}</td><td class="num">Rs ${formatMoney(p.price_per_liter)}</td></tr>
          `).join('') || '<tr><td colspan="3" class="muted">No price history yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  const form = document.getElementById('price-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('price-msg');
      try {
        await api.post(`/api/sites/${state.siteId}/prices`, {
          product_id: Number(document.getElementById('price-product').value),
          price_per_liter: Number(document.getElementById('price-value').value),
          effective_from: document.getElementById('price-date').value,
        });
        location.reload();
      } catch (err) {
        msg.textContent = err.message;
        msg.style.color = 'var(--critical)';
      }
    });
  }
}
