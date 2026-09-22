export async function renderUsers(root, { state, api, escapeHtml }) {
  const [{ users }, { sites }] = await Promise.all([api.get('/api/users'), api.get('/api/sites')]);

  root.innerHTML = `
    <div class="section-title"><h2>Users</h2></div>
    <div class="card">
      <table>
        <thead><tr><th>Username</th><th>Full name</th><th>Role</th><th>Site</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr data-id="${u.id}">
              <td>${escapeHtml(u.username)}</td>
              <td>${escapeHtml(u.full_name)}</td>
              <td>${u.role}</td>
              <td>${u.site_id ? escapeHtml(sites.find((s) => s.id === u.site_id)?.name || '') : 'All sites'}</td>
              <td>${u.active ? 'Active' : 'Inactive'}</td>
              <td>
                <button class="secondary small" data-toggle="${u.id}" data-active="${u.active ? 1 : 0}">${u.active ? 'Deactivate' : 'Activate'}</button>
                <button class="secondary small" data-reset="${u.id}">Reset password</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>Add a user</h3>
      <form id="add-user-form">
        <div class="field-row">
          <div class="field"><label>Username</label><input id="new-username" required /></div>
          <div class="field"><label>Full name</label><input id="new-fullname" required /></div>
          <div class="field"><label>Password</label><input id="new-password" type="password" required /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Role</label>
            <select id="new-role">
              <option value="manager">Site manager</option>
              <option value="owner">Owner (all sites)</option>
            </select>
          </div>
          <div class="field" id="site-field"><label>Site</label>
            <select id="new-site">${sites.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
          </div>
        </div>
        <button type="submit">Add user</button>
      </form>
      <p class="muted" id="user-msg"></p>
    </div>
  `;

  document.getElementById('new-role').addEventListener('change', (e) => {
    document.getElementById('site-field').style.display = e.target.value === 'owner' ? 'none' : 'block';
  });

  root.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api.put(`/api/users/${btn.dataset.toggle}`, { active: btn.dataset.active !== '1' });
        location.reload();
      } catch (err) { alert(err.message); }
    });
  });
  root.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pw = prompt('New password for this user (min 4 characters):');
      if (!pw) return;
      try {
        await api.put(`/api/users/${btn.dataset.reset}`, { password: pw });
        alert('Password updated.');
      } catch (err) { alert(err.message); }
    });
  });

  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('user-msg');
    const role = document.getElementById('new-role').value;
    try {
      await api.post('/api/users', {
        username: document.getElementById('new-username').value,
        full_name: document.getElementById('new-fullname').value,
        password: document.getElementById('new-password').value,
        role,
        site_id: role === 'manager' ? Number(document.getElementById('new-site').value) : null,
      });
      location.reload();
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = 'var(--critical)';
    }
  });
}
