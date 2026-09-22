export async function renderNozzles(root, { state, api, escapeHtml }) {
  const isOwner = state.user.role === 'owner';
  const [{ nozzles }, { tanks }] = await Promise.all([
    api.get(`/api/sites/${state.siteId}/nozzles`),
    api.get(`/api/sites/${state.siteId}/tanks`),
  ]);

  root.innerHTML = `
    <div class="section-title"><h2>Nozzles / dispensers</h2></div>
    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Tank</th><th>Product</th><th>Status</th>${isOwner ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${nozzles.map((n) => `
            <tr data-id="${n.id}">
              <td>${escapeHtml(n.name)}</td>
              <td>${escapeHtml(n.tank_name)}</td>
              <td><span class="pill ${n.product_name.toLowerCase().includes('petrol') ? 'petrol' : 'hsd'}">${escapeHtml(n.product_name)}</span></td>
              <td>${n.active ? 'Active' : 'Inactive'}</td>
              ${isOwner ? `<td><button class="secondary small" data-toggle="${n.id}" data-active="${n.active}">${n.active ? 'Deactivate' : 'Activate'}</button></td>` : ''}
            </tr>
          `).join('') || '<tr><td colspan="5" class="muted">No nozzles yet.</td></tr>'}
        </tbody>
      </table>
    </div>
    ${isOwner ? `
      <div class="card">
        <h3>Add a nozzle</h3>
        <form id="add-nozzle-form">
          <div class="field-row">
            <div class="field"><label>Tank</label>
              <select id="new-nozzle-tank">${tanks.map((t) => `<option value="${t.id}">${escapeHtml(t.name)} (${escapeHtml(t.product_name)})</option>`).join('')}</select>
            </div>
            <div class="field"><label>Nozzle name</label><input id="new-nozzle-name" placeholder="e.g. MS Nozzle 3" required /></div>
          </div>
          <button type="submit">Add nozzle</button>
        </form>
      </div>
    ` : ''}
  `;

  root.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggle;
      const active = btn.dataset.active === '1';
      try {
        await api.put(`/api/nozzles/${id}`, { active: !active });
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  const addForm = document.getElementById('add-nozzle-form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.post(`/api/sites/${state.siteId}/nozzles`, {
          tank_id: Number(document.getElementById('new-nozzle-tank').value),
          name: document.getElementById('new-nozzle-name').value,
        });
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}
