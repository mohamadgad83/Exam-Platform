// ============================================
// utils.js - دوال مساعدة للمشروع
// منصة الاختبارات - Exam Platform
// ============================================

// ==================== دوال الإشعارات ====================

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || '✅'}</div>
        <div class="toast-message">${message}</div>
        <div class="toast-progress"></div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(message, onConfirm, onCancel = null) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
        <div class="confirm-content">
            <div class="confirm-icon">❓</div>
            <div class="confirm-message">${escapeHtml(message)}</div>
            <div class="confirm-buttons">
                <button class="confirm-btn confirm-yes">نعم</button>
                <button class="confirm-btn confirm-no">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.querySelector('.confirm-yes').onclick = () => { 
        modal.remove(); 
        if (onConfirm) onConfirm(); 
    };
    modal.querySelector('.confirm-no').onclick = () => { 
        modal.remove(); 
        if (onCancel) onCancel(); 
    };
}

// ==================== دوال التاريخ والوقت ====================

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-EG');
}

function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-EG');
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getTimeAgo(dateString) {
    if (!dateString) return 'منذ لحظات';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'منذ لحظات';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} يوم`;
    if (days < 30) return `منذ ${Math.floor(days / 7)} أسبوع`;
    return date.toLocaleDateString('ar');
}

// ==================== دوال النصوص والأمان ====================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getTypeText(type) {
    const types = {
        'mcq': 'اختيار من متعدد',
        'multi_select': 'اختيار متعدد (إجابات متعددة)',
        'true_false': 'صح/خطأ',
        'essay': 'مقالي'
    };
    return types[type] || type;
}

function getTypeClass(type) {
    const classes = {
        'mcq': 'badge-primary',
        'multi_select': 'badge-info',
        'true_false': 'badge-warning',
        'essay': 'badge-success'
    };
    return classes[type] || 'badge-gray';
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'قيد المراجعة',
        'pending_admin': 'قيد مراجعة الأدمن',
        'approved': 'معتمد',
        'rejected': 'مرفوض',
        'active': 'نشط',
        'suspended': 'موقوف',
        'draft': 'مسودة',
        'published': 'منشور',
        'closed': 'مغلق',
        'in_progress': 'قيد التنفيذ',
        'submitted': 'تم التسليم',
        'graded': 'تم التصحيح'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'pending': 'badge-warning',
        'pending_admin': 'badge-warning',
        'approved': 'badge-success',
        'rejected': 'badge-danger',
        'active': 'badge-success',
        'suspended': 'badge-danger',
        'draft': 'badge-warning',
        'published': 'badge-success',
        'closed': 'badge-danger',
        'in_progress': 'badge-info',
        'submitted': 'badge-info',
        'graded': 'badge-success'
    };
    return classMap[status] || 'badge-gray';
}

// ==================== دوال التحقق ====================

function isValidPhone(phone) {
    const phoneRegex = /^(010|011|012|015)[0-9]{8}$/;
    return phoneRegex.test(phone);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    return password && password.length >= 6;
}

// ==================== دوال التحميل ====================

function showLoading(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.display = 'block';
    }
}

function hideLoading(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.display = 'none';
    }
}

function createSkeleton(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="loading-skeleton" style="height: 100px; margin-bottom: 15px;"></div>`;
    }
    return html;
}

// ==================== دوال التصفح والتنقل ====================

function goToPage(url) {
    window.location.href = url;
}

function goBack() {
    window.history.back();
}

function reloadPage() {
    window.location.reload();
}

function openInNewTab(url) {
    window.open(url, '_blank');
}

console.log('✅ utils.js loaded successfully');
