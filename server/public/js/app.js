/**
 * MediRemind — Main Application JavaScript
 * Handles tabs, clock, API calls, WebSocket events, and all UI interactions.
 */

const API = '';
let socket = null;
let currentAlert = null;

// ═══════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initTabs();
  initDayChips();
  initSocket();
  loadDashboard();
  loadSchedules();
  loadCaretakers();
  loadLogs();
});

// ═══════════════════════════════════════════
//  LIVE CLOCK
// ═══════════════════════════════════════════

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('liveClock').textContent = `${h}:${m}:${s}`;
}

// ═══════════════════════════════════════════
//  TAB NAVIGATION
// ═══════════════════════════════════════════

function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
      // Refresh data on tab switch
      const tabName = tab.dataset.tab;
      if (tabName === 'dashboard') loadDashboard();
      else if (tabName === 'schedules') loadSchedules();
      else if (tabName === 'caretakers') loadCaretakers();
      else if (tabName === 'history') loadLogs();
    });
  });
}

// ═══════════════════════════════════════════
//  DAY CHIPS
// ═══════════════════════════════════════════

function initDayChips() {
  document.querySelectorAll('.day-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}

function getSelectedDays() {
  const days = [];
  document.querySelectorAll('.day-chip.selected').forEach(c => days.push(parseInt(c.dataset.day)));
  return days;
}

function setSelectedDays(days) {
  document.querySelectorAll('.day-chip').forEach(c => {
    c.classList.toggle('selected', days.includes(parseInt(c.dataset.day)));
  });
}

function clearDayChips() {
  document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('selected'));
}

// ═══════════════════════════════════════════
//  WEBSOCKET (Socket.io)
// ═══════════════════════════════════════════

function initSocket() {
  try {
    socket = io();

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      showToast('Connected to server', 'success');
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      showToast('Disconnected from server', 'error');
    });

    // Reminder events
    socket.on('reminder:trigger', (data) => {
      showToast(`⏰ Time to take ${data.medicineName}!`, 'warning');
      showMedicineAlert(data);
      loadDashboard();
    });

    socket.on('reminder:taken', (data) => {
      showToast(`✅ ${data.medicineName} marked as taken!`, 'success');
      dismissAlert();
      loadDashboard();
      loadSchedules();
    });

    socket.on('reminder:missed', (data) => {
      showToast(`❌ ${data.medicineName} was missed!`, 'error');
      loadDashboard();
      loadSchedules();
    });

    socket.on('reminder:escalated', (data) => {
      showToast(`🚨 ${data.medicineName} escalated! Caretakers notified.`, 'error');
      dismissAlert();
      loadDashboard();
      loadSchedules();
      loadLogs();
    });

    // Device events
    socket.on('device:status', (data) => updateDeviceUI(data));
    socket.on('device:heartbeat', (data) => updateDeviceUI(data));
    socket.on('device:offline', () => {
      updateDeviceUI({ online: false });
      showToast('⚠️ ESP8266 device went offline', 'warning');
    });

    // Schedule events
    socket.on('schedule:created', () => { loadSchedules(); loadDashboard(); });
    socket.on('schedule:updated', () => { loadSchedules(); loadDashboard(); });
    socket.on('schedule:deleted', () => { loadSchedules(); loadDashboard(); });

    // Caretaker events
    socket.on('caretaker:created', () => loadCaretakers());
    socket.on('caretaker:updated', () => loadCaretakers());
    socket.on('caretaker:deleted', () => loadCaretakers());

  } catch (e) {
    console.warn('Socket.io not available:', e.message);
  }
}

// ═══════════════════════════════════════════
//  DEVICE STATUS UI
// ═══════════════════════════════════════════

