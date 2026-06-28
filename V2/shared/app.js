/**
 * ============================================
 * Exam Platform - app.js (Final Unified Version)
 * ============================================
 * FIXES:
 * 1. Fixed all href paths (relative, not absolute)
 * 2. Dynamic sidebar with role-based nav
 * 3. Mobile sidebar toggle + overlay
 * 4. Session timeout (15 min idle → logout)
 * 5. Toast + Modal system
 * 6. Form validation engine
 * 7. Loading states (button + skeleton)
 * 8. LocalStorage with TTL expiry
 * 9. debounce / throttle / apiCall with retry
 */

// ============================================
// CONFIG
// ============================================
const APP_CONFIG = {
  sidebarWidth: 280,
  toastDuration: 4000,
  apiRetryAttempts: 3,
  apiRetryDelay: 1000,
  sessionTimeout: 15 * 60 * 1000, // 15 دقيقة
};

// ============================================
// LAYOUT SYSTEM — Dynamic Sidebar
// ============================================

async function renderLayout(userRole, activePage) {
  // أضف sidebar overlay للموبايل
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>'
  );

  // أنشئ sidebar
  const sidebarHTML = buildSidebar(userRole, activePage);
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // أضف top bar داخل main-content
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    const topBarHTML = `
      <div class="top-bar">
        <div style="display:flex;align-items:center;gap:1rem;">
          <button class="mobile-toggle" onclick="toggleSidebar()" id="mobile-menu-btn" aria-label="القائمة">☰</button>
          <div>
            <h1 class="page-title" id="page-title">${document.title.split(' - ')[0]}</h1>
            <p class="page-subtitle" id="page-subtitle"></p>
          </div>
        </div>
        <div class="top-actions">
          <button class="btn btn-ghost" onclick="toggleDarkMode()" title="الوضع الداكن" style="font-size:1.25rem;">🌙</button>
          <button class="btn btn-ghost" onclick="showNotifications()" aria-label="الإشعارات" style="font-size:1.25rem;position:relative;">
            🔔<span class="nav-badge" id="notif-count" style="display:none;position:absolute;top:-4px;left:-4px;">0</span>
          </button>
          <div class="user-mini" onclick="goToProfile()" style="background:var(--gray-100);border-radius:var(--radius-lg);padding:0.5rem 1rem;">
            <div class="avatar" id="user-avatar" style="background:linear-gradient(135deg,var(--primary),var(--secondary));">👤</div>
            <div class="info" id="user-info-top" style="display:none;">
              <div class="name" id="user-name" style="color:var(--gray-900);">مستخدم</div>
            </div>
          </div>
        </div>
      </div>
    `;
    mainContent.insertAdjacentHTML('afterbegin', topBarHTML);
  }

  loadUserInfo();
  setupSessionTimeout();
}

