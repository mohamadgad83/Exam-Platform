// fix-files.js
const fs = require('fs');
const path = require('path');

// قائمة الملفات المطلوب تعديلها
const filesToFix = [
    'admin-dashboard.html',
    'admin-users.html',
    'admin-classes.html',
    'admin-exams.html',
    'admin-groups.html',
    'admin-questions.html',
    'admin-reports.html',
    'teacher-dashboard.html',
    'teacher-exams.html',
    'teacher-questions.html',
    'teacher-groups.html',
    'teacher-students.html',
    'teacher-submissions.html',
    'teacher-create-exam.html',
    'student-dashboard.html',
    'student-exams.html',
    'student-exam-attempt.html',
    'student-results.html',
    'student-groups.html',
    'add-question.html',
    'create-exam.html',
    'exams.html',
    'questions-bank.html',
    'login.html',
    'register.html',
    'reset-password.html',
    'index.html'
];

// الدوال المطلوب حذفها
const duplicateFunctions = [
    'showToast',
    'escapeHtml',
    'formatDate',
    'formatDateTime',
    'showConfirm',
    'getTypeText',
    'getTypeClass'
];

// ==================== دوال المعالجة ====================

function addUtilsScript(content) {
    const supabaseScript = '<script src="js/supabase-config.js"></script>';
    const utilsScript = '<script src="js/utils.js"></script>';
    
    if (content.includes(supabaseScript)) {
        if (!content.includes(utilsScript)) {
            content = content.replace(supabaseScript, supabaseScript + '\n    ' + utilsScript);
        }
    } else {
        const bodyClose = '</body>';
        if (content.includes(bodyClose)) {
            content = content.replace(bodyClose, 
                `    <script src="js/supabase-config.js"></script>\n    <script src="js/utils.js"></script>\n${bodyClose}`
            );
        }
    }
    return content;
}

function removeDuplicateFunctions(content) {
    for (const func of duplicateFunctions) {
        // حذف function funcName( ... ) { ... }
        const regex1 = new RegExp(`(async\\s+)?function\\s+${func}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`, 'g');
        content = content.replace(regex1, '');
        
        // حذف const funcName = function( ... ) { ... }
        const regex2 = new RegExp(`(const|let|var)\\s+${func}\\s*=\\s*(async\\s+)?function\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`, 'g');
        content = content.replace(regex2, '');
        
        // حذف const funcName = ( ... ) => { ... }
        const regex3 = new RegExp(`(const|let|var)\\s+${func}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{[^}]*\\}`, 'g');
        content = content.replace(regex3, '');
    }
    // تنظيف الأسطر الفارغة المتكررة
    content = content.replace(/^\s*[\r\n]/gm, '');
    return content;
}

function replaceAlerts(content) {
    content = content.replace(/alert\(['"]([^'"]*)['"]\)/g, (match, message) => {
        let type = 'success';
        if (message.includes('خطأ') || message.includes('error') || message.includes('فشل')) {
            type = 'error';
        } else if (message.includes('تحذير') || message.includes('warning')) {
            type = 'warning';
        } else if (message.includes('معلومات') || message.includes('info')) {
            type = 'info';
        }
        return `showToast('${message}', '${type}')`;
    });
    return content;
}

function replaceConfirms(content) {
    content = content.replace(/if\s*\(\s*confirm\(['"]([^'"]*)['"]\)\s*\)\s*\{/g, 
        (match, message) => {
            return `showConfirm('${message}', () => {`;
        }
    );
    return content;
}

function processFile(filePath) {
    try {
        console.log(`📝 جاري معالجة: ${filePath}`);
        
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // 1. إضافة utils.js
        const newContentWithUtils = addUtilsScript(content);
        if (newContentWithUtils !== content) {
            content = newContentWithUtils;
            modified = true;
            console.log(`  ✅ تم إضافة utils.js`);
        }
        
        // 2. حذف الدوال المكررة
        const newContentWithoutDuplicates = removeDuplicateFunctions(content);
        if (newContentWithoutDuplicates !== content) {
            content = newContentWithoutDuplicates;
            modified = true;
            console.log(`  ✅ تم حذف الدوال المكررة`);
        }
        
        // 3. استبدال alert
        const newContentWithAlerts = replaceAlerts(content);
        if (newContentWithAlerts !== content) {
            content = newContentWithAlerts;
            modified = true;
            console.log(`  ✅ تم استبدال alert()`);
        }
        
        // 4. استبدال confirm
        const newContentWithConfirms = replaceConfirms(content);
        if (newContentWithConfirms !== content) {
            content = newContentWithConfirms;
            modified = true;
            console.log(`  ✅ تم استبدال confirm()`);
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`  💾 تم حفظ التغييرات في: ${filePath}`);
            return true;
        } else {
            console.log(`  ℹ️ لا توجد تغييرات على: ${filePath}`);
            return false;
        }
        
    } catch (error) {
        console.error(`  ❌ خطأ في معالجة ${filePath}:`, error.message);
        return false;
    }
}

