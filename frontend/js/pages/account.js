export async function renderAccount(root, { state, api, escapeHtml }) {
  root.innerHTML = `
    <div class="section-title"><h2>Account</h2></div>
    <div class="card" style="max-width:420px">
      <p><strong>${escapeHtml(state.user.full_name)}</strong><br><span class="muted">${escapeHtml(state.user.username)} &middot; ${state.user.role}</span></p>
      <hr class="sep" />
      <h3>Change password</h3>
      <form id="pw-form">
        <div class="field"><label>Current password</label><input id="current-pw" type="password" required /></div>
        <div class="field"><label>New password</label><input id="new-pw" type="password" required minlength="4" /></div>
        <button type="submit">Update password</button>
      </form>
      <p class="muted" id="pw-msg"></p>
    </div>
  `;

  document.getElementById('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('pw-msg');
    try {
      await api.post('/api/auth/change-password', {
        current_password: document.getElementById('current-pw').value,
        new_password: document.getElementById('new-pw').value,
      });
      msg.textContent = 'Password updated.';
      msg.style.color = 'var(--good)';
      e.target.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = 'var(--critical)';
    }
  });
}
