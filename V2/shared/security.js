/**
 * ============================================
 * Exam Security Module
 * Anti-Cheating System
 * Exam Platform V2
 * ============================================
 */

const ExamSecurity = {
    config: {
        maxViolations: 3,
        onViolation: null,
        onMaxViolations: null,
        onLog: null,
        enabled: true
    },
    
    state: {
        violations: 0,
        isActive: false,
        listeners: [],
        lastFocus: true,
        blurCount: 0,
        copyAttempts: 0,
        resizeCount: 0,
        devToolsOpen: false,
        lastWidth: window.outerWidth,
        lastHeight: window.outerHeight
    },

    /**
     * Initialize security monitoring
     */
    init(options = {}) {
        this.config = { ...this.config, ...options };
        if (!this.config.enabled) return;
        
        this.state.isActive = true;
        this.state.violations = 0;
        this.state.blurCount = 0;
        this.state.copyAttempts = 0;
        
        this._bindEvents();
        
        // Enter exam mode
        document.body.classList.add('exam-mode');
        
        // Prevent context menu
        this._addListener('contextmenu', document, (e) => {
            e.preventDefault();
            this._logViolation('right_click', 'تم محاولة فتح قائمة السياق');
            return false;
        });
        
        // Prevent text selection
        this._addListener('selectstart', document, (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                return false;
            }
        });
        
        // Prevent drag
        this._addListener('dragstart', document, (e) => {
            e.preventDefault();
            return false;
        });
        
        // Monitor focus/blur
        this._addListener('blur', window, () => {
            if (!this.state.isActive) return;
            this.state.blurCount++;
            this._logViolation('tab_switch', `تم مغادرة نافذة الاختبار (${this.state.blurCount})`);
        });
        
        // Prevent keyboard shortcuts
        this._addListener('keydown', document, (e) => {
            // Prevent F12
            if (e.key === 'F12') {
                e.preventDefault();
                this._logViolation('devtools', 'تم محاولة فتح أدوات المطور (F12)');
                return false;
            }
            
            // Prevent Ctrl+Shift+I/J/C/U
            if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'U'].includes(e.key)) {
                e.preventDefault();
                this._logViolation('devtools', 'تم محاولة فتح أدوات المطور');
                return false;
            }
            
            // Prevent Ctrl+U (view source)
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                this._logViolation('view_source', 'تم محاولة عرض مصدر الصفحة');
                return false;
            }
            
            // Prevent Ctrl+P (print)
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this._logViolation('print', 'تم محاولة الطباعة');
                return false;
            }
            
            // Prevent Ctrl+S (save)
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this._logViolation('save', 'تم محاولة حفظ الصفحة');
                return false;
            }
            
            // Prevent Ctrl+C / Ctrl+X / Ctrl+V outside inputs
            if ((e.ctrlKey && ['c', 'x', 'v'].includes(e.key.toLowerCase()))) {
                const active = document.activeElement;
                if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.state.copyAttempts++;
                    this._logViolation('copy_paste', `تم محاولة نسخ (${this.state.copyAttempts})`);
                    return false;
                }
            }
            
            // Prevent Print Screen
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                this._logViolation('screenshot', 'تم ضغط زر Print Screen');
                return false;
            }
        });
        
        // Prevent copy/cut/paste events
        this._addListener('copy', document, (e) => {
            const active = document.activeElement;
            if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this._logViolation('copy', 'محاولة نسخ');
                return false;
            }
        });
        
        this._addListener('cut', document, (e) => {
            e.preventDefault();
            return false;
        });
        
        // Monitor window resize (possible devtools)
        this._addListener('resize', window, () => {
            const widthDiff = Math.abs(window.outerWidth - this.state.lastWidth);
            const heightDiff = Math.abs(window.outerHeight - this.state.lastHeight);
            
            if (widthDiff > 100 || heightDiff > 100) {
                this.state.resizeCount++;
                this._logViolation('resize', `تغيير حجم النافذة (${this.state.resizeCount})`);
            }
            
            this.state.lastWidth = window.outerWidth;
            this.state.lastHeight = window.outerHeight;
        });
        
        // Monitor mouse leaving window
        this._addListener('mouseout', document, (e) => {
            if (e.relatedTarget === null) {
                this._logViolation('mouse_leave', 'مؤشر الماوس غادر النافذة');
            }
        });
        
        // Detect devtools via console
        this._detectDevTools();
        
        // Periodic check
        this._intervalId = setInterval(() => {
            this._detectDevTools();
            this._checkFullscreen();
        }, 1000);
        
        // Enter fullscreen
        this._requestFullscreen();
        
        console.log('[ExamSecurity] Initialized');
    },

    /**
     * Disable security monitoring
     */
    disable() {
        this.state.isActive = false;
        this.state.listeners.forEach(({ el, event, handler }) => {
            el.removeEventListener(event, handler);
        });
        this.state.listeners = [];
        
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }
        
        document.body.classList.remove('exam-mode');
        console.log('[ExamSecurity] Disabled');
    },

    /**
     * Get current violation count
     */
    getViolationCount() {
        return this.state.violations;
    },

    /**
     * Reset violations
     */
    reset() {
        this.state.violations = 0;
        this.state.blurCount = 0;
        this.state.copyAttempts = 0;
    },

    // ============================================
    // Private Methods
    // ============================================

    _addListener(element, event, handler) {
        const el = typeof element === 'string' ? document : element;
        el.addEventListener(event, handler, true);
        this.state.listeners.push({ el, event, handler });
    },

    _logViolation(type, message) {
        if (!this.state.isActive) return;
        
        this.state.violations++;
        
        const entry = {
            type,
            message,
            count: this.state.violations,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        // Call log callback
        if (this.config.onLog) {
            this.config.onLog(entry);
        }
        
        // Call violation callback
        if (this.config.onViolation) {
            this.config.onViolation(this.state.violations, message);
        }
        
        // Check max violations
        if (this.state.violations >= this.config.maxViolations) {
            this._triggerMaxViolations();
        }
        
        // Send to server
        this._sendToServer(entry);
    },

    _triggerMaxViolations() {
        this.disable();
        
        if (this.config.onMaxViolations) {
            this.config.onMaxViolations(this.state.violations);
        }
        
        // Auto submit
        if (typeof autoSubmit === 'function') {
            autoSubmit('security_violation');
        }
    },

    async _sendToServer(entry) {
        try {
            const user = await examAuth.getUser();
            await fetch('../supabase/functions/security-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id,
                    type: entry.type,
                    message: entry.message,
                    data: { count: entry.count },
                    url: entry.url,
                    user_agent: navigator.userAgent
                })
            });
        } catch (e) {
            console.error('[ExamSecurity] Failed to log:', e);
        }
    },

    _detectDevTools() {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        if (widthThreshold || heightThreshold) {
            if (!this.state.devToolsOpen) {
                this.state.devToolsOpen = true;
                this._logViolation('devtools_open', 'تم اكتشاف فتح أدوات المطور');
            }
        } else {
            this.state.devToolsOpen = false;
        }
    },

    _checkFullscreen() {
        if (!document.fullscreenElement && this.state.isActive) {
            // Optional: warn about not being in fullscreen
            // this._logViolation('fullscreen_exit', 'تم الخروج من وضع ملء الشاشة');
        }
    },

    _requestFullscreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        }
    },

    _bindEvents() {
        // Prevent beforeunload spam
        this._addListener(window, 'beforeunload', (e) => {
            if (this.state.isActive) {
                e.preventDefault();
                e.returnValue = 'هل أنت متأكد من مغادرة الاختبار؟';
            }
        });
    }
};

// ============================================
// Visibility API (additional protection)
// ============================================

document.addEventListener('visibilitychange', () => {
    if (document.hidden && ExamSecurity.state.isActive) {
        ExamSecurity._logViolation('visibility_hidden', 'تم إخفاء الصفحة');
    }
});

// Prevent console clearing
const originalClear = console.clear;
console.clear = function() {
    if (ExamSecurity.state.isActive) {
        ExamSecurity._logViolation('console_clear', 'تم محاولة مسح الكونسول');
    }
    originalClear.apply(console, arguments);
};