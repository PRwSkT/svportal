const API_BASE = '/api/signage';

let allDevices = [];
let allGroups = [];
let allMedia = [];

// SVG Icon Helpers
const ICONS = {
  globe: `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  users: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  tv: `<svg class="icon icon-sm" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`,
  landscape: `<svg class="icon icon-sm" viewBox="0 0 24 24"><rect width="20" height="13" x="2" y="5.5" rx="2"/></svg>`,
  portrait: `<svg class="icon icon-sm" viewBox="0 0 24 24"><rect width="13" height="20" x="5.5" y="2" rx="2"/></svg>`,
  edit: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  trash: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  video: `<svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect width="14" height="14" x="1" y="5" rx="2"/></svg>`,
  image: `<svg class="icon icon-sm" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
  check: `<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
  loadScreens();
  loadGroups();
  loadMedia();
  loadCampaigns();
  loadTickerSetting();
  initFileUploadListener();
});

function initFileUploadListener() {
  const fileInput = document.getElementById('media-file-input');
  if (!fileInput) return;

  fileInput.addEventListener('change', function() {
    const file = this.files?.[0];
    if (!file) return;

    const titleInput = document.getElementById('media-title-input');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }

    if (file.type.startsWith('video/')) {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.onloadedmetadata = function() {
        window.URL.revokeObjectURL(tempVideo.src);
        const durationInput = document.getElementById('media-duration-input');
        if (durationInput && tempVideo.duration && isFinite(tempVideo.duration)) {
          durationInput.value = Math.ceil(tempVideo.duration);
          showToast(`ตรวจพบความยาววิดีโออัตโนมัติ: ${Math.ceil(tempVideo.duration)} วินาที`);
        }
      };
      tempVideo.src = URL.createObjectURL(file);
    }
  });
}

// TOAST NOTIFICATIONS (No blocking alerts)
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${type === 'success' ? ICONS.check : ''}
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// TAB SWITCHING
function switchTab(tabName) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(`tab-${tabName}`);
  if (targetPane) targetPane.classList.add('active');

  const navBtn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.getAttribute('onclick')?.includes(tabName));
  if (navBtn) navBtn.classList.add('active');

  if (tabName === 'simulator') {
    populateSimulatorOptions();
  }
}

// TARGET TYPE SELECTION (Interactive Cards)
function selectTargetCard(type) {
  document.querySelectorAll('.target-select-card').forEach(c => c.classList.remove('selected'));
  const radio = document.querySelector(`input[name="target-type"][value="${type}"]`);
  if (radio) radio.checked = true;

  const card = document.getElementById(`card-target-${type.toLowerCase()}`);
  if (card) card.classList.add('selected');

  handleTargetTypeChange();
}

function handleTargetTypeChange() {
  const selected = document.querySelector('input[name="target-type"]:checked').value;
  const groupSub = document.getElementById('target-sub-group');
  const specificSub = document.getElementById('target-sub-specific');

  groupSub.classList.remove('active');
  specificSub.classList.remove('active');

  if (selected === 'GROUP') {
    groupSub.classList.add('active');
  } else if (selected === 'SPECIFIC') {
    specificSub.classList.add('active');
  }
}

// 1. SCREENS & MONITORING
async function loadScreens() {
  try {
    const res = await fetch(`${API_BASE}/devices`);
    const json = await res.json();
    if (!json.success) return;

    allDevices = json.data;

    // Update stats
    const total = allDevices.length;
    const online = allDevices.filter(d => d.computed_status === 'ONLINE').length;
    const offline = total - online;

    document.getElementById('stat-total-screens').textContent = total;
    document.getElementById('stat-online-screens').textContent = online;
    document.getElementById('stat-offline-screens').textContent = offline;
    updateZoneStats();

    renderScreensTable(allDevices);
    populateDeviceCheckboxes();
    populateSimulatorOptions();
  } catch (err) {
    console.error('Error loading screens:', err);
  }
}

function filterScreens() {
  const query = document.getElementById('screen-search').value.toLowerCase().trim();
  if (!query) {
    renderScreensTable(allDevices);
    return;
  }
  const filtered = allDevices.filter(d => 
    d.id.toLowerCase().includes(query) ||
    d.name.toLowerCase().includes(query) ||
    (d.group_name && d.group_name.toLowerCase().includes(query)) ||
    (d.ip_address && d.ip_address.includes(query))
  );
  renderScreensTable(filtered);
}

function renderScreensTable(devices) {
  const tbody = document.getElementById('screens-table-body');
  if (devices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
          <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--text-main);">ยังไม่มีหน้าจอทีวีในระบบ</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">กดปุ่ม "+ เพิ่มหน้าจอทีวี" ด้านบนเพื่อลงทะเบียนล่วงหน้า หรือเปิดเบราว์เซอร์บน Android TV เพื่อเชื่อมต่ออัตโนมัติ</div>
          <button class="btn btn-primary btn-sm" onclick="openCreateDeviceModal()">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>ลงทะเบียนหน้าจอแรก</span>
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = devices.map(d => {
    const isOnline = d.computed_status === 'ONLINE';
    const lastPing = d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleTimeString('th-TH') : '-';
    const groupBadge = d.group_name 
      ? `<span class="badge-tag badge-group">${ICONS.users} ${d.group_name}</span>` 
      : '<span style="color: #94a3b8; font-size: 12px;">ไม่ได้ระบุ</span>';
    
    const ori = d.orientation || 'LANDSCAPE';
    const isPortrait = ori.startsWith('PORTRAIT');
    const oriBadge = `<span class="badge-tag ${isPortrait ? 'badge-portrait' : 'badge-landscape'}">
      ${isPortrait ? ICONS.portrait : ICONS.landscape}
      ${isPortrait ? 'แนวตั้ง (9:16)' : 'แนวนอน (16:9)'}
    </span>`;

    const isMuted = d.is_muted === 1;
    const audioBadge = isMuted 
      ? `<span class="badge-tag" style="background:#fef2f2; color:#ef4444; font-size:11.5px;">🔇 ปิดเสียง</span>` 
      : `<span class="badge-tag" style="background:#f0fdf4; color:#15803d; font-size:11.5px;">🔊 เปิดเสียง</span>`;

    const fps = d.current_fps || 60;
    const dropped = d.dropped_frames || 0;
    const perfBadge = isOnline 
      ? `<span class="badge-tag" style="font-family: monospace; font-size: 11px; background: ${dropped > 5 ? '#fef2f2; color: #ef4444;' : '#f0fdf4; color: #15803d;'}">
          ${fps} FPS (${dropped} drop)
        </span>`
      : '<span style="color: #94a3b8; font-size: 12px;">-</span>';

    return `
      <tr>
        <td>
          <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
            <span class="status-dot"></span>
            ${isOnline ? 'Online' : 'Offline'}
          </span>
        </td>
        <td><strong>${d.id}</strong></td>
        <td>${d.name}</td>
        <td>${groupBadge}</td>
        <td>${oriBadge}</td>
        <td>${audioBadge}</td>
        <td><code>${d.ip_address || '-'}</code></td>
        <td>${d.current_media_id ? `<span style="font-size: 11px; font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${d.current_media_id}</span>` : '-'}</td>
        <td>${d.free_storage_mb ? `${Math.round(d.free_storage_mb)} MB` : '-'}</td>
        <td>${perfBadge}</td>
        <td style="color: var(--text-muted); font-size: 12px;">${lastPing}</td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <button class="btn btn-outline btn-sm" onclick="openEditDeviceModal('${d.id}')">
              ${ICONS.edit}
              <span>แก้ไข</span>
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="handleDeleteDevice('${d.id}')" title="ลบหน้าจอ">
              ${ICONS.trash}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// CREATE DEVICE MODAL
function openCreateDeviceModal() {
  document.getElementById('create-device-form').reset();
  const groupSelect = document.getElementById('new-device-group');
  groupSelect.innerHTML = `
    <option value="">-- ไม่ระบุกลุ่ม --</option>
    ${allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
  `;
  document.getElementById('create-device-modal').classList.add('open');
}

function closeCreateDeviceModal() {
  document.getElementById('create-device-modal').classList.remove('open');
}

async function handleCreateDevice(event) {
  event.preventDefault();
  const id = document.getElementById('new-device-id').value.trim();
  const name = document.getElementById('new-device-name').value.trim();
  const groupId = document.getElementById('new-device-group').value;
  const orientation = document.getElementById('new-device-orientation').value;
  const isMuted = document.getElementById('new-device-audio').value === 'muted';

  try {
    const res = await fetch(`${API_BASE}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id, 
        name, 
        group_id: groupId || null, 
        orientation,
        is_muted: isMuted ? 1 : 0
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('ลงทะเบียนหน้าจอทีวีเรียบร้อยแล้ว');
      closeCreateDeviceModal();
      loadScreens();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to create device: ' + err.message, 'error');
  }
}

async function handleDeleteDevice(id) {
  if (!confirm(`ต้องการลบหน้าจอ "${id}" ออกจากระบบใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`${API_BASE}/devices/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('ลบหน้าจอเรียบร้อยแล้ว');
      loadScreens();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

// EDIT DEVICE MODAL
function openEditDeviceModal(id) {
  const device = allDevices.find(d => d.id === id);
  if (!device) return;

  document.getElementById('edit-device-id').value = device.id;
  document.getElementById('edit-device-id-display').value = device.id;
  document.getElementById('edit-device-name').value = device.name;

  // Populate Groups select
  const groupSelect = document.getElementById('edit-device-group');
  groupSelect.innerHTML = `
    <option value="">-- ไม่ระบุกลุ่ม --</option>
    ${allGroups.map(g => `<option value="${g.id}" ${device.group_id === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
  `;

  // Set Orientation
  document.getElementById('edit-device-orientation').value = device.orientation || 'LANDSCAPE';

  // Set Audio
  document.getElementById('edit-device-audio').value = (device.is_muted === 1) ? 'muted' : 'unmuted';

  document.getElementById('edit-device-modal').classList.add('open');
}

function closeEditDeviceModal() {
  document.getElementById('edit-device-modal').classList.remove('open');
}

async function handleSaveDeviceEdit(event) {
  event.preventDefault();
  const id = document.getElementById('edit-device-id').value;
  const name = document.getElementById('edit-device-name').value.trim();
  const groupId = document.getElementById('edit-device-group').value;
  const orientation = document.getElementById('edit-device-orientation').value;
  const isMuted = document.getElementById('edit-device-audio').value === 'muted';

  try {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        group_id: groupId || null, 
        orientation,
        is_muted: isMuted ? 1 : 0
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('บันทึกการตั้งค่าหน้าจอเรียบร้อยแล้ว');
      closeEditDeviceModal();
      loadScreens();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

// 2. GROUPS & ZONES MANAGEMENT
async function loadGroups() {
  try {
    const res = await fetch(`${API_BASE}/devices/groups`);
    const json = await res.json();
    if (json.success) {
      allGroups = json.data;
      updateZoneStats();
      renderZonesTable(allGroups);
      populateGroupCheckboxes();
    }
  } catch (e) {
    console.error('Error loading groups:', e);
  }
}

function updateZoneStats() {
  const totalZonesEl = document.getElementById('stat-total-zones');
  const assignedScreensEl = document.getElementById('stat-assigned-screens');
  const unassignedScreensEl = document.getElementById('stat-unassigned-screens');

  if (totalZonesEl) totalZonesEl.textContent = allGroups.length;
  if (assignedScreensEl) assignedScreensEl.textContent = allDevices.filter(d => d.group_id).length;
  if (unassignedScreensEl) unassignedScreensEl.textContent = allDevices.filter(d => !d.group_id).length;
}

function filterZones() {
  const query = document.getElementById('zone-search').value.toLowerCase().trim();
  if (!query) {
    renderZonesTable(allGroups);
    return;
  }
  const filtered = allGroups.filter(g => 
    g.id.toLowerCase().includes(query) ||
    g.name.toLowerCase().includes(query) ||
    (g.description && g.description.toLowerCase().includes(query))
  );
  renderZonesTable(filtered);
}

function renderZonesTable(groups) {
  const tbody = document.getElementById('zones-table-body');
  if (!tbody) return;

  if (groups.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
          <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--text-main);">ยังไม่มีโซนในระบบ</div>
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">กดปุ่ม "+ เพิ่มโซนใหม่" ด้านบนเพื่อเริ่มกำหนดกลุ่มพื้นที่และอาคาร</div>
          <button class="btn btn-primary btn-sm" onclick="openCreateZoneModal()">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>เพิ่มโซนแรก</span>
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = groups.map(g => {
    const devCount = g.device_count || 0;
    const countBadge = devCount > 0
      ? `<button class="badge-tag badge-group" style="cursor: pointer; border: none; font-size: 12px; padding: 4px 10px;" onclick="openViewZoneScreensModal('${g.id}')" title="คลิกเพื่อดูจอในโซนนี้">
           ${ICONS.tv} <strong>${devCount}</strong> จอ (ดูรายชื่อ)
         </button>`
      : `<span class="badge-tag" style="background: #f1f5f9; color: #94a3b8; font-size: 12px;">0 จอ</span>`;

    return `
      <tr>
        <td><code>${g.id}</code></td>
        <td><strong>${g.name}</strong></td>
        <td style="color: #475569; font-size: 13px;">${g.description || '-'}</td>
        <td>${countBadge}</td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <button class="btn btn-outline btn-sm" onclick="openEditZoneModal('${g.id}')">
              ${ICONS.edit}
              <span>แก้ไข</span>
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="handleDeleteZone('${g.id}')" title="ลบโซน">
              ${ICONS.trash}
              <span>ลบ</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// CREATE ZONE MODAL
function openCreateZoneModal() {
  document.getElementById('create-zone-form').reset();
  document.getElementById('create-zone-modal').classList.add('open');
}

function closeCreateZoneModal() {
  document.getElementById('create-zone-modal').classList.remove('open');
}

async function handleCreateZone(event) {
  event.preventDefault();
  const id = document.getElementById('new-zone-id').value.trim();
  const name = document.getElementById('new-zone-name').value.trim();
  const description = document.getElementById('new-zone-desc').value.trim();

  try {
    const res = await fetch(`${API_BASE}/devices/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, description })
    });
    const json = await res.json();
    if (json.success) {
      showToast('เพิ่มโซนใหม่เรียบร้อยแล้ว');
      closeCreateZoneModal();
      loadGroups();
      loadScreens();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to create zone: ' + err.message, 'error');
  }
}

// EDIT ZONE MODAL
function openEditZoneModal(id) {
  const group = allGroups.find(g => g.id === id);
  if (!group) return;

  document.getElementById('edit-zone-id').value = group.id;
  document.getElementById('edit-zone-id-display').value = group.id;
  document.getElementById('edit-zone-name').value = group.name;
  document.getElementById('edit-zone-desc').value = group.description || '';

  document.getElementById('edit-zone-modal').classList.add('open');
}

function closeEditZoneModal() {
  document.getElementById('edit-zone-modal').classList.remove('open');
}

async function handleSaveZoneEdit(event) {
  event.preventDefault();
  const id = document.getElementById('edit-zone-id').value;
  const name = document.getElementById('edit-zone-name').value.trim();
  const description = document.getElementById('edit-zone-desc').value.trim();

  try {
    const res = await fetch(`${API_BASE}/devices/groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    const json = await res.json();
    if (json.success) {
      showToast('บันทึกการแก้ไขโซนเรียบร้อยแล้ว');
      closeEditZoneModal();
      loadGroups();
      loadScreens();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to update zone: ' + err.message, 'error');
  }
}

// DELETE ZONE
async function handleDeleteZone(id) {
  const group = allGroups.find(g => g.id === id);
  const name = group ? group.name : id;
  if (!confirm(`ต้องการลบโซน "${name}" (${id}) ใช่หรือไม่?\n(หน้าจอทีวีที่อยู่ในโซนนี้จะถูกปลดออกเป็น 'ไม่ได้ระบุโซน')`)) return;

  try {
    const res = await fetch(`${API_BASE}/devices/groups/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('ลบโซนเรียบร้อยแล้ว');
      loadGroups();
      loadScreens();
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete zone: ' + err.message, 'error');
  }
}

// VIEW ZONE SCREENS MODAL
function openViewZoneScreensModal(groupId) {
  const group = allGroups.find(g => g.id === groupId);
  const screens = allDevices.filter(d => d.group_id === groupId);

  document.getElementById('view-zone-title').textContent = `หน้าจอทีวีในโซน: ${group ? group.name : groupId} (${screens.length} จอ)`;
  const listEl = document.getElementById('view-zone-screens-list');

  if (screens.length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">ยังไม่มีหน้าจอทีวีใดสังกัดโซนนี้</div>';
  } else {
    listEl.innerHTML = `
      <table style="width: 100%;">
        <thead>
          <tr>
            <th>สถานะ</th>
            <th>Device ID</th>
            <th>ชื่อหน้าจอ</th>
            <th>การวางจอ</th>
            <th style="text-align: right;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${screens.map(d => {
            const isOnline = d.computed_status === 'ONLINE';
            const isPortrait = (d.orientation || '').startsWith('PORTRAIT');
            return `
              <tr>
                <td>
                  <span class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
                    <span class="status-dot"></span>
                    ${isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td><strong>${d.id}</strong></td>
                <td>${d.name}</td>
                <td>
                  <span class="badge-tag ${isPortrait ? 'badge-portrait' : 'badge-landscape'}">
                    ${isPortrait ? ICONS.portrait : ICONS.landscape}
                    ${isPortrait ? 'แนวตั้ง (9:16)' : 'แนวนอน (16:9)'}
                  </span>
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-outline btn-sm" onclick="closeViewZoneScreensModal(); openEditDeviceModal('${d.id}')">
                    ${ICONS.edit}
                    <span>แก้ไข</span>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  document.getElementById('view-zone-screens-modal').classList.add('open');
}

function closeViewZoneScreensModal() {
  document.getElementById('view-zone-screens-modal').classList.remove('open');
}

function populateGroupCheckboxes() {
  const container = document.getElementById('group-checkbox-container');
  if (!container) return;
  container.innerHTML = allGroups.map(g => `
    <label class="checkbox-item">
      <input type="checkbox" name="target-group-item" value="${g.id}">
      <span>${g.name}</span>
    </label>
  `).join('');
}

function populateDeviceCheckboxes() {
  const container = document.getElementById('device-checkbox-container');
  if (!container) return;
  container.innerHTML = allDevices.map(d => `
    <label class="checkbox-item">
      <input type="checkbox" name="target-device-item" value="${d.id}">
      <span>${d.name} (${d.id})</span>
    </label>
  `).join('');
}

// 3. MEDIA MANAGEMENT
async function loadMedia() {
  try {
    const res = await fetch(`${API_BASE}/media`);
    const json = await res.json();
    if (!json.success) return;

    allMedia = json.data;
    document.getElementById('stat-total-media').textContent = allMedia.length;

    // Populate visual media picker for campaigns
    const picker = document.getElementById('campaign-media-picker');
    if (allMedia.length === 0) {
      picker.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 12px;">ยังไม่มีไฟล์สื่อในคลัง กรุณาอัปโหลดก่อน</div>';
    } else {
      picker.innerHTML = allMedia.map(m => `
        <label class="media-picker-card" id="media-card-picker-${m.id}" onclick="toggleMediaPickerCard('${m.id}')">
          <input type="checkbox" name="cmp-media-item" value="${m.id}" style="display:none;" id="cmp-cb-${m.id}">
          <div class="media-picker-thumb">
            ${m.type === 'video' ? ICONS.video : `<img src="${m.file_url}" alt="">`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${m.type.toUpperCase()} • ${m.duration_seconds}s</div>
          </div>
        </label>
      `).join('');
    }

    // Populate gallery
    const gallery = document.getElementById('media-gallery');
    if (allMedia.length === 0) {
      gallery.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">ยังไม่มีไฟล์สื่อ</p>';
      return;
    }

    gallery.innerHTML = allMedia.map(m => `
      <div class="media-card">
        <div class="media-preview-box">
          <span class="media-type-tag">
            ${m.type === 'video' ? ICONS.video : ICONS.image}
            ${m.type.toUpperCase()}
          </span>
          ${m.type === 'image' 
            ? `<img src="${m.file_url}" alt="${m.title}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><text y=\\'50%\\' x=\\'50%\\' text-anchor=\\'middle\\' fill=\\'white\\'>IMAGE</text></svg>'">` 
            : `<video src="${m.file_url}" muted></video>`
          }
        </div>
        <div class="media-info">
          <div class="media-title" title="${m.title}">${m.title}</div>
          <div class="media-meta">${m.duration_seconds} วินาที • ID: ${m.id}</div>
          <div class="media-actions">
            <span style="font-size: 11px; color: #94a3b8;">${new Date(m.created_at).toLocaleDateString('th-TH')}</span>
            <button class="btn btn-danger-outline btn-sm" onclick="handleDeleteMedia('${m.id}')">
              ${ICONS.trash}
              <span>ลบ</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');

  } catch (e) {
    console.error('Error loading media:', e);
  }
}

function toggleMediaPickerCard(id) {
  const cb = document.getElementById(`cmp-cb-${id}`);
  const card = document.getElementById(`media-card-picker-${id}`);
  if (!cb || !card) return;

  cb.checked = !cb.checked;
  if (cb.checked) {
    card.classList.add('selected');
  } else {
    card.classList.remove('selected');
  }
}

async function handleUploadMedia(event) {
  event.preventDefault();
  const fileInput = document.getElementById('media-file-input');
  const titleInput = document.getElementById('media-title-input');
  const durationInput = document.getElementById('media-duration-input');
  const btn = document.getElementById('btn-upload');

  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('กรุณาเลือกไฟล์สื่อ', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('title', titleInput.value || fileInput.files[0].name);
  formData.append('duration_seconds', durationInput.value || '10');

  btn.disabled = true;
  btn.innerHTML = `<span>กำลังอัปโหลด...</span>`;

  try {
    const res = await fetch(`${API_BASE}/media`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (json.success) {
      showToast('อัปโหลดไฟล์สื่อสำเร็จ!');
      fileInput.value = '';
      titleInput.value = '';
      loadMedia();
    } else {
      showToast('เกิดข้อผิดพลาด: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${ICONS.video} <span>Upload สื่อ</span>`;
  }
}

async function handleDeleteMedia(id) {
  if (!confirm('ต้องการลบสื่อนี้ใช่หรือไม่? สื่อนี้จะถูกถอดออกจากแคมเปญทั้งหมด')) return;

  try {
    const res = await fetch(`${API_BASE}/media/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('ลบไฟล์สื่อเรียบร้อยแล้ว');
      loadMedia();
      loadCampaigns();
    } else {
      showToast(json.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

// 4. CAMPAIGNS & TARGETING
async function loadCampaigns() {
  try {
    const res = await fetch(`${API_BASE}/campaigns`);
    const json = await res.json();
    if (!json.success) return;

    const tbody = document.getElementById('campaigns-table-body');
    if (json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">ยังไม่มีแคมเปญที่สร้างไว้</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(c => {
      let targetDesc = '';
      if (c.target_type === 'ALL') {
        targetDesc = `<span class="badge-tag badge-group">${ICONS.globe} ทุกหน้าจอ (All)</span>`;
      } else if (c.target_type === 'GROUP') {
        targetDesc = `<span class="badge-tag badge-portrait">${ICONS.users} กลุ่ม: ${c.target_ids.join(', ')}</span>`;
      } else {
        targetDesc = `<span class="badge-tag badge-landscape" style="background:#f3e8ff; color:#6b21a8;">${ICONS.tv} เจาะจง: ${c.target_ids.join(', ')}</span>`;
      }

      return `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${targetDesc}</td>
          <td>${c.media.length} ไฟล์</td>
          <td><span class="badge-tag badge-landscape">${c.priority}</span></td>
          <td style="color: var(--text-muted); font-size: 12px;">${new Date(c.created_at).toLocaleDateString('th-TH')}</td>
          <td style="text-align: right;">
            <button class="btn btn-danger-outline btn-sm" onclick="handleDeleteCampaign('${c.id}')">
              ${ICONS.trash}
              <span>ลบ</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (e) {
    console.error('Error loading campaigns:', e);
  }
}

async function handleCreateCampaign(event) {
  event.preventDefault();
  const name = document.getElementById('cmp-name').value.trim();
  const targetType = document.querySelector('input[name="target-type"]:checked').value;
  const priority = document.getElementById('cmp-priority').value;

  let targetIds = [];
  if (targetType === 'GROUP') {
    const checked = Array.from(document.querySelectorAll('input[name="target-group-item"]:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      showToast('กรุณาเลือกอย่างน้อย 1 กลุ่ม', 'error');
      return;
    }
    targetIds = checked;
  } else if (targetType === 'SPECIFIC') {
    const checked = Array.from(document.querySelectorAll('input[name="target-device-item"]:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      showToast('กรุณาเลือกอย่างน้อย 1 หน้าจอ', 'error');
      return;
    }
    targetIds = checked;
  }

  const selectedMedia = Array.from(document.querySelectorAll('input[name="cmp-media-item"]:checked')).map(cb => cb.value);
  if (selectedMedia.length === 0) {
    showToast('กรุณาคลิกเลือกอย่างน้อย 1 สื่อสำหรับแคมเปญนี้', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        target_type: targetType,
        target_ids: targetIds,
        priority: parseInt(priority),
        media_ids: selectedMedia
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast('บันทึกและเผยแพร่แคมเปญเรียบร้อยแล้ว');
      document.getElementById('create-campaign-form').reset();
      selectTargetCard('ALL');
      document.querySelectorAll('.media-picker-card').forEach(c => c.classList.remove('selected'));
      loadCampaigns();
    } else {
      showToast(json.error, 'error');
    }
  } catch (e) {
    showToast('Failed to create campaign: ' + e.message, 'error');
  }
}

async function handleDeleteCampaign(id) {
  if (!confirm('ยืนยันลบแคมเปญนี้ใช่หรือไม่?')) return;
  try {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('ลบแคมเปญเรียบร้อยแล้ว');
      loadCampaigns();
    }
  } catch (e) {
    showToast('Failed to delete: ' + e.message, 'error');
  }
}

// 5. SIMULATOR
function populateSimulatorOptions() {
  const select = document.getElementById('sim-device-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = allDevices.map(d => {
    const oriText = (d.orientation && d.orientation.startsWith('PORTRAIT')) ? '9:16' : '16:9';
    return `<option value="${d.id}">[${oriText} | ${d.group_name || 'No Group'}] ${d.name} (${d.id})</option>`;
  }).join('');

  if (currentVal && allDevices.some(d => d.id === currentVal)) {
    select.value = currentVal;
  } else if (allDevices.length > 0) {
    updateSimulator();
  }
}

function updateSimulator() {
  const select = document.getElementById('sim-device-select');
  const iframe = document.getElementById('tv-sim-iframe');
  const frame = document.querySelector('.tv-frame');

  if (select && select.value) {
    const selectedDevice = allDevices.find(d => d.id === select.value);
    
    // Automatically match simulator frame ratio to device orientation
    if (selectedDevice && selectedDevice.orientation && selectedDevice.orientation.startsWith('PORTRAIT')) {
      frame.classList.add('portrait');
    } else {
      frame.classList.remove('portrait');
    }

    iframe.src = `/tv/?deviceId=${encodeURIComponent(select.value)}&sim=1`;
  }
}

function toggleSimulatorOrientation() {
  const frame = document.querySelector('.tv-frame');
  if (frame) {
    frame.classList.toggle('portrait');
    showToast(`สลับกรอบเป็น ${frame.classList.contains('portrait') ? 'แนวตั้ง (9:16)' : 'แนวนอน (16:9)'}`);
  }
}

// 6. TICKER ANNOUNCEMENT SETTINGS
async function loadTickerSetting() {
  try {
    const res = await fetch(`${API_BASE}/settings/ticker`);
    const json = await res.json();
    if (json.success && json.ticker_text !== undefined) {
      const input = document.getElementById('ticker-text-input');
      if (input) input.value = json.ticker_text;
    }
  } catch (err) {
    console.error('Error loading ticker setting:', err);
  }
}

async function handleSaveTicker(event) {
  event.preventDefault();
  const input = document.getElementById('ticker-text-input');
  const btn = document.getElementById('btn-save-ticker');
  const text = input.value.trim();

  if (!text) {
    showToast('กรุณาระบุข้อความตัววิ่ง', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>กำลังบันทึก...</span>';

  try {
    const res = await fetch(`${API_BASE}/settings/ticker`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker_text: text })
    });
    const json = await res.json();
    if (json.success) {
      showToast('บันทึกข้อความตัววิ่งเรียบร้อยแล้ว (จอทีวีจะอัปเดตทันที)');
      // If simulator is active, update simulator iframe ticker if available
      const iframe = document.getElementById('tv-sim-iframe');
      if (iframe && iframe.contentDocument) {
        const simTicker = iframe.contentDocument.getElementById('ticker-text');
        if (simTicker) simTicker.textContent = text;
      }
    } else {
      showToast(json.error, 'error');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> <span>บันทึกข้อความตัววิ่ง</span>`;
  }
}