function createUtilsFile() {
    const utilsContent = `// ============================================
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
    toast.className = \`toast-notification toast-\${type}\`;
    toast.innerHTML = \`
        <div class="toast-icon">\${icons[type] || '✅'}</div>
        <div class="toast-message">\${message}</div>
        <div class="toast-progress"></div>
    \`;
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
    modal.innerHTML = \`
        <div class="confirm-content">
            <div class="confirm-icon">❓</div>
            <div class="confirm-message">\${escapeHtml(message)}</div>
            <div class="confirm-buttons">
                <button class="confirm-btn confirm-yes">نعم</button>
                <button class="confirm-btn confirm-no">إلغاء</button>
            </div>
        </div>
    \`;
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
    return \`\${minutes.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`;
}

function getTimeAgo(dateString) {
    if (!dateString) return 'منذ لحظات';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'منذ لحظات';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return \`منذ \${minutes} دقيقة\`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return \`منذ \${hours} ساعة\`;
    const days = Math.floor(hours / 24);
    if (days < 7) return \`منذ \${days} يوم\`;
    if (days < 30) return \`منذ \${Math.floor(days / 7)} أسبوع\`;
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
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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
        html += \`<div class="loading-skeleton" style="height: 100px; margin-bottom: 15px;"></div>\`;
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
`;

    try {
        // التأكد من وجود مجلد js
        if (!fs.existsSync('js')) {
            fs.mkdirSync('js');
        }
        fs.writeFileSync('js/utils.js', utilsContent, 'utf8');
        console.log('✅ تم إنشاء ملف js/utils.js');
        return true;
    } catch (error) {
        console.error('❌ خطأ في إنشاء utils.js:', error.message);
        return false;
    }
}

// ==================== الوظيفة الرئيسية ====================
function main() {
    console.log('🚀 بدء عملية تعديل الملفات...\n');
    
    // 1. إنشاء ملف utils.js
    console.log('📁 الخطوة 1: إنشاء ملف utils.js');
    const utilsCreated = createUtilsFile();
    if (!utilsCreated) {
        console.log('❌ فشل في إنشاء utils.js، توقف العملية');
        return;
    }
    console.log('');
    
    // 2. معالجة كل ملف
    console.log('📁 الخطوة 2: معالجة ملفات HTML');
    let successCount = 0;
    let failCount = 0;
    
    for (const file of filesToFix) {
        if (fs.existsSync(file)) {
            const success = processFile(file);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        } else {
            console.log(`  ⚠️ الملف غير موجود: ${file}`);
            failCount++;
        }
    }
    
    // 3. التقرير النهائي
    console.log('\n' + '='.repeat(50));
    console.log('📊 تقرير العملية:');
    console.log(`  ✅ تم تعديل: ${successCount} ملف`);
    console.log(`  ❌ فشل/غير موجود: ${failCount} ملف`);
    console.log('='.repeat(50));
    
    if (successCount > 0) {
        console.log('\n🎉 تم الانتهاء بنجاح!');
        console.log('💡 تذكر:');
        console.log('  1. تأكد من وجود ملف js/utils.js');
        console.log('  2. اختبر الموقع للتأكد من عمله بشكل صحيح');
        console.log('  3. إذا واجهت مشكلة، ارجع للنسخة الاحتياطية');
    }
}

// تشغيل السكريبت
main();