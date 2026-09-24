import { api, setSession } from '../api.js';

export async function renderLogin(root, { navigate }) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <h1>Fuel Stock Manager</h1>
        <p class="muted">Stock, daily sales &amp; prices for your filling stations</p>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" autocomplete="username" required />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button type="submit" style="width:100%">Log in</button>
        </form>
        <div class="demo-creds">
          First run defaults (change after login):<br>
          Owner: <code>owner</code> / <code>owner123</code><br>
          Mirza Tahir (Shell) manager: <code>mtf_manager</code> / <code>shell123</code><br>
          Fast Filling (Puma) manager: <code>ffs_manager</code> / <code>puma123</code>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errBox = document.getElementById('login-error');
    errBox.innerHTML = '';
    try {
      const { token, user } = await api.post('/api/auth/login', { username, password });
      setSession(token, user);
      navigate('#/dashboard');
      location.reload();
    } catch (err) {
      errBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    }
  });
}
