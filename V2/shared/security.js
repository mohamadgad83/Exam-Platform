/**
 * ============================================
 * Exam Platform - Security System (K-12)
 * ============================================
 * 
 * Features:
 * - Full-screen lock with enforcement
 * - Tab/window switch detection
 * - Copy/paste/print block
 * - Right-click block
 * - DevTools detection
 * - Watermarking with student info
 * - Timer with auto-submit
 * - Webcam snapshot (optional)
 * - Activity logging
 */

class ExamSecurity {
  constructor(options = {}) {
    this.options = {
      enforceFullscreen: true,
      detectTabSwitch: true,
      blockCopyPaste: true,
      blockRightClick: true,
      blockDevTools: true,
      watermark: true,
      timer: true,
      webcam: false,
      maxTabSwitches: 3,
      ...options
    };

    this.tabSwitchCount = 0;
    this.isFullscreen = false;
    this.timerInterval = null;
    this.remainingSeconds = 0;
    this.examSubmitted = false;
    this.securityViolations = [];
    this.webcamStream = null;
    this.originalTitle = document.title;

    this.elements = {
      overlay: null,
      timer: null,
      alert: null,
      watermark: null
    };
  }

  /**
   * Initialize all security measures
   */
  init(examData = {}) {
    this.examData = examData;
    this.studentInfo = this.getStudentInfo();

    if (this.options.enforceFullscreen) this.setupFullscreen();
    if (this.options.detectTabSwitch) this.setupTabDetection();
    if (this.options.blockCopyPaste) this.setupCopyPasteBlock();
    if (this.options.blockRightClick) this.setupRightClickBlock();
    if (this.options.blockDevTools) this.setupDevToolsDetection();
    if (this.options.watermark) this.setupWatermark();
    if (this.options.timer) this.setupTimer(examData.duration);
    if (this.options.webcam) this.setupWebcam();

    this.setupKeyboardBlock();
    this.setupBeforeUnload();
    this.logActivity('EXAM_STARTED', { exam_id: examData.id });

    console.log('🔒 Exam Security initialized');
  }

  /**
   * Full-screen enforcement
   */
  setupFullscreen() {
    this.elements.overlay = document.createElement('div');
    this.elements.overlay.className = 'security-overlay';
    this.elements.overlay.innerHTML = `
      <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
      <h2>وضع الامتحان الآمن</h2>
      <p>يجب تشغيل وضع الشاشة الكاملة لبدء الامتحان</p>
      <button class="btn btn-primary btn-lg" onclick="examSecurity.enterFullscreen()">
        <span>🖥️</span> دخول وضع الشاشة الكاملة
      </button>
      <p style="margin-top: 1rem; font-size: 0.875rem; opacity: 0.6;">
        لا يمكنك الخروج من هذا الوضع حتى تسلم الامتحان
      </p>
    `;
    document.body.appendChild(this.elements.overlay);

    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
  }

  enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
  }

  handleFullscreenChange() {
    this.isFullscreen = !!(document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement || 
      document.msFullscreenElement);

    if (this.isFullscreen) {
      this.elements.overlay.style.display = 'none';
      this.showToast('✅ تم تفعيل وضع الامتحان الآمن', 'success');
    } else if (!this.examSubmitted) {
      this.elements.overlay.style.display = 'flex';
      this.recordViolation('FULLSCREEN_EXIT', 'الخروج من وضع الشاشة الكاملة');
      this.showToast('⚠️ الخروج من وضع الامتحان غير مسموح!', 'warning');
      setTimeout(() => this.enterFullscreen(), 500);
    }
  }

  /**
   * Tab/Window switch detection
   */
  setupTabDetection() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.examSubmitted) {
        this.tabSwitchCount++;
        this.recordViolation('TAB_SWITCH', `تبديل التبويب (${this.tabSwitchCount}/${this.options.maxTabSwitches})`);

        if (this.tabSwitchCount >= this.options.maxTabSwitches) {
          this.showSecurityAlert('🚫 تم إنهاء الامتحان بسبب تكرار الخروج من الصفحة');
          setTimeout(() => this.autoSubmit('TAB_SWITCH_LIMIT'), 3000);
        } else {
          this.showToast(`⚠️ تحذير: تبديل التبويب (${this.tabSwitchCount}/${this.options.maxTabSwitches})`, 'warning');
        }
      }
    });

    window.addEventListener('blur', () => {
      if (!this.examSubmitted) {
        document.title = '⚠️ عد للامتحان!';
      }
    });

    window.addEventListener('focus', () => {
      document.title = this.originalTitle;
    });
  }

  /**
   * Copy/Paste/Print block
   */
  setupCopyPasteBlock() {
    const blockEvent = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.recordViolation('COPY_PASTE', 'محاولة نسخ/لصق');
      this.showToast('❌ النسخ واللصق غير مسموح به', 'error');
      return false;
    };

    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', blockEvent);
    document.addEventListener('cut', blockEvent);

    // Block print
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        this.recordViolation('PRINT', 'محاولة طباعة');
        this.showToast('❌ الطباعة غير مسموح بها', 'error');
      }
    });

    // Block text selection on questions
    document.addEventListener('selectstart', (e) => {
      if (e.target.closest('.question-text')) {
        e.preventDefault();
      }
    });
  }

  /**
   * Right-click block
   */
  setupRightClickBlock() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.recordViolation('RIGHT_CLICK', 'نقرة يمين');
      this.showToast('❌ النقرة باليمين غير مسموح بها', 'error');
      return false;
    });
  }

  /**
   * DevTools detection
   */
  setupDevToolsDetection() {
    // Method 1: Console size detection
    const threshold = 160;
    const detectDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        this.recordViolation('DEVTOOLS', 'فتح أدوات المطور');
        this.showSecurityAlert('🚫 تم إنهاء الامتحان: فتح أدوات المطور');
        setTimeout(() => this.autoSubmit('DEVTOOLS_OPEN'), 2000);
      }
    };

    setInterval(detectDevTools, 1000);

    // Method 2: Debugger detection
    const checkDebugger = () => {
      const start = performance.now();
      debugger;
      const end = performance.now();
      if (end - start > 100) {
        this.recordViolation('DEBUGGER', 'تفعيل debugger');
        this.showSecurityAlert('🚫 تم إنهاء الامتحان');
        setTimeout(() => this.autoSubmit('DEBUGGER'), 2000);
      }
    };
    setInterval(checkDebugger, 2000);

    // Method 3: Block F12, Ctrl+Shift+I/J
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        this.recordViolation('DEVTOOLS_KEY', 'ضغط مفتاح DevTools');
        this.showToast('❌ هذا المفتاح غير مسموح به', 'error');
      }
    });
  }

  /**
   * Keyboard block for exam mode
   */
  setupKeyboardBlock() {
    document.addEventListener('keydown', (e) => {
      // Block Alt+Tab, Alt+F4, Windows key
      if (e.altKey && (e.key === 'Tab' || e.key === 'F4')) {
        e.preventDefault();
        this.recordViolation('SYSTEM_KEY', 'ضغط مفتاح نظام');
      }

      // Block Escape (unless in dialog)
      if (e.key === 'Escape' && !e.target.closest('.modal')) {
        e.preventDefault();
      }
    });
  }

  /**
   * Watermarking
   */
  setupWatermark() {
    if (!this.studentInfo) return;

    const text = `${this.studentInfo.name} | ${this.studentInfo.id} | ${new Date().toLocaleDateString('ar-EG')}`;

    // Create multiple watermarks
    for (let i = 0; i < 20; i++) {
      const wm = document.createElement('div');
      wm.className = 'watermark';
      wm.textContent = text;
      wm.style.top = `${(i * 10) + 5}%`;
      wm.style.left = `${(i % 2 === 0 ? 5 : 50)}%`;
      document.body.appendChild(wm);
    }
  }

  /**
   * Timer with auto-submit
   */
  setupTimer(durationMinutes) {
    this.remainingSeconds = durationMinutes * 60;

    this.elements.timer = document.createElement('div');
    this.elements.timer.className = 'exam-timer';
    document.body.appendChild(this.elements.timer);

    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      this.updateTimerDisplay();

      if (this.remainingSeconds <= 0) {
        this.autoSubmit('TIME_UP');
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.elements.timer.innerHTML = `
      <span>⏱️</span>
      <span>${timeStr}</span>
    `;

    if (this.remainingSeconds <= 60) {
      this.elements.timer.className = 'exam-timer danger';
    } else if (this.remainingSeconds <= 300) {
      this.elements.timer.className = 'exam-timer warning';
    }
  }

  getRemainingTime() {
    return this.remainingSeconds;
  }

  /**
   * Webcam snapshot (optional)
   */
  async setupWebcam() {
    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });

      // Take snapshot every 30 seconds
      setInterval(() => this.takeSnapshot(), 30000);

      // Also take snapshot on violations
      console.log('📷 Webcam initialized');
    } catch (err) {
      console.warn('Webcam access denied:', err);
      this.recordViolation('WEBCAM_DENIED', 'رفض الوصول للكاميرا');
    }
  }

  async takeSnapshot() {
    if (!this.webcamStream) return;

    try {
      const video = document.createElement('video');
      video.srcObject = this.webcamStream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 320, 240);

      // In production: upload to Supabase Storage
      // const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg'));
      // await Storage.uploadFile('proctoring', `snapshots/${this.examData.id}/${Date.now()}.jpg`, blob);

      console.log('📷 Snapshot taken');
    } catch (err) {
      console.error('Snapshot error:', err);
    }
  }

  /**
   * Before unload warning
   */
  setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
      if (!this.examSubmitted) {
        e.preventDefault();
        e.returnValue = 'هل أنت متأكد من مغادرة الامتحان؟ سيتم فقدان تقدمك.';
        return e.returnValue;
      }
    });
  }

  /**
   * Record security violation
   */
  recordViolation(type, details) {
    const violation = {
      type,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    this.securityViolations.push(violation);

    // Log to database
    this.logActivity('SECURITY_VIOLATION', violation);

    // Show to user
    console.warn('🚨 Security Violation:', violation);
  }

  /**
   * Auto-submit exam
   */
  autoSubmit(reason) {
    if (this.examSubmitted) return;
    this.examSubmitted = true;

    clearInterval(this.timerInterval);
    this.logActivity('EXAM_AUTO_SUBMITTED', { reason, violations: this.securityViolations });

    // Trigger submit event
    window.dispatchEvent(new CustomEvent('examAutoSubmit', {
      detail: { reason, violations: this.securityViolations, remainingTime: this.remainingSeconds }
    }));
  }

  /**
   * Submit exam manually
   */
  submit() {
    this.examSubmitted = true;
    clearInterval(this.timerInterval);
    this.logActivity('EXAM_SUBMITTED', { violations: this.securityViolations });

    // Exit fullscreen
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();

    // Stop webcam
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
    }

    // Remove overlays
    if (this.elements.overlay) this.elements.overlay.remove();
    if (this.elements.timer) this.elements.timer.remove();
    if (this.elements.alert) this.elements.alert.remove();
    document.querySelectorAll('.watermark').forEach(el => el.remove());
    document.querySelectorAll('.security-alert').forEach(el => el.remove());
  }

  /**
   * Show security alert
   */
  showSecurityAlert(message) {
    if (!this.elements.alert) {
      this.elements.alert = document.createElement('div');
      this.elements.alert.className = 'security-alert';
      document.body.appendChild(this.elements.alert);
    }

    this.elements.alert.innerHTML = `
      <span>🚨</span>
      <span>${message}</span>
    `;
    this.elements.alert.classList.add('show');

    setTimeout(() => {
      this.elements.alert.classList.remove('show');
    }, 5000);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
  }

  /**
   * Get student info from localStorage/session
   */
  getStudentInfo() {
    try {
      const user = JSON.parse(localStorage.getItem('exam_platform_user') || '{}');
      return {
        id: user.id || 'unknown',
        name: user.full_name || user.email || 'Unknown Student',
        email: user.email || ''
      };
    } catch {
      return { id: 'unknown', name: 'Unknown Student', email: '' };
    }
  }

  /**
   * Log activity
   */
  async logActivity(action, details) {
    try {
      const user = JSON.parse(localStorage.getItem('exam_platform_user') || '{}');
      if (typeof DB !== 'undefined' && DB.logActivity) {
        await DB.logActivity({
          user_id: user.id,
          action,
          details: JSON.stringify(details),
          ip: await this.getIP()
        });
      }
    } catch (err) {
      console.error('Activity log error:', err);
    }
  }

  async getIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get security report
   */
  getSecurityReport() {
    return {
      violations: this.securityViolations,
      tabSwitchCount: this.tabSwitchCount,
      remainingTime: this.remainingSeconds,
      examSubmitted: this.examSubmitted,
      startTime: this.examData?.startTime,
      endTime: new Date().toISOString()
    };
  }
}

// Global instance
let examSecurity = null;

function initExamSecurity(options) {
  examSecurity = new ExamSecurity(options);
  return examSecurity;
}

function getExamSecurity() {
  return examSecurity;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExamSecurity, initExamSecurity, getExamSecurity };
}
