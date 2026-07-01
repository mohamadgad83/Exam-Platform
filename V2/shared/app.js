/**
 * ============================================
 * App Utilities Module - FIXED V2
 * Exam Platform - Merged V1+V2
 * ============================================
 */

const App = {
    // ============================================
    // Toast Notifications
    // ============================================
    Toast: {
        container: null,

        init() {
            if (!this.container) {
                this.container = document.getElementById('toastContainer');
                if (!this.container) {
                    this.container = document.createElement('div');
                    this.container.id = 'toastContainer';
                    this.container.className = 'toast-container';
                    document.body.appendChild(this.container);
                }
            }
        },

        show(message, type = 'info', duration = 4000) {
            this.init();
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
            toast.innerHTML = `
                <span class="toast-icon">${icons[type] || 'ℹ'}</span>
                <span class="toast-message">${message}</span>
            `;
            this.container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'toastSlide 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, duration);

            while (this.container.children.length > 5) {
                this.container.firstChild.remove();
            }
            return toast;
        },

        success(message, duration) { return this.show(message, 'success', duration); },
        error(message, duration) { return this.show(message, 'error', duration); },
        warning(message, duration) { return this.show(message, 'warning', duration); },
        info(message, duration) { return this.show(message, 'info', duration); }
    },

    // ============================================
    // Loading Overlay
    // ============================================
    Loading: {
        overlay: null,

        init() {
            if (!this.overlay) {
                this.overlay = document.createElement('div');
                this.overlay.className = 'loading-overlay';
                this.overlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    <div class="loading-text">جاري التحميل...</div>
                `;
                document.body.appendChild(this.overlay);
            }
        },

        show(text = 'جاري التحميل...') {
            this.init();
            this.overlay.querySelector('.loading-text').textContent = text;
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        },

        hide() {
            if (this.overlay) {
                this.overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    },

    // ============================================
    // Modal System
    // ============================================
    Modal: {
        open(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'flex';
                modal.offsetHeight;
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        },

        close(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }, 300);
            }
        },

        closeAll() {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            });
            document.body.style.overflow = '';
        }
    },

    // ============================================
    // Date & Time Formatter
    // ============================================
    DateTime: {
        format(dateString, options = {}) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '-';
            const defaultOptions = {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', ...options
            };
            return date.toLocaleDateString('ar-SA', defaultOptions);
        },

        dateOnly(dateString) {
            return this.format(dateString, { hour: undefined, minute: undefined });
        },

        timeOnly(dateString) {
            return this.format(dateString, { year: undefined, month: undefined, day: undefined });
        },

        relative(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return 'الآن';
            if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
            if (diffHour < 24) return `منذ ${diffHour} ساعة`;
            if (diffDay < 7) return `منذ ${diffDay} يوم`;
            return this.format(dateString);
        },

        duration(minutes) {
            if (minutes < 60) return `${minutes} دقيقة`;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (mins === 0) return `${hours} ساعة`;
            return `${hours} ساعة و ${mins} دقيقة`;
        },

        countdown(targetDate, onTick, onComplete) {
            const target = new Date(targetDate).getTime();
            const update = () => {
                const now = Date.now();
                const diff = target - now;
                if (diff <= 0) { onComplete?.(); return; }
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                onTick?.({ hours, minutes, seconds, totalMs: diff });
            };
            update();
            return setInterval(update, 1000);
        }
    },

    // ============================================
    // Form Validation
    // ============================================
    Validator: {
        email(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },

        password(password) {
            const checks = {
                minLength: password.length >= 8,
                hasUpper: /[A-Z]/.test(password),
                hasLower: /[a-z]/.test(password),
                hasNumber: /[0-9]/.test(password),
                hasSpecial: /[^A-Za-z0-9]/.test(password)
            };
            const score = Object.values(checks).filter(Boolean).length;
            return { valid: score >= 3, score, checks };
        },

        required(value) {
            return value !== null && value !== undefined && String(value).trim() !== '';
        },

        minLength(value, length) {
            return String(value).length >= length;
        }
    },

    // ============================================
    // Local Storage Helpers
    // ============================================
    Storage: {
        prefix: 'exam_',

        set(key, value) {
            try {
                localStorage.setItem(this.prefix + key, JSON.stringify(value));
                return true;
            } catch (e) { return false; }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(this.prefix + key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) { return defaultValue; }
        },

        remove(key) {
            localStorage.removeItem(this.prefix + key);
        },

        clear() {
            Object.keys(localStorage)
                .filter(k => k.startsWith(this.prefix))
                .forEach(k => localStorage.removeItem(k));
        }
    },

    // ============================================
    // Confirmation Dialog
    // ============================================
    async confirm(message, title = 'تأكيد') {
        return new Promise((resolve) => {
            const modalId = 'confirmModal_' + Date.now();
            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="modal-actions">
                        <button class="btn btn-primary" id="confirmBtn_${modalId}">تأكيد</button>
                        <button class="btn btn-secondary" id="cancelBtn_${modalId}">إلغاء</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            App.Modal.open(modalId);

            document.getElementById(`confirmBtn_${modalId}`).addEventListener('click', () => {
                App.Modal.close(modalId);
                setTimeout(() => modal.remove(), 400);
                resolve(true);
            });

            document.getElementById(`cancelBtn_${modalId}`).addEventListener('click', () => {
                App.Modal.close(modalId);
                setTimeout(() => modal.remove(), 400);
                resolve(false);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    App.Modal.close(modalId);
                    setTimeout(() => modal.remove(), 400);
                    resolve(false);
                }
            });
        });
    },

    // ============================================
    // Copy to Clipboard
    // ============================================
    async copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            App.Toast.success('تم النسخ إلى الحافظة');
            return true;
        } catch (err) {
            App.Toast.error('فشل النسخ');
            return false;
        }
    },

    // ============================================
    // Export to CSV
    // ============================================
    exportCSV(data, filename) {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(h => {
                const val = row[h] ?? '';
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename + '.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    },

    // ============================================
    // Export to Excel
    // ============================================
    exportExcel(data, filename, sheetName = 'Sheet1') {
        if (typeof XLSX === 'undefined') {
            App.Toast.error('مكتبة XLSX غير متوفرة');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename + '.xlsx');
    },

    // ============================================
    // Sanitize HTML (prevent XSS)
    // ============================================
    sanitizeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ============================================
    // Format Number
    // ============================================
    formatNumber(num) {
        return new Intl.NumberFormat('ar-SA').format(num);
    },

    // ============================================
    // Debounce
    // ============================================
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // ============================================
    // Throttle
    // ============================================
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // ============================================
    // Generate Random ID
    // ============================================
    generateId(length = 12) {
        return Math.random().toString(36).substring(2, 2 + length);
    }
};

// ============================================
// Global Helpers
// ============================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
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

function generateId(length = 12) {
    return Math.random().toString(36).substring(2, 2 + length);
}

function formatNumber(num) {
    return new Intl.NumberFormat('ar-SA').format(num);
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        App.Modal.closeAll();
    }
});

// ============================================
// Demo Mode Handler - FIXED: Small badge at bottom
// ============================================
const DemoMode = {
    isActive() {
        const user = getUser?.();
        return user && user.id && String(user.id).startsWith('demo-');
    },

    getUser() {
        return getUser?.();
    },

    getRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },

    getMockData(type) {
        const mocks = {
            admin: {
                stats: { users: 1240, students: 980, teachers: 45, exams: 156, attempts: 8934 },
                recentActivity: [
                    { user: 'أحمد محمد', action: 'أنشأ اختبار جديد', time: 'منذ 5 دقائق' },
                    { user: 'سارة علي', action: 'أكملت اختبار الرياضيات', time: 'منذ 12 دقيقة' }
                ]
            },
            teacher: {
                stats: { exams: 12, questions: 340, students: 85, avgScore: 78 },
                performance: [65, 72, 80, 85, 78, 90, 88]
            },
            student: {
                stats: { available: 5, completed: 12, average: 82, best: 96 },
                upcoming: [
                    { title: 'اختبار الفيزياء', subject: 'الفيزياء', date: '2025-07-01', duration: 60 },
                    { title: 'اختبار اللغة العربية', subject: 'العربية', date: '2025-07-03', duration: 90 }
                ],
                results: [
                    { exam: 'اختبار الرياضيات', score: 85, total: 100, date: '2025-06-20' },
                    { exam: 'اختبار الكيمياء', score: 92, total: 100, date: '2025-06-15' }
                ]
            }
        };
        return mocks[this.getRole()]?.[type] || null;
    },

    init() {
        if (!this.isActive()) return;

        // Add demo badge - FIXED: Small, positioned at bottom-left
        const badge = document.createElement('div');
        badge.className = 'demo-badge-fixed';
        badge.innerHTML = `⚡ وضع المعاينة — ${this.getRole() === 'admin' ? 'مدير' : this.getRole() === 'teacher' ? 'معلم' : 'طالب'}`;
        document.body.appendChild(badge);
    },

    exit() {
        App.Storage.clear();
        window.location.href = 'login.html';
    }
};

// Auto-init demo on dashboard pages
if (document.querySelector('.app-layout') || document.querySelector('.sidebar')) {
    DemoMode.init();
}

// ============================================
// V1 Compatibility: Map old functions to App
// ============================================
window.showToast = (message, type = 'success') => App.Toast.show(message, type);
window.showConfirm = (message, title) => App.confirm(message, title);
window.escapeHtml = (str) => App.sanitizeHtml(str);
window.formatDate = (date) => App.DateTime.dateOnly(date);
window.formatDateTime = (date) => App.DateTime.format(date);
window.showLoading = (text) => App.Loading.show(text);
window.hideLoading = () => App.Loading.hide();

console.log('✅ app.js loaded successfully');
