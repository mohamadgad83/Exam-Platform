// ============================================
// shared/app.js - بعد تحديث أسماء الجداول
// ============================================

import { supabase, examDB, auth } from './supabase-client.js';

// ============================================
// دوال مساعدة
// ============================================

// دالة تنقية HTML (للحماية من XSS)
export function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// Auth Guard
// ============================================

export async function requireAuth(requiredRole = null) {
  try {
    const isAuthenticated = await auth.isAuthenticated();
    if (!isAuthenticated) {
      sessionStorage.setItem('redirect_after_login', window.location.pathname);
      window.location.href = '/login.html';
      return false;
    }
    
    if (requiredRole) {
      const userRole = await auth.getRole();
      const roleHierarchy = { admin: 3, teacher: 2, student: 1 };
      if (!userRole || roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
        window.location.href = '/unauthorized.html';
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/login.html';
    return false;
  }
}

// ============================================
// إنشاء Sidebar
// ============================================

export function generateSidebar(role) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  const menuItems = {
    admin: [
      { icon: '📊', text: 'لوحة التحكم', link: '/admin/dashboard.html' },
      { icon: '👥', text: 'المستخدمين', link: '/admin/users.html' },
      { icon: '🏫', text: 'الفصول', link: '/admin/classes.html' },
      { icon: '📝', text: 'الاختبارات', link: '/admin/exams.html' },
      { icon: '📈', text: 'التقارير', link: '/admin/reports.html' },
      { icon: '⚙️', text: 'الإعدادات', link: '/admin/settings.html' },
    ],
    teacher: [
      { icon: '📊', text: 'لوحة التحكم', link: '/teacher/dashboard.html' },
      { icon: '📝', text: 'اختباراتي', link: '/teacher/exams.html' },
      { icon: '➕', text: 'إنشاء اختبار', link: '/teacher/create-exam.html' },
      { icon: '📋', text: 'التسليمات', link: '/teacher/submissions.html' },
      { icon: '👨‍🎓', text: 'الطلاب', link: '/teacher/students.html' },
      { icon: '❓', text: 'بنك الأسئلة', link: '/teacher/questions.html' },
      { icon: '👥', text: 'المجموعات', link: '/teacher/groups.html' },
      { icon: '👤', text: 'الملف الشخصي', link: '/teacher/profile.html' },
    ],
    student: [
      { icon: '📊', text: 'لوحة التحكم', link: '/student/dashboard.html' },
      { icon: '📝', text: 'الاختبارات', link: '/student/exams.html' },
      { icon: '📈', text: 'النتائج', link: '/student/results.html' },
      { icon: '👤', text: 'الملف الشخصي', link: '/student/profile.html' },
      { icon: '👥', text: 'المجموعات', link: '/student/groups.html' },
    ],
  };
  
  const items = menuItems[role] || menuItems.student;
  
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h2>📚 منصة الاختبارات</h2>
    </div>
    <nav class="sidebar-nav">
      ${items.map(item => `
        <a href="${item.link}" class="sidebar-link ${window.location.pathname.includes(item.link) ? 'active' : ''}">
          <span class="sidebar-icon">${item.icon}</span>
          <span>${item.text}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <button onclick="handleLogout()" class="sidebar-logout">
        🚪 تسجيل الخروج
      </button>
    </div>
  `;
}

// ============================================
// Toast Notifications
// ============================================

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${getToastIcon(type)}</div>
    <div class="toast-message">${sanitizeHTML(message)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function getToastIcon(type) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  return icons[type] || icons.info;
}

// ============================================
// تسجيل الخروج
// ============================================

window.handleLogout = async function() {
  try {
    await auth.logout();
    showToast('تم تسجيل الخروج بنجاح', 'success');
    window.location.href = '/login.html';
  } catch (error) {
    showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
  }
};

// ============================================
// تهيئة التطبيق
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const userRole = await auth.getRole();
  if (userRole) {
    generateSidebar(userRole);
  }
});
