import { api, getToken, getUser, setSession, clearSession } from './api.js';

import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderEntry } from './pages/entry.js';
import { renderTanks } from './pages/tanks.js';
import { renderNozzles } from './pages/nozzles.js';
import { renderPrices } from './pages/prices.js';
import { renderReports } from './pages/reports.js';
import { renderUsers } from './pages/users.js';
import { renderAccount } from './pages/account.js';

const SITE_KEY = 'fuel_app_site';

const state = {
  user: getUser(),
  sites: [],
  siteId: Number(localStorage.getItem(SITE_KEY)) || null,
};

const appEl = document.getElementById('app');

const routes = [
  { path: /^#\/login$/, page: renderLogin, public: true },
  { path: /^#\/dashboard$/, page: renderDashboard, nav: 'dashboard', title: 'Dashboard' },
  { path: /^#\/entry(?:\/(\d{4}-\d{2}-\d{2}))?$/, page: renderEntry, nav: 'entry', title: 'Daily Entry' },
  { path: /^#\/tanks$/, page: renderTanks, nav: 'tanks', title: 'Tanks & Dip Chart' },
  { path: /^#\/nozzles$/, page: renderNozzles, nav: 'nozzles', title: 'Nozzles' },
  { path: /^#\/prices$/, page: renderPrices, nav: 'prices', title: 'Prices' },
  { path: /^#\/reports$/, page: renderReports, nav: 'reports', title: 'Reports' },
  { path: /^#\/users$/, page: renderUsers, nav: 'users', title: 'Users', ownerOnly: true },
  { path: /^#\/account$/, page: renderAccount, nav: 'account', title: 'Account' },
];

export function navigate(hash) { location.hash = hash; }

export function getState() { return state; }

export function setSite(id) {
  state.siteId = id;
  localStorage.setItem(SITE_KEY, String(id));
  render();
}

async function loadSites() {
  const { sites } = await api.get('/api/sites');
  state.sites = sites;
  if (!state.siteId || !sites.find((s) => s.id === state.siteId)) {
    state.siteId = sites[0] ? sites[0].id : null;
    if (state.siteId) localStorage.setItem(SITE_KEY, String(state.siteId));
  }
}

function currentSite() {
  return state.sites.find((s) => s.id === state.siteId) || null;
}

function shell(activeNav, title) {
  const isOwner = state.user.role === 'owner';
  const nav = [
    ['dashboard', '#/dashboard', 'Dashboard'],
    ['entry', '#/entry', 'Daily Entry'],
    ['tanks', '#/tanks', 'Tanks & Dip Chart'],
    ['nozzles', '#/nozzles', 'Nozzles'],
    ['prices', '#/prices', 'Prices'],
    ['reports', '#/reports', 'Reports'],
  ];
  if (isOwner) nav.push(['users', '#/users', 'Users']);

  const siteSelector = isOwner
    ? `<select id="site-select" class="site-select">${state.sites.map((s) => `<option value="${s.id}" ${s.id === state.siteId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.brand)})</option>`).join('')}</select>`
    : `<span class="site-select pill">${escapeHtml(currentSite()?.name || '')}</span>`;

  appEl.innerHTML = `
    <div class="topnav">
      <div class="brand">Fuel Stock Manager<small>${escapeHtml(currentSite()?.brand || '')} - ${escapeHtml(currentSite()?.name || '')}</small></div>
      ${siteSelector}
      <nav>${nav.map(([key, href, label]) => `<a href="${href}" class="${key === activeNav ? 'active' : ''}">${label}</a>`).join('')}</nav>
      <div class="spacer"></div>
      <div class="user-menu">
        <a href="#/account">${escapeHtml(state.user.full_name)} (${state.user.role})</a>
        <button class="secondary small" id="logout-btn">Log out</button>
      </div>
    </div>
    <main id="page-root"></main>
    <footer class="app-footer">Fuel Stock Manager &middot; running locally &middot; data stored on this machine</footer>
  `;
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    navigate('#/login');
  });
  const siteSelect = document.getElementById('site-select');
  if (siteSelect) siteSelect.addEventListener('change', (e) => setSite(Number(e.target.value)));
  return document.getElementById('page-root');
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function render() {
  const hash = location.hash || '#/dashboard';
  const match = routes.find((r) => r.path.test(hash));

  if (!getToken()) {
    if (match && match.public) { await renderLogin(appEl, { navigate }); return; }
    navigate('#/login');
    return;
  }
  state.user = getUser();
  if (!match || match.public) {
    navigate('#/dashboard');
    return;
  }
  if (match.ownerOnly && state.user.role !== 'owner') {
    navigate('#/dashboard');
    return;
  }

  try {
    if (state.sites.length === 0) await loadSites();
  } catch (err) {
    if (String(err.message).includes('Unauthorized')) { navigate('#/login'); return; }
  }

  const root = shell(match.nav, match.title);
  const groups = hash.match(match.path);
  try {
    await match.page(root, { state, api, navigate, escapeHtml, params: groups ? groups.slice(1) : [] });
  } catch (err) {
    root.innerHTML = `<div class="error-box">${escapeHtml(err.message || 'Something went wrong')}</div>`;
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
if (document.readyState !== 'loading') render();