function buildSidebar(role, activePage) {
  const navItems = getNavItems(role, activePage);
  const user = JSON.parse(localStorage.getItem('exam_platform_user') || '{}');
  const initial = (user.full_name?.[0] || '👤').toUpperCase();

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">📚</div>
        <div>
          <div class="logo-text">منصة الاختبارات</div>
          <div class="logo-sub">نظام إدارة الاختبارات</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navItems}
      </nav>
      <div class="sidebar-footer">
        <div class="user-mini" onclick="goToProfile()">
          <div class="avatar" id="sidebar-avatar">${initial}</div>
          <div class="info">
            <div class="name" id="sidebar-name">${user.full_name || 'مستخدم'}</div>
            <div class="role" id="sidebar-role">${getRoleLabel(user.role)}</div>
          </div>
        </div>
        <a href="#" class="nav-item" onclick="handleLogout(event)" style="margin-top:0.75rem;color:#f87171;">
          <span>🚪</span>
          <span>تسجيل الخروج</span>
        </a>
      </div>
    </aside>
  `;
}

function getNavItems(role, activePage) {
  // ملاحظة: مسارات relative من مجلد الدور
  const items = {
    admin: [
      { section: 'الرئيسية', items: [
        { id: 'dashboard', icon: '📊', label: 'لوحة التحكم', href: 'dashboard.html' },
      ]},
      { section: 'الإدارة', items: [
        { id: 'users', icon: '👥', label: 'المستخدمين', href: 'users.html' },
        { id: 'classes', icon: '🏫', label: 'الفصول والمجموعات', href: 'classes.html' },
        { id: 'exams', icon: '📝', label: 'الاختبارات', href: 'exams.html' },
      ]},
      { section: 'التقارير', items: [
        { id: 'reports', icon: '📈', label: 'التقارير والإحصائيات', href: 'reports.html' },
      ]},
      { section: 'الإعدادات', items: [
        { id: 'settings', icon: '⚙️', label: 'إعدادات النظام', href: 'settings.html' },
      ]},
    ],
    teacher: [
      { section: 'الرئيسية', items: [
        { id: 'dashboard', icon: '📊', label: 'لوحة التحكم', href: 'dashboard.html' },
      ]},
      { section: 'الاختبارات', items: [
        { id: 'create-exam', icon: '➕', label: 'إنشاء اختبار', href: 'create-exam.html' },
        { id: 'questions', icon: '❓', label: 'بنك الأسئلة', href: 'questions.html' },
        { id: 'submissions', icon: '📋', label: 'التسليمات والتصحيح', href: 'submissions.html' },
      ]},
      { section: 'الطلاب', items: [
        { id: 'students', icon: '👨‍🎓', label: 'الطلاب', href: 'students.html' },
        { id: 'groups', icon: '👥', label: 'المجموعات', href: 'groups.html' },
      ]},
    ],
    student: [
      { section: 'الرئيسية', items: [
        { id: 'dashboard', icon: '📊', label: 'لوحة التحكم', href: 'dashboard.html' },
      ]},
      { section: 'الاختبارات', items: [
        { id: 'exams', icon: '📝', label: 'الاختبارات المتاحة', href: 'exams.html' },
        { id: 'results', icon: '📊', label: 'نتائجي', href: 'results.html' },
      ]},
      { section: 'حسابي', items: [
        { id: 'groups', icon: '👥', label: 'مجموعاتي', href: 'groups.html' },
        { id: 'profile', icon: '👤', label: 'ملفي الشخصي', href: 'profile.html' },
      ]},
    ]
  };

  const roleNav = items[role] || items.student;
  return roleNav.map(section => `
    <div class="nav-section">${section.section}</div>
    ${section.items.map(item => `
      <a href="${item.href}" class="nav-item ${item.id === activePage ? 'active' : ''}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('')}
  `).join('');
}

function getRoleLabel(role) {
  const labels = { admin: 'مدير النظام', teacher: 'معلم', student: 'طالب' };
  return labels[role] || 'مستخدم';
}

function loadUserInfo() {
  const user = JSON.parse(localStorage.getItem('exam_platform_user') || '{}');
  if (!user.full_name) return;

  const initial = user.full_name.charAt(0).toUpperCase();
  ['user-avatar', 'sidebar-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  const nameEl = document.getElementById('sidebar-name');
  if (nameEl) nameEl.textContent = user.full_name;
  const roleEl = document.getElementById('sidebar-role');
  if (roleEl) roleEl.textContent = getRoleLabel(user.role);
  const userNameTop = document.getElementById('user-name');
  if (userNameTop) {
    userNameTop.textContent = user.full_name;
    document.getElementById('user-info-top')?.style && (document.getElementById('user-info-top').style.display = 'flex');
  }
}

// ============================================
// MOBILE SIDEBAR
// ============================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  overlay?.classList.toggle('active');
  document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// DARK MODE
// ============================================
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark_mode', document.body.classList.contains('dark') ? '1' : '0');
}

// تطبيق Dark Mode محفوظ
if (localStorage.getItem('dark_mode') === '1') {
  document.body.classList.add('dark');
}

// ============================================
// AUTH GUARD
// ============================================
function requireAuth(requiredRole) {
  const user = JSON.parse(localStorage.getItem('exam_platform_user') || '{}');
  const session = localStorage.getItem('exam_platform_session');
  const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
  const now = Date.now();

  if (lastActivity && (now - lastActivity) > APP_CONFIG.sessionTimeout) {
    handleLogout(new Event('timeout'));
    return false;
  }
  localStorage.setItem('last_activity', now.toString());

  if (!session || !user.id) {
    window.location.href = '../login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return false;
  }

  if (requiredRole && user.role !== requiredRole) {
    window.location.href = '../unauthorized.html';
    return false;
  }
  return true;
}