function updateDeviceUI(data) {
  const dot = document.getElementById('deviceDot');
  const label = document.getElementById('deviceLabel');
  if (data && data.online) {
    dot.classList.add('online');
    label.textContent = 'ESP8266 Online';
  } else {
    dot.classList.remove('online');
    label.textContent = 'ESP8266 Offline';
  }
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════

async function loadDashboard() {
  try {
    // Load stats
    const statsRes = await fetch(`${API}/api/logs/stats`);
    const stats = await statsRes.json();
    if (stats.success) {
      document.getElementById('statTaken').textContent = stats.data.today.taken;
      document.getElementById('statMissed').textContent = stats.data.today.missed;
      document.getElementById('statEscalated').textContent = stats.data.today.escalated;
      document.getElementById('statCompliance').textContent = stats.data.overall.complianceRate + '%';
    }

    // Load pending count from schedules
    const schRes = await fetch(`${API}/api/schedules/upcoming`);
    const schData = await schRes.json();
    if (schData.success) {
      const pending = schData.data.filter(s => s.status === 'Pending').length;
      document.getElementById('statPending').textContent = pending;
      renderUpcoming(schData.data);
    }

    // Load device status
    const devRes = await fetch(`${API}/api/device/status`);
    const devData = await devRes.json();
    if (devData.success) updateDeviceUI(devData.data);

  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function renderUpcoming(schedules) {
  const container = document.getElementById('upcomingList');
  if (!schedules || schedules.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>No Reminders</h3><p>Add medicine schedules to see upcoming reminders.</p></div>`;
    return;
  }

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const sorted = schedules.map(s => {
    const [h, m] = s.scheduledTime.split(':').map(Number);
    const totalMins = h * 60 + m;
    const diff = totalMins - currentMins;
    return { ...s, diff, totalMins };
  }).sort((a, b) => {
    // Show upcoming first, then past
    if (a.diff >= 0 && b.diff < 0) return -1;
    if (a.diff < 0 && b.diff >= 0) return 1;
    return a.totalMins - b.totalMins;
  });

  container.innerHTML = sorted.map(s => {
    const statusClass = s.status.toLowerCase();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const daysText = (!s.days || s.days.length === 0) ? 'Every Day' : s.days.map(d => dayNames[d]).join(', ');
    const countdown = s.diff > 0 ? `in ${Math.floor(s.diff/60)}h ${s.diff%60}m` : s.diff === 0 ? 'NOW!' : '';

    return `
      <div class="list-item">
        <div class="list-item-left">
          <div class="item-time">${s.scheduledTime}</div>
          <div class="item-info">
            <h4>${escHtml(s.medicineName || 'Medicine')}</h4>
            <p>${daysText} ${countdown ? '• ' + countdown : ''}</p>
          </div>
        </div>
        <div class="list-item-right">
          <span class="badge badge-${statusClass}">${s.status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════
//  SCHEDULES CRUD
// ═══════════════════════════════════════════

async function loadSchedules() {
  try {
    const res = await fetch(`${API}/api/schedules`);
    const data = await res.json();
    if (data.success) renderScheduleList(data.data);
  } catch (e) {
    console.error('Load schedules error:', e);
  }
}

function renderScheduleList(schedules) {
  const container = document.getElementById('scheduleList');
  if (!schedules || schedules.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">⏰</div><h3>No Schedules</h3><p>Create your first medicine schedule above.</p></div>`;
    return;
  }

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  container.innerHTML = schedules.map(s => {
    const statusClass = s.status ? s.status.toLowerCase() : 'idle';
    const daysText = (!s.days || s.days.length === 0) ? 'Every Day' : s.days.map(d => dayNames[d]).join(', ');

    return `
      <div class="list-item">
        <div class="list-item-left">
          <div class="item-time">${s.scheduledTime}</div>
          <div class="item-info">
            <h4>${escHtml(s.medicineName || 'Medicine')}</h4>
            <p>${daysText}</p>
          </div>
        </div>
        <div class="list-item-right">
          <span class="badge badge-${statusClass}">${s.status || 'Idle'}</span>
          <button class="btn btn-sm btn-secondary btn-icon" onclick="editSchedule('${s._id}','${escAttr(s.medicineName)}','${s.scheduledTime}','${JSON.stringify(s.days||[])}')">✏️</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSchedule('${s._id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleScheduleSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('scheduleEditId').value;
  const body = {
    medicineName: document.getElementById('medicineName').value || 'Medicine',
    scheduledTime: document.getElementById('scheduledTime').value,
    days: getSelectedDays()
  };

  if (!body.scheduledTime) { showToast('Please select a time', 'error'); return; }

  try {
    const url = editId ? `${API}/api/schedules/${editId}` : `${API}/api/schedules`;
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
      showToast(editId ? 'Schedule updated!' : 'Schedule created!', 'success');
      document.getElementById('scheduleForm').reset();
      clearDayChips();
      cancelScheduleEdit();
      loadSchedules();
      loadDashboard();
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Network error', 'error');
  }
}

function editSchedule(id, name, time, daysJson) {
  document.getElementById('scheduleEditId').value = id;
  document.getElementById('medicineName').value = name;
  document.getElementById('scheduledTime').value = time;
  setSelectedDays(JSON.parse(daysJson));
  document.getElementById('scheduleFormTitle').textContent = 'Edit Schedule';
  document.getElementById('scheduleSubmitBtn').textContent = '💾 Update Schedule';
  document.getElementById('scheduleCancelBtn').classList.remove('hidden');
  document.getElementById('tab-schedules').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelScheduleEdit() {
  document.getElementById('scheduleEditId').value = '';
  document.getElementById('scheduleFormTitle').textContent = 'Add New Schedule';
  document.getElementById('scheduleSubmitBtn').textContent = '💊 Add Schedule';
  document.getElementById('scheduleCancelBtn').classList.add('hidden');
  document.getElementById('scheduleForm').reset();
  clearDayChips();
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  try {
    const res = await fetch(`${API}/api/schedules/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Schedule deleted', 'success');
      loadSchedules();
      loadDashboard();
    }
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

// ═══════════════════════════════════════════
//  CARETAKERS CRUD
// ═══════════════════════════════════════════

async function loadCaretakers() {
  try {
    const res = await fetch(`${API}/api/caretakers`);
    const data = await res.json();
    if (data.success) renderCaretakerList(data.data);
  } catch (e) {
    console.error('Load caretakers error:', e);
  }
}

function renderCaretakerList(caretakers) {
  const container = document.getElementById('caretakerList');
  if (!caretakers || caretakers.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">👥</div><h3>No Caretakers</h3><p>Add caretakers to receive SMS alerts.</p></div>`;
    return;
  }

  container.innerHTML = caretakers.map(c => {
    const initials = c.name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
    return `
      <div class="caretaker-card">
        <div class="caretaker-avatar">${initials}</div>
        <div class="caretaker-info">
          <h4>${escHtml(c.name)}</h4>
          <p>${escHtml(c.phone)}${c.relationship ? ' • ' + escHtml(c.relationship) : ''}</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <label class="toggle-switch">
            <input type="checkbox" ${c.isActive ? 'checked' : ''} onchange="toggleCaretaker('${c._id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteCaretaker('${c._id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCaretakerSubmit(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById('caretakerName').value,
    phone: document.getElementById('caretakerPhone').value,
    relationship: document.getElementById('caretakerRelation').value
  };

  if (!body.name || !body.phone) { showToast('Name and phone required', 'error'); return; }

  try {
    const res = await fetch(`${API}/api/caretakers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Caretaker added!', 'success');
      document.getElementById('caretakerForm').reset();
      loadCaretakers();
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Network error', 'error');
  }
}

async function toggleCaretaker(id, active) {
  try {
    await fetch(`${API}/api/caretakers/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: active })
    });
    showToast(active ? 'Caretaker activated' : 'Caretaker deactivated', 'info');
  } catch (e) {
    showToast('Update failed', 'error');
  }
}

async function deleteCaretaker(id) {
  if (!confirm('Delete this caretaker?')) return;
  try {
    const res = await fetch(`${API}/api/caretakers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Caretaker deleted', 'success');
      loadCaretakers();
    }
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

// ═══════════════════════════════════════════
//  HISTORY / LOGS
// ═══════════════════════════════════════════

async function loadLogs() {
  try {
    const dateInput = document.getElementById('historyDate');
    let url = `${API}/api/logs?limit=50`;
    if (dateInput && dateInput.value) url += `&date=${dateInput.value}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.success) renderLogList(data.data.logs);
  } catch (e) {
    console.error('Load logs error:', e);
  }
}

function clearDateFilter() {
  document.getElementById('historyDate').value = '';
  loadLogs();
}

function renderLogList(logs) {
  const container = document.getElementById('logList');
  if (!logs || logs.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>No History</h3><p>Medicine intake logs will appear here.</p></div>`;
    return;
  }

  container.innerHTML = logs.map(l => {
    const statusClass = l.status.toLowerCase();
    const time = l.scheduledTime || '--:--';
    const date = l.date || '';
    let detail = '';
    if (l.status === 'Taken' && l.takenAt) detail = `Taken at ${new Date(l.takenAt).toLocaleTimeString()}`;
    else if (l.status === 'Escalated' && l.smsSentTo && l.smsSentTo.length) detail = `SMS sent to ${l.smsSentTo.map(s=>s.name).join(', ')}`;
    else if (l.status === 'Missed') detail = 'Medicine was not taken';

    return `
      <div class="log-item">
        <div class="log-dot ${statusClass}"></div>
        <div class="log-details">
          <strong>${escHtml(l.medicineName || 'Medicine')}</strong> — ${time}
          <div class="log-meta">${date} • ${l.status}${detail ? ' • ' + detail : ''}</div>
        </div>
        <span class="badge badge-${statusClass}">${l.status}</span>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════
//  MEDICINE ALERT
// ═══════════════════════════════════════════

function showMedicineAlert(data) {
  currentAlert = data;
  document.getElementById('alertMessage').textContent = `It's time to take ${data.medicineName || 'your medicine'}.`;
  document.getElementById('alertTime').textContent = data.scheduledTime || '--:--';
  document.getElementById('alertConfirmBtn').setAttribute('data-schedule-id', data.scheduleId);
  document.getElementById('alertOverlay').classList.add('active');
}

function dismissAlert() {
  document.getElementById('alertOverlay').classList.remove('active');
  currentAlert = null;
}

function confirmMedicine() {
  const id = document.getElementById('alertConfirmBtn').getAttribute('data-schedule-id');
  if (id && socket) {
    socket.emit('medicine:confirm', { scheduleId: id });
    showToast('Confirmation sent!', 'success');
  }
  dismissAlert();
}

// ═══════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ═══════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
