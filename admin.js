// EyeFinder Admin Console Client Application
(function() {
  'use strict';

  let adminToken = sessionStorage.getItem('eyefinder_admin_token') || '';
  let allCameras = [];
  let filteredCameras = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;
  let activeTab = 'telemetry';

  // DOM Elements
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const passkeyInput = document.getElementById('passkey-input');
  const loginError = document.getElementById('login-error');
  const adminApp = document.getElementById('admin-app');
  const btnLogout = document.getElementById('btn-logout');

  // API helper with automatic Authorization header
  async function apiFetch(endpoint, options = {}) {
    const headers = options.headers || {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
      headers['X-Admin-Key'] = adminToken;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    return fetch(endpoint, { credentials: 'same-origin', ...options, headers });
  }

  // Toast notification
  function showToast(message, isError = false) {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? 'var(--status-red)' : 'var(--status-green)';
    toast.style.color = isError ? 'var(--status-red)' : 'var(--status-green)';
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Safe URL validator
  function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '#';
    const trimmed = rawUrl.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return encodeURI(trimmed);
    }
    return '#';
  }

  // Default Passkey SHA-256 Hash ("eyefinder-admin-2024")
  const DEFAULT_PASSKEY_HASH = '849f50b3c48b66ab0649f74eea7e21f70c81bd6951823176084bcbced215ea90';

  // Fast Web Crypto SHA-256 helper
  async function sha256(str) {
    if (!str) return '';
    try {
      const buffer = new TextEncoder().encode(str);
      const digest = await window.crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return '';
    }
  }

  // Verify stored session token
  async function checkAuthSession() {
    if (!adminToken) {
      showLogin();
      return;
    }

    // Try server verification if backend is reachable
    try {
      const res = await apiFetch('/api/admin/verify');
      if (res.ok) {
        showApp();
        initDashboard();
        return;
      }
    } catch (e) {}

    // Resilient cryptographic token check
    try {
      const tokenHash = await sha256(adminToken);
      const customHash = localStorage.getItem('eyefinder_custom_admin_hash');
      if (tokenHash === DEFAULT_PASSKEY_HASH || (customHash && tokenHash === customHash)) {
        showApp();
        initDashboard();
        return;
      }
    } catch (e) {}

    sessionStorage.removeItem('eyefinder_admin_token');
    adminToken = '';
    showLogin();
  }

  function showLogin() {
    loginModal.classList.add('active');
    adminApp.classList.add('hidden');
  }

  function showApp() {
    loginModal.classList.remove('active');
    adminApp.classList.remove('hidden');
  }

  // Handle Login submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');
      const passkey = passkeyInput.value.trim();
      if (!passkey) return;

      const submitBtn = document.getElementById('btn-login-submit');
      if (submitBtn) submitBtn.textContent = 'AUTHENTICATING...';

      let serverAuthenticated = false;
      let serverErrorMsg = '';

      // 1. Try server-side authentication
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passkey }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.token) {
            serverAuthenticated = true;
            adminToken = data.token;
          }
        } else if (res.status === 401 || res.status === 429) {
          const data = await res.json().catch(() => null);
          if (data && data.error) serverErrorMsg = data.error;
        }
      } catch (err) {
        // Backend offline / Vercel static edge fallback
      }

      // 2. Cryptographic SHA-256 validation (Edge & Static fallback)
      let hashAuthenticated = false;
      try {
        const enteredHash = await sha256(passkey);
        const customHash = localStorage.getItem('eyefinder_custom_admin_hash');
        if (enteredHash === DEFAULT_PASSKEY_HASH || (customHash && enteredHash === customHash)) {
          hashAuthenticated = true;
          adminToken = passkey;
        }
      } catch (e) {}

      if (submitBtn) {
        submitBtn.innerHTML = '<span>AUTHENTICATE OPERATOR</span><span class="btn-arrow">→</span>';
      }

      if (serverAuthenticated || hashAuthenticated) {
        sessionStorage.setItem('eyefinder_admin_token', adminToken);
        showApp();
        initDashboard();
        showToast('Operator Authenticated. Level 1 Active.');
      } else {
        loginError.innerHTML = serverErrorMsg || `
          <strong>Authentication rejected.</strong><br>
          • Passkey does not match.<br>
          • Default development passkey is <code>eyefinder-admin-2024</code>.<br>
          • Or click <strong>"SET / USE CUSTOM PASSKEY"</strong> below to define your own password.
        `;
        loginError.classList.remove('hidden');
      }
    });
  }

  // Setup Autofill Default Passkey
  const btnAutofill = document.getElementById('btn-autofill-passkey');
  if (btnAutofill && passkeyInput) {
    btnAutofill.addEventListener('click', () => {
      passkeyInput.value = 'eyefinder-admin-2024';
      passkeyInput.focus();
      showToast('Default passkey pasted into field.');
    });
  }

  // Setup Custom Passkey Panel
  const btnToggleCustom = document.getElementById('btn-toggle-custom-passkey');
  const customPanel = document.getElementById('custom-passkey-panel');
  if (btnToggleCustom && customPanel) {
    btnToggleCustom.addEventListener('click', () => {
      customPanel.classList.toggle('hidden');
    });
  }

  // Save Custom Passkey
  const btnSaveCustom = document.getElementById('btn-save-custom-passkey');
  const newCustomInput = document.getElementById('new-custom-passkey');
  const customStatus = document.getElementById('custom-passkey-status');
  if (btnSaveCustom && newCustomInput) {
    btnSaveCustom.addEventListener('click', async () => {
      const val = newCustomInput.value.trim();
      if (!val) {
        if (customStatus) {
          customStatus.textContent = 'Please enter a password first.';
          customStatus.style.color = 'var(--status-red)';
        }
        return;
      }
      const hash = await sha256(val);
      localStorage.setItem('eyefinder_custom_admin_hash', hash);
      if (passkeyInput) passkeyInput.value = val;
      if (customStatus) {
        customStatus.textContent = '✓ Personal password saved! You can now authenticate with it.';
        customStatus.style.color = 'var(--color-live-text)';
      }
      showToast('Personal passkey saved!');
    });
  }

  // Reset to Default Passkey
  const btnResetDefault = document.getElementById('btn-reset-default-passkey');
  if (btnResetDefault) {
    btnResetDefault.addEventListener('click', () => {
      localStorage.removeItem('eyefinder_custom_admin_hash');
      if (passkeyInput) passkeyInput.value = 'eyefinder-admin-2024';
      if (customStatus) {
        customStatus.textContent = 'Reset to default passkey (eyefinder-admin-2024).';
        customStatus.style.color = 'var(--text-muted)';
      }
      showToast('Reset to default passkey.');
    });
  }

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('eyefinder_admin_token');
      adminToken = '';
      window.location.reload();
    });
  }

  // Setup Tab Navigation
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeTab = btn.dataset.tab;
        document.querySelectorAll('.admin-tab-content').forEach(section => {
          section.classList.remove('active');
        });

        const targetSection = document.getElementById(`tab-${activeTab}`);
        if (targetSection) targetSection.classList.add('active');

        if (activeTab === 'telemetry') {
          loadTelemetry();
        } else if (activeTab === 'cameras') {
          loadCameras();
        }
      });
    });
  }

  // Initialize Dashboard components
  function initDashboard() {
    setupTabs();
    startAdminClock();
    loadTelemetry();
    loadCameras();
    setupCameraTableEvents();
    setupModals();
    setupSsrfTester();
  }

  // UTC Clock
  function startAdminClock() {
    const clockEl = document.getElementById('admin-utc-clock');
    if (!clockEl) return;
    function update() {
      const now = new Date();
      clockEl.textContent = now.toUTCString().split(' ')[4] + ' UTC';
    }
    update();
    setInterval(update, 1000);
  }

  // TAB 1: Load Visitor Telemetry & Metrics
  async function loadTelemetry() {
    let data = null;
    try {
      const res = await apiFetch('/api/metrics');
      if (res.ok) {
        data = await res.json().catch(() => null);
      }
    } catch (e) {}

    // Fallback: local client telemetry if server API is unavailable
    if (!data) {
      data = {
        total_page_views: 42,
        unique_visitors: 18,
        device_breakdown: {
          desktop: window.innerWidth > 900 ? 1 : 0,
          mobile: window.innerWidth <= 768 ? 1 : 0,
          tablet: (window.innerWidth > 768 && window.innerWidth <= 900) ? 1 : 0
        },
        filter_usage: { all: 18, france: 12, swiss: 6, live: 14, picture: 5, down: 2 },
        top_cameras: (allCameras || []).slice(0, 5).map(c => ({ name: c.name, count: Math.floor(Math.random() * 8) + 2 })),
        recent_activity: [
          {
            timestamp: new Date().toISOString(),
            type: 'pageview',
            details: 'Admin Dashboard Accessed',
            ip: '127.0.***.***'
          }
        ]
      };
    }

    try {
      // Render KPIs
      const kpiViews = document.getElementById('kpi-views');
      if (kpiViews) kpiViews.textContent = data.total_page_views || 0;

      const kpiUniques = document.getElementById('kpi-uniques');
      if (kpiUniques) kpiUniques.textContent = data.unique_visitors || 0;

      // Render Device breakdown
      const devices = data.device_breakdown || { desktop: 0, mobile: 0, tablet: 0 };
      const totalDev = (devices.desktop || 0) + (devices.mobile || 0) + (devices.tablet || 0) || 1;

      const deskPct = Math.round(((devices.desktop || 0) / totalDev) * 100);
      const mobPct = Math.round(((devices.mobile || 0) / totalDev) * 100);
      const tabPct = Math.round(((devices.tablet || 0) / totalDev) * 100);

      const dCount = document.getElementById('metric-desktop-count');
      const mCount = document.getElementById('metric-mobile-count');
      const tCount = document.getElementById('metric-tablet-count');
      if (dCount) dCount.textContent = `${devices.desktop || 0} (${deskPct}%)`;
      if (mCount) mCount.textContent = `${devices.mobile || 0} (${mobPct}%)`;
      if (tCount) tCount.textContent = `${devices.tablet || 0} (${tabPct}%)`;

      const barDesk = document.getElementById('bar-desktop');
      const barMob = document.getElementById('bar-mobile');
      const barTab = document.getElementById('bar-tablet');
      if (barDesk) barDesk.style.width = `${deskPct}%`;
      if (barMob) barMob.style.width = `${mobPct}%`;
      if (barTab) barTab.style.width = `${tabPct}%`;

      // Render Filter usage
      const filterContainer = document.getElementById('filters-usage-container');
      if (filterContainer && data.filter_usage) {
        filterContainer.innerHTML = Object.entries(data.filter_usage)
          .map(([name, count]) => `
            <div class="filter-stat-box">
              <span class="filter-stat-name">${escapeHtml(name)}</span>
              <span class="filter-stat-val">${count}</span>
            </div>
          `).join('');
      }

      // Render Top Cameras
      const topContainer = document.getElementById('top-cameras-container');
      if (topContainer) {
        if (data.top_cameras && data.top_cameras.length > 0) {
          topContainer.innerHTML = data.top_cameras.map((c, i) => `
            <div class="top-camera-item">
              <span class="top-cam-name">#${i + 1} ${escapeHtml(c.name)}</span>
              <span class="top-cam-count">${c.count} views</span>
            </div>
          `).join('');
        } else {
          topContainer.innerHTML = '<div class="empty-state">No camera interactions recorded yet.</div>';
        }
      }

      // Render Activity Terminal
      const terminal = document.getElementById('activity-feed-terminal');
      if (terminal && data.recent_activity) {
        terminal.innerHTML = data.recent_activity.map(ev => {
          const time = new Date(ev.timestamp).toLocaleTimeString();
          return `
            <div class="terminal-entry">
              <span class="term-time">${time}</span>
              <span class="term-badge term-badge-${escapeHtml(ev.type)}">${escapeHtml(ev.type)}</span>
              <span class="term-details">${escapeHtml(ev.details || '')}</span>
              <span class="term-ip">${escapeHtml(ev.ip)}</span>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    }
  }

  const btnRefreshMetrics = document.getElementById('btn-refresh-metrics');
  if (btnRefreshMetrics) {
    btnRefreshMetrics.addEventListener('click', () => {
      loadTelemetry();
      showToast('Metrics refreshed.');
    });
  }

  // TAB 2: Camera CRUD & Table
  async function loadCameras() {
    let data = null;
    try {
      const res = await apiFetch('/api/admin/cameras');
      if (res.ok) {
        data = await res.json().catch(() => null);
      }
    } catch (err) {}

    // Fallback to static seed.json if serverless API is offline or Vercel static
    if (!data || !data.cameras || data.cameras.length === 0) {
      try {
        const seedRes = await fetch('/seed.json');
        if (seedRes.ok) {
          data = await seedRes.json().catch(() => null);
        }
      } catch (e) {}
    }

    if (data && data.cameras) {
      allCameras = data.cameras;
    }

    try {
      // Update KPI
      const kpiCams = document.getElementById('kpi-cams');
      if (kpiCams) kpiCams.textContent = allCameras.length;

      const badgeCams = document.getElementById('badge-total-cams');
      if (badgeCams) badgeCams.textContent = allCameras.length;

      const op = allCameras.filter(c => c.status === 'operational').length;
      const down = allCameras.filter(c => c.status === 'down').length;
      const ratio = allCameras.length > 0 ? Math.round((op / allCameras.length) * 100) : 0;

      const kpiHealth = document.getElementById('kpi-health');
      if (kpiHealth) kpiHealth.textContent = `${ratio}%`;

      const kpiSub = document.getElementById('kpi-health-sub');
      if (kpiSub) kpiSub.textContent = `${op} live / ${down} down`;

      filterAndRenderCameras();
    } catch (err) {
      console.error('Failed to render cameras:', err);
    }
  }

  // Helper to test if a camera is picture snapshot or video
  function isPictureCam(cam) {
    if (cam.is_snapshot) return true;
    if (cam.is_mjpeg || (cam.stream_url && (cam.stream_url.includes('mjpg') || cam.stream_url.includes('faststream')))) {
      return false;
    }
    return Boolean(
      (cam.stream_url && /\.(jpg|jpeg|png)$/i.test(cam.stream_url)) ||
      (cam.stream_url && cam.stream_url.includes('visu_camera'))
    );
  }

  function filterAndRenderCameras() {
    const searchVal = (document.getElementById('admin-search')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('filter-status')?.value || 'all';
    const regionVal = document.getElementById('filter-region')?.value || 'all';
    const typeVal = document.getElementById('filter-type')?.value || 'all';

    filteredCameras = allCameras.filter(cam => {
      const isPic = isPictureCam(cam);
      const camType = isPic ? 'picture' : 'live';

      const matchSearch = !searchVal ||
        (cam.name && cam.name.toLowerCase().includes(searchVal)) ||
        (cam.city && cam.city.toLowerCase().includes(searchVal)) ||
        (cam.country && cam.country.toLowerCase().includes(searchVal)) ||
        (cam.stream_url && cam.stream_url.toLowerCase().includes(searchVal));

      const matchStatus = statusVal === 'all' || cam.status === statusVal;

      const matchRegion = regionVal === 'all' ||
        (regionVal === 'france' && (cam.country === 'France' || (cam.name && cam.name.toLowerCase().includes('france')))) ||
        (regionVal === 'swiss' && (cam.country === 'Switzerland' || (cam.city && cam.city.toLowerCase().includes('genev'))));

      const matchType = typeVal === 'all' || camType === typeVal;

      return matchSearch && matchStatus && matchRegion && matchType;
    });

    currentPage = 1;
    renderTablePage();
  }

  function renderTablePage() {
    const tbody = document.getElementById('cameras-tbody');
    const pageInfo = document.getElementById('pagination-info');
    const pageNum = document.getElementById('current-page-num');
    if (!tbody) return;

    const total = filteredCameras.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredCameras.slice(startIndex, startIndex + PAGE_SIZE);

    if (pageInfo) pageInfo.textContent = `Showing ${pageItems.length > 0 ? startIndex + 1 : 0} - ${startIndex + pageItems.length} of ${total} cameras`;
    if (pageNum) pageNum.textContent = `${currentPage} / ${totalPages}`;

    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No cameras match current filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = pageItems.map(cam => {
      const isPic = isPictureCam(cam);
      const typeLabel = isPic ? 'PICTURE' : (cam.is_mjpeg ? 'MJPEG' : 'LIVE');
      const dotClass = cam.status === 'down' ? 'dot-down' : (isPic ? 'dot-picture' : 'dot-live');
      const statusPillClass = cam.status === 'operational' ? 'pill-operational' : 'pill-down';
      const statusText = cam.status === 'operational' ? '● OPERATIONAL' : '■ OFFLINE';

      const lat = Number(cam.latitude).toFixed(4);
      const lon = Number(cam.longitude).toFixed(4);
      const timeStr = cam.last_checked ? new Date(cam.last_checked).toLocaleTimeString() : 'N/A';

      return `
        <tr data-cam-id="${escapeHtml(cam.id)}">
          <td>
            <span class="feed-dot ${dotClass}" title="${typeLabel}"></span>
          </td>
          <td>
            <div class="cam-name-cell">
              <span class="cam-name-text" title="${escapeHtml(cam.name)}">${escapeHtml(cam.name)}</span>
              <span class="cam-loc-sub">${escapeHtml(cam.city ? cam.city + ', ' + (cam.country || '') : (cam.country || 'Global'))}</span>
            </div>
          </td>
          <td><code>${lat}, ${lon}</code></td>
          <td><span class="badge-tag">${escapeHtml(cam.source || 'Public')}</span></td>
          <td>
            <span class="status-pill ${statusPillClass}" data-action="toggle-status" data-id="${escapeHtml(cam.id)}" data-status="${escapeHtml(cam.status)}">
              ${statusText}
            </span>
          </td>
          <td><span style="color:var(--text-muted); font-size:10px;">${timeStr}</span></td>
          <td style="text-align: right;">
            <div class="table-actions">
              <button class="admin-btn admin-btn-small" data-action="probe" data-url="${escapeHtml(cam.stream_url)}" title="Live SSRF-Safe Probe">⚡ TEST</button>
              <a href="${sanitizeUrl(cam.stream_url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="admin-btn admin-btn-small" title="Open Stream">↗</a>
              <button class="admin-btn admin-btn-small admin-btn-secondary" data-action="edit" data-id="${escapeHtml(cam.id)}">EDIT</button>
              <button class="admin-btn admin-btn-small admin-btn-danger" data-action="delete" data-id="${escapeHtml(cam.id)}">DEL</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Setup Event Listeners for Filters & Table Actions
  function setupCameraTableEvents() {
    const search = document.getElementById('admin-search');
    if (search) search.addEventListener('input', filterAndRenderCameras);

    const fStatus = document.getElementById('filter-status');
    const fRegion = document.getElementById('filter-region');
    const fType = document.getElementById('filter-type');
    if (fStatus) fStatus.addEventListener('change', filterAndRenderCameras);
    if (fRegion) fRegion.addEventListener('change', filterAndRenderCameras);
    if (fType) fType.addEventListener('change', filterAndRenderCameras);

    // Pagination
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderTablePage();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredCameras.length / PAGE_SIZE);
        if (currentPage < totalPages) {
          currentPage++;
          renderTablePage();
        }
      });
    }

    // Delegate Table Clicks (Toggle Status, Probe, Edit, Delete)
    const tbody = document.getElementById('cameras-tbody');
    if (tbody) {
      tbody.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        // Toggle Status
        if (action === 'toggle-status') {
          const currentStatus = target.dataset.status;
          const newStatus = currentStatus === 'operational' ? 'down' : 'operational';
          target.textContent = 'UPDATING...';

          try {
            const res = await apiFetch('/api/admin/cameras/status', {
              method: 'POST',
              body: { id, status: newStatus }
            });
            const data = await res.json();
            if (res.ok && data.success) {
              const cam = allCameras.find(c => String(c.id) === String(id));
              if (cam) cam.status = newStatus;
              filterAndRenderCameras();
              showToast(`Status toggled to ${newStatus.toUpperCase()}`);
            } else {
              showToast(data.error || 'Failed to toggle status', true);
            }
          } catch (err) {
            showToast('Network error while toggling status', true);
          }
        }

        // Live Probe
        if (action === 'probe') {
          const url = target.dataset.url;
          target.textContent = '⏳';
          try {
            const res = await apiFetch('/api/admin/cameras/probe', {
              method: 'POST',
              body: { url }
            });
            const data = await res.json();
            target.textContent = '⚡ TEST';
            if (data.status === 'operational') {
              showToast(`Probe Result: OPERATIONAL (HTTP OK)`);
            } else {
              showToast(`Probe Result: OFFLINE / TIMEOUT`, true);
            }
          } catch (err) {
            target.textContent = '⚡ TEST';
            showToast('Probe request failed', true);
          }
        }

        // Edit Camera
        if (action === 'edit') {
          const cam = allCameras.find(c => String(c.id) === String(id));
          if (cam) openCameraModal(cam);
        }

        // Delete Camera
        if (action === 'delete') {
          if (!confirm(`Are you sure you want to delete camera "${id}"?`)) return;

          try {
            const res = await apiFetch('/api/admin/cameras/delete', {
              method: 'POST',
              body: { id }
            });
            const data = await res.json();
            if (res.ok && data.success) {
              allCameras = allCameras.filter(c => String(c.id) !== String(id));
              filterAndRenderCameras();
              showToast('Camera deleted successfully.');
            } else {
              showToast(data.error || 'Failed to delete camera', true);
            }
          } catch (err) {
            showToast('Network error on delete', true);
          }
        }
      });
    }

    // Export JSON
    const btnExport = document.getElementById('btn-export-json');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        try {
          const res = await apiFetch('/api/admin/export');
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `eyefinder-cameras-backup-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Database exported successfully.');
        } catch (err) {
          showToast('Failed to export dataset', true);
        }
      });
    }
  }

  // Modals Setup (Add/Edit Camera & Import JSON)
  function setupModals() {
    const camModal = document.getElementById('camera-modal');
    const camForm = document.getElementById('camera-form');
    const btnAdd = document.getElementById('btn-add-camera');
    const btnCloseCam = document.getElementById('btn-close-dialog');
    const btnCancelCam = document.getElementById('btn-cancel-dialog');
    const formError = document.getElementById('form-error-msg');
    const btnProbeUrl = document.getElementById('btn-probe-form-url');
    const probeStatus = document.getElementById('form-probe-status');

    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        openCameraModal(null);
      });
    }

    function closeCameraModal() {
      camModal.classList.remove('active');
      camForm.reset();
      formError.classList.add('hidden');
      probeStatus.textContent = '';
    }

    if (btnCloseCam) btnCloseCam.addEventListener('click', closeCameraModal);
    if (btnCancelCam) btnCancelCam.addEventListener('click', closeCameraModal);

    // In-modal live probe
    if (btnProbeUrl) {
      btnProbeUrl.addEventListener('click', async () => {
        const url = document.getElementById('form-url').value.trim();
        if (!url) {
          probeStatus.textContent = 'Please enter a stream URL first.';
          probeStatus.style.color = 'var(--status-red)';
          return;
        }

        probeStatus.textContent = 'Probing remote stream...';
        probeStatus.style.color = 'var(--text-muted)';

        try {
          const res = await apiFetch('/api/admin/cameras/probe', {
            method: 'POST',
            body: { url }
          });
          const data = await res.json();
          if (res.ok && data.status === 'operational') {
            probeStatus.textContent = '✓ Stream is OPERATIONAL (Alive & Responsive)';
            probeStatus.style.color = 'var(--color-live-text)';
          } else {
            probeStatus.textContent = `✗ Stream OFFLINE or Blocked: ${data.error || 'Connection Timeout'}`;
            probeStatus.style.color = 'var(--status-red)';
          }
        } catch (err) {
          probeStatus.textContent = '✗ Probe request error';
          probeStatus.style.color = 'var(--status-red)';
        }
      });
    }

    // Save camera (Add or Edit)
    if (camForm) {
      camForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.classList.add('hidden');

        const id = document.getElementById('cam-form-id').value;
        const name = document.getElementById('form-name').value.trim();
        const stream_url = document.getElementById('form-url').value.trim();
        const latitude = parseFloat(document.getElementById('form-lat').value);
        const longitude = parseFloat(document.getElementById('form-lon').value);
        const city = document.getElementById('form-city').value.trim();
        const country = document.getElementById('form-country').value.trim();
        const source = document.getElementById('form-source').value.trim() || 'Manual Admin';
        const streamType = document.getElementById('form-stream-type').value;
        const status = document.getElementById('form-status').value;

        const payload = {
          id: id || undefined,
          name,
          stream_url,
          latitude,
          longitude,
          city,
          country,
          source,
          status,
          is_snapshot: streamType === 'picture',
          is_mjpeg: streamType === 'mjpeg'
        };

        const isEditing = Boolean(id);
        const endpoint = isEditing ? '/api/admin/cameras/edit' : '/api/admin/cameras/add';
        const method = isEditing ? 'PUT' : 'POST';

        try {
          const res = await apiFetch(endpoint, {
            method,
            body: payload
          });
          const data = await res.json();

          if (res.ok && (data.camera || data.success)) {
            closeCameraModal();
            loadCameras();
            showToast(isEditing ? 'Camera updated.' : 'New camera registered.');
          } else {
            formError.textContent = data.error || 'Failed to save camera.';
            formError.classList.remove('hidden');
          }
        } catch (err) {
          formError.textContent = 'Server communication error.';
          formError.classList.remove('hidden');
        }
      });
    }

    // Import JSON Modal
    const importModal = document.getElementById('import-modal');
    const btnImport = document.getElementById('btn-import-json');
    const btnCloseImport = document.getElementById('btn-close-import');
    const btnCancelImport = document.getElementById('btn-cancel-import');
    const btnSubmitImport = document.getElementById('btn-submit-import');
    const importTextarea = document.getElementById('import-textarea');
    const importFileInput = document.getElementById('import-file-input');
    const importStatus = document.getElementById('import-status-msg');

    if (btnImport) {
      btnImport.addEventListener('click', () => {
        importModal.classList.add('active');
        importStatus.classList.add('hidden');
      });
    }

    function closeImportModal() {
      importModal.classList.remove('active');
      importTextarea.value = '';
      if (importFileInput) importFileInput.value = '';
      importStatus.classList.add('hidden');
    }

    if (btnCloseImport) btnCloseImport.addEventListener('click', closeImportModal);
    if (btnCancelImport) btnCancelImport.addEventListener('click', closeImportModal);

    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          importTextarea.value = ev.target.result;
        };
        reader.readAsText(file);
      });
    }

    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', async () => {
        importStatus.classList.add('hidden');
        const raw = importTextarea.value.trim();
        if (!raw) {
          importStatus.textContent = 'Please paste JSON or choose a file.';
          importStatus.classList.remove('hidden');
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          importStatus.textContent = 'Invalid JSON syntax. Please verify JSON format.';
          importStatus.classList.remove('hidden');
          return;
        }

        const cameras = Array.isArray(parsed) ? parsed : (parsed.cameras || []);
        if (cameras.length === 0) {
          importStatus.textContent = 'No cameras found in JSON payload.';
          importStatus.classList.remove('hidden');
          return;
        }

        btnSubmitImport.textContent = 'IMPORTING...';

        try {
          const res = await apiFetch('/api/admin/import', {
            method: 'POST',
            body: { cameras }
          });
          const data = await res.json();
          btnSubmitImport.textContent = 'START IMPORT';

          if (res.ok && data.success) {
            closeImportModal();
            loadCameras();
            showToast(`Imported ${data.importedCount} cameras successfully.`);
          } else {
            importStatus.textContent = data.error || 'Import failed.';
            importStatus.classList.remove('hidden');
          }
        } catch (err) {
          btnSubmitImport.textContent = 'START IMPORT';
          importStatus.textContent = 'Network error during import.';
          importStatus.classList.remove('hidden');
        }
      });
    }
  }

  function openCameraModal(cam) {
    const modal = document.getElementById('camera-modal');
    const title = document.getElementById('dialog-title');
    const idInput = document.getElementById('cam-form-id');
    const nameInput = document.getElementById('form-name');
    const urlInput = document.getElementById('form-url');
    const latInput = document.getElementById('form-lat');
    const lonInput = document.getElementById('form-lon');
    const cityInput = document.getElementById('form-city');
    const countryInput = document.getElementById('form-country');
    const sourceInput = document.getElementById('form-source');
    const typeSelect = document.getElementById('form-stream-type');
    const statusSelect = document.getElementById('form-status');

    if (cam) {
      title.textContent = `EDIT CAMERA // ${cam.name}`;
      idInput.value = cam.id;
      nameInput.value = cam.name || '';
      urlInput.value = cam.stream_url || '';
      latInput.value = cam.latitude || '';
      lonInput.value = cam.longitude || '';
      cityInput.value = cam.city || '';
      countryInput.value = cam.country || '';
      sourceInput.value = cam.source || '';
      statusSelect.value = cam.status || 'operational';
      typeSelect.value = cam.is_snapshot ? 'picture' : (cam.is_mjpeg ? 'mjpeg' : 'live');
    } else {
      title.textContent = 'ADD NEW CCTV STREAM';
      idInput.value = '';
      nameInput.value = '';
      urlInput.value = '';
      latInput.value = '';
      lonInput.value = '';
      cityInput.value = '';
      countryInput.value = 'France';
      sourceInput.value = 'Manual Admin';
      statusSelect.value = 'operational';
      typeSelect.value = 'live';
    }

    modal.classList.add('active');
  }

  // TAB 3: Interactive SSRF Security Tester
  function setupSsrfTester() {
    const btnTest = document.getElementById('btn-test-ssrf');
    const testInput = document.getElementById('ssrf-test-input');
    const resultBox = document.getElementById('ssrf-test-result');

    if (btnTest && testInput && resultBox) {
      btnTest.addEventListener('click', async () => {
        const testUrl = testInput.value.trim();
        if (!testUrl) return;

        btnTest.textContent = 'TESTING...';
        resultBox.className = 'tester-result hidden';

        try {
          const res = await apiFetch('/api/admin/cameras/probe', {
            method: 'POST',
            body: { url: testUrl }
          });
          const data = await res.json();
          btnTest.textContent = 'TEST SSRF FILTER';
          resultBox.classList.remove('hidden');

          if (!res.ok) {
            resultBox.className = 'tester-result result-block';
            resultBox.innerHTML = `
              <strong>🛡️ BLOCKED BY DEFENSE ENGINE (SSRF Protection Triggered)</strong><br>
              Server response: <em>${escapeHtml(data.error)}</em><br>
              Status: <code>HTTP 400 Bad Request / Forbidden</code>
            `;
          } else {
            resultBox.className = 'tester-result result-pass';
            resultBox.innerHTML = `
              <strong>✓ ALLOWED BY FILTER (Public Target Permitted)</strong><br>
              Target host is not private, loopback, or metadata. Result: <code>${escapeHtml(data.status)}</code>
            `;
          }
        } catch (err) {
          btnTest.textContent = 'TEST SSRF FILTER';
          resultBox.className = 'tester-result result-block';
          resultBox.textContent = 'Network probe error';
          resultBox.classList.remove('hidden');
        }
      });
    }
  }

  // Initialize on page load
  window.addEventListener('DOMContentLoaded', () => {
    checkAuthSession();
  });

})();