function setupSessionTimeout() {
  ['click', 'keypress', 'scroll', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, () => localStorage.setItem('last_activity', Date.now().toString()), { passive: true });
  });

  setInterval(() => {
    const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
    if (lastActivity && (Date.now() - lastActivity) > APP_CONFIG.sessionTimeout) {
      handleLogout(new Event('timeout'));
    }
  }, 60000);
}

async function handleLogout(e) {
  if (e) e.preventDefault();
  try {
    if (typeof getSupabase === 'function') {
      const sb = getSupabase();
      if (sb) await sb.auth.signOut();
    }
  } catch (err) { console.error('Logout error:', err); }
  ['exam_platform_user', 'exam_platform_session', 'last_activity'].forEach(k => localStorage.removeItem(k));
  window.location.href = '../login.html';
}

function goToProfile() {
  const user = JSON.parse(localStorage.getItem('exam_platform_user') || '{}');
  if (!user.role) return;
  
  const currentPath = window.location.pathname;
  let target = 'profile.html';
  
  if (currentPath.includes('/admin/')) {
    target = 'profile.html';
  } else if (currentPath.includes('/teacher/')) {
    target = 'profile.html'; // هننشئها تحت
  } else if (currentPath.includes('/student/')) {
    target = 'profile.html';
  }
  
  window.location.href = target;
}

function showNotifications() {
  showToast('لا توجد إشعارات جديدة', 'info');
}

// ============================================
// TOAST SYSTEM
// ============================================
function showToast(message, type = 'info', duration = APP_CONFIG.toastDuration) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  const timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-120%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  toast.addEventListener('click', () => { clearTimeout(timeout); toast.remove(); });
}

// ============================================
// MODAL SYSTEM
// ============================================
function showModal(title, content, buttons = []) {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  const buttonsHTML = buttons.length ? `
    <div class="modal-footer">
      ${buttons.map(btn => `<button class="btn ${btn.class || 'btn-secondary'}" onclick="${btn.action}">${btn.text}</button>`).join('')}
    </div>` : '';

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay active" id="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="btn btn-sm btn-ghost" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">${content}</div>
        ${buttonsHTML}
      </div>
    </div>
  `);
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
  document.body.style.overflow = '';
}

function confirmDialog(message, onConfirm, onCancel) {
  showModal('تأكيد', `<p>${message}</p>`, [
    { text: 'إلغاء', class: 'btn-secondary', action: `closeModal()` },
    { text: 'تأكيد', class: 'btn-danger', action: `closeModal();(${onConfirm})();` }
  ]);
}

// ============================================
// LOADING STATES
// ============================================
function showLoading(element, text = 'جاري التحميل...') {
  if (!element) return;
  element.dataset.originalHtml = element.innerHTML;
  element.dataset.wasDisabled = element.disabled;
  element.innerHTML = `<span class="spinner spinner-sm"></span> ${text}`;
  element.disabled = true;
}

function hideLoading(element) {
  if (!element || !element.dataset.originalHtml) return;
  element.innerHTML = element.dataset.originalHtml;
  element.disabled = element.dataset.wasDisabled === 'true';
}

function showSkeleton(container, count = 3) {
  if (!container) return;
  container.innerHTML = Array(count).fill(0).map(() => `
    <div style="padding:1rem;margin-bottom:1rem;">
      <div class="skeleton" style="height:20px;width:60%;margin-bottom:0.75rem;"></div>
      <div class="skeleton" style="height:14px;width:40%;"></div>
    </div>
  `).join('');
}

// ============================================
// FORM VALIDATION
// ============================================
function validateForm(formElement) {
  let isValid = true;
  const errors = {};

  // Clear previous errors
  formElement.querySelectorAll('.error-msg').forEach(el => el.remove());
  formElement.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

  formElement.querySelectorAll('[data-validate]').forEach(field => {
    const rules = field.dataset.validate.split('|');
    const value = field.value.trim();
    const fieldName = field.name || field.id;

    for (const rule of rules) {
      if (rule === 'required' && !value) { errors[fieldName] = 'هذا الحقل مطلوب'; break; }
      if (rule === 'email' && value && !isValidEmail(value)) { errors[fieldName] = 'البريد الإلكتروني غير صالح'; break; }
      if (rule.startsWith('min:')) {
        const min = parseInt(rule.split(':')[1]);
        if (value.length < min) { errors[fieldName] = `يجب أن يكون ${min} أحرف على الأقل`; break; }
      }
      if (rule.startsWith('max:')) {
        const max = parseInt(rule.split(':')[1]);
        if (value.length > max) { errors[fieldName] = `يجب ألا يتجاوز ${max} حرف`; break; }
      }
      if (rule === 'number' && value && isNaN(value)) { errors[fieldName] = 'يجب إدخال رقم'; break; }
    }
  });

  for (const [field, msg] of Object.entries(errors)) {
    isValid = false;
    const input = formElement.querySelector(`[name="${field}"], #${field}`);
    if (input) {
      input.classList.add('error');
      const errorEl = document.createElement('div');
      errorEl.className = 'error-msg';
      errorEl.innerHTML = `<span>⚠️</span><span>${msg}</span>`;
      input.parentNode.appendChild(errorEl);
    }
  }
  return isValid;
}

