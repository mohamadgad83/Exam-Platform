/**
 * ============================================
 * App Utilities Module
 * Exam Platform V2
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
            
            const icons = {
                success: '✓',
                error: '✗',
                warning: '⚠',
                info: 'ℹ'
            };
            
            toast.innerHTML = `
                <span style="font-size:1.2rem">${icons[type] || 'ℹ'}</span>
                <span>${message}</span>
            `;
            
            this.container.appendChild(toast);
            
            // Auto remove
            setTimeout(() => {
                toast.style.animation = 'toastSlide 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, duration);
            
            // Limit to 5 toasts
            while (this.container.children.length > 5) {
                this.container.firstChild.remove();
            }
            
            return toast;
        },

        success(message, duration) {
            return this.show(message, 'success', duration);
        },

        error(message, duration) {
            return this.show(message, 'error', duration);
        },

        warning(message, duration) {
            return this.show(message, 'warning', duration);
        },

        info(message, duration) {
            return this.show(message, 'info', duration);
        }
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
                // Force reflow
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
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
            document.body.style.overflow = '';
        }
    },

    // ============================================
    // Date & Time Formatter
    // ============================================
    DateTime: {
        /**
         * Format date to Arabic locale
         */
        format(dateString, options = {}) {
            if (!dateString) return '-';
            
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '-';
            
            const defaultOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                ...options
            };
            
            return date.toLocaleDateString('ar-SA', defaultOptions);
        },

        /**
         * Format date only
         */
        dateOnly(dateString) {
            return this.format(dateString, { hour: undefined, minute: undefined });
        },

        /**
         * Format time only
         */
        timeOnly(dateString) {
            return this.format(dateString, { year: undefined, month: undefined, day: undefined });
        },

        /**
         * Relative time (e.g., "منذ 5 دقائق")
         */
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

        /**
         * Format duration in minutes to readable string
         */
        duration(minutes) {
            if (minutes < 60) return `${minutes} دقيقة`;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (mins === 0) return `${hours} ساعة`;
            return `${hours} ساعة و ${mins} دقيقة`;
        },

        /**
         * Countdown timer
         */
        countdown(targetDate, onTick, onComplete) {
            const target = new Date(targetDate).getTime();
            
            const update = () => {
                const now = Date.now();
                const diff = target - now;
                
                if (diff <= 0) {
                    onComplete?.();
                    return;
                }
                
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
            } catch (e) {
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(this.prefix + key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
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
                <div class="modal">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" onclick="App.Modal.close('${modalId}')">×</button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="App.Modal.close('${modalId}')">إلغاء</button>
                        <button class="btn btn-danger" id="confirmBtn_${modalId}">تأكيد</button>
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
    }
};

// ============================================
// Global Helpers
// ============================================

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
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

/**
 * Generate random ID
 */
function generateId(length = 12) {
    return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Format number with Arabic numerals
 */
function formatNumber(num) {
    return new Intl.NumberFormat('ar-SA').format(num);
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        App.Modal.closeAll();
    }
    // ============================================
// Demo Mode Handler
// ============================================
const DemoMode = {
  isActive() {
    return App.Storage.get('demo_user') !== null;
  },

  getUser() {
    return App.Storage.get('demo_user');
  },

  getRole() {
    return App.Storage.get('demo_role');
  },

  // Mock data for demo
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
    
    // Override auth functions for demo
    window.examAuth = {
      ...window.examAuth,
      getUser: async () => this.getUser(),
      isAdmin: async () => this.getRole() === 'admin',
      isTeacher: async () => this.getRole() === 'teacher',
      getSession: async () => ({ data: { session: { user: this.getUser() } }, error: null })
    };

    // Show demo badge
    const badge = document.createElement('div');
    badge.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 9999;
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        color: #78350f;
        padding: 8px 16px;
        border-radius: 50px;
        font-weight: 800;
        font-size: 0.875rem;
        box-shadow: 0 10px 15px rgba(245, 158, 11, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: pulse 2s infinite;
      ">
        <span>⚡</span>
        <span>وضع المعاينة — ${this.getRole() === 'admin' ? 'مدير' : this.getRole() === 'teacher' ? 'معلم' : 'طالب'}</span>
        <button onclick="DemoMode.exit()" style="
          background: rgba(255,255,255,0.3);
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          margin-right: 8px;
          font-weight: 700;
        ">×</button>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      </style>
    `;
    document.body.appendChild(badge);
  },

  exit() {
    App.Storage.clear();
    window.location.href = '../login.html';
  }
};

// Auto-init demo on dashboard pages
if (document.querySelector('.app-layout') || document.querySelector('.sidebar')) {
  DemoMode.init();
}
});