function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function isValidPhone(phone) { return /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(phone); }

// ============================================
// DATE / TIME HELPERS
// ============================================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 دقيقة';
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h} ساعة ${m} دقيقة` : `${h} ساعة`;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
  return formatDate(dateStr);
}

function formatTimeRemaining(seconds) {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// NUMBER / GRADE HELPERS
// ============================================
function formatNumber(num) { return num?.toLocaleString('ar-EG') || '0'; }

function formatGrade(grade, total) {
  if (!total) return '0%';
  const pct = (grade / total) * 100;
  let color = 'var(--danger)';
  if (pct >= 90) color = 'var(--success)';
  else if (pct >= 70) color = 'var(--warning)';
  else if (pct >= 50) color = 'var(--info)';
  return `<span style="color:${color};font-weight:700;">${grade}/${total} (${pct.toFixed(1)}%)</span>`;
}

function getGradeColor(pct) {
  if (pct >= 90) return 'var(--success)';
  if (pct >= 70) return 'var(--warning)';
  if (pct >= 50) return 'var(--info)';
  return 'var(--danger)';
}

function getGradeBadge(pct) {
  if (pct >= 90) return 'badge-success';
  if (pct >= 70) return 'badge-warning';
  if (pct >= 50) return 'badge-info';
  return 'badge-danger';
}

// ============================================
// LOCAL STORAGE (with TTL expiry)
// ============================================
function saveToStorage(key, data, ttlMinutes = null) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), ttl: ttlMinutes ? ttlMinutes * 60000 : null }));
  } catch (e) { console.error('Storage error:', e); }
}

function getFromStorage(key, defaultValue = null) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const item = JSON.parse(stored);
    if (item.ttl && (Date.now() - item.timestamp) > item.ttl) { localStorage.removeItem(key); return defaultValue; }
    return item.data;
  } catch { return defaultValue; }
}

function removeFromStorage(key) { localStorage.removeItem(key); }

// ============================================
// DEBOUNCE / THROTTLE
// ============================================
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================
// API WRAPPER (with retry)
// ============================================
async function apiCall(url, options = {}, retries = APP_CONFIG.apiRetryAttempts) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, APP_CONFIG.apiRetryDelay));
      return apiCall(url, options, retries - 1);
    }
    throw err;
  }
}

// ============================================
// XSS SANITIZER
// ============================================
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// EXPORT (for Node/testing)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderLayout, requireAuth, showToast, showModal, closeModal,
    confirmDialog, validateForm, formatDate, formatDateTime,
    formatDuration, timeAgo, formatTimeRemaining, formatNumber, formatGrade,
    getGradeColor, getGradeBadge, saveToStorage, getFromStorage,
    debounce, throttle, apiCall, showLoading, hideLoading, showSkeleton,
    handleLogout, goToProfile, toggleSidebar, closeSidebar, sanitizeHTML
  };
}
