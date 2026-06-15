/**
 * notifications.js - نظام الإشعارات الفورية
 * يستخدم Supabase Realtime Subscriptions
 * يعتمد على supabase-config.js ولا يعيد كتابة الدوال الموجودة
 */

// ============================================
// المتغيرات العامة
// ============================================
let notificationSubscription = null;
let currentNotificationsUser = null;
let unreadCount = 0;
let refreshInterval = null;

// ============================================
// تهيئة نظام الإشعارات (الدالة الرئيسية)
// ============================================
async function initNotificationSystem(user) {
    if (!user || !user.id) {
        console.warn('⚠️ لا يمكن تهيئة الإشعارات: المستخدم غير موجود');
        return;
    }
    
    currentNotificationsUser = user;
    console.log('🔔 تهيئة نظام الإشعارات للمستخدم:', user.email || user.phone);
    
    // 1. إنشاء واجهة الإشعارات في الصفحة
    createNotificationUI();
    
    // 2. تحميل الإشعارات السابقة
    await loadUserNotifications();
    
    // 3. الاشتراك في التحديثات الفورية (Realtime)
    subscribeToRealtimeNotifications();
    
    // 4. تحديث دوري كإجراء احتياطي (كل 30 ثانية)
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        checkNewNotifications();
    }, 30000);
}

// ============================================
// إنشاء واجهة الإشعارات في الصفحة
// ============================================
function createNotificationUI() {
    // تجنب التكرار
    if (document.getElementById('examNotificationBell')) return;
    
    // البحث عن شريط التنقل لإضافة الإشعارات فيه
    const navbar = document.querySelector('nav') || 
                   document.querySelector('.navbar') || 
                   document.querySelector('header') ||
                   document.querySelector('.top-bar');
    
    const notificationHTML = `
        <div class="notification-wrapper" id="examNotificationWrapper">
            <div class="notification-bell" id="examNotificationBell">
                <span class="bell-icon">🔔</span>
                <span class="notification-count" id="examNotificationCount" style="display: none;">0</span>
            </div>
            <div class="notification-panel" id="examNotificationPanel" style="display: none;">
                <div class="notification-panel-header">
                    <h3>📢 الإشعارات</h3>
                    <button class="mark-all-read-btn" id="markAllReadBtn">تحديد الكل كمقروء</button>
                </div>
                <div class="notification-list" id="examNotificationList">
                    <div class="notification-empty-msg">لا توجد إشعارات</div>
                </div>
            </div>
        </div>
    `;
    
    // إضافة CSS للإشعارات
    addNotificationStyles();
    
    // إضافة العنصر إلى شريط التنقل
    if (navbar) {
        navbar.insertAdjacentHTML('beforeend', notificationHTML);
    } else {
        // إذا لم يوجد شريط تنقل، نضيفه في أعلى الصفحة
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.zIndex = '9999';
        container.innerHTML = notificationHTML;
        document.body.appendChild(container);
    }
    
    // إضافة مستمعي الأحداث
    setupNotificationEvents();
}

// ============================================
// إضافة CSS الخاص بالإشعارات
// ============================================
function addNotificationStyles() {
    if (document.getElementById('notificationCustomStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'notificationCustomStyles';
    style.textContent = `
        /* حاوية الإشعارات */
        .notification-wrapper {
            position: relative;
            display: inline-block;
            margin: 0 10px;
        }
        
        /* زر الجرس */
        .notification-bell {
            position: relative;
            cursor: pointer;
            padding: 8px 12px;
            transition: all 0.3s ease;
            border-radius: 50%;
        }
        
        .notification-bell:hover {
            background: rgba(102, 126, 234, 0.1);
        }
        
        .bell-icon {
            font-size: 22px;
        }
        
        /* عداد الإشعارات */
        .notification-count {
            position: absolute;
            top: 0;
            right: 0;
            background: #ef4444;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: bold;
            min-width: 18px;
            text-align: center;
        }
        
        /* لوحة الإشعارات */
        .notification-panel {
            position: absolute;
            top: 45px;
            left: auto;
            right: 0;
            width: 350px;
            max-height: 450px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            z-index: 10000;
            overflow: hidden;
            direction: rtl;
        }
        
        .notification-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: #f7f9fc;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .notification-panel-header h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
        }
        
        .mark-all-read-btn {
            background: none;
            border: none;
            color: #667eea;
            font-size: 12px;
            cursor: pointer;
            padding: 5px 10px;
            border-radius: 6px;
            transition: background 0.3s;
        }
        
        .mark-all-read-btn:hover {
            background: #eef2ff;
        }
        
        /* قائمة الإشعارات */
        .notification-list {
            max-height: 380px;
            overflow-y: auto;
        }
        
        .notification-item {
            padding: 12px 15px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background 0.3s;
            position: relative;
        }
        
        .notification-item:hover {
            background: #fafafc;
        }
        
        .notification-item.unread {
            background: #eef2ff;
        }
        
        .notification-item.unread::before {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: #667eea;
        }
        
        .notification-title {
            font-weight: 600;
            font-size: 14px;
            color: #333;
            margin-bottom: 5px;
        }
        
        .notification-message {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
            line-height: 1.4;
        }
        
        .notification-time {
            font-size: 11px;
            color: #999;
        }
        
        .notification-empty-msg {
            text-align: center;
            padding: 40px 20px;
            color: #999;
            font-size: 13px;
        }
        
        /* Toast إشعار منبثق */
        .realtime-toast {
            position: fixed;
            top: 80px;
            right: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 12px 20px;
            min-width: 280px;
            max-width: 350px;
            z-index: 10001;
            animation: slideInRight 0.3s ease;
            border-right: 4px solid #667eea;
            direction: rtl;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .realtime-toast.success {
            border-right-color: #10b981;
        }
        
        .realtime-toast.error {
            border-right-color: #ef4444;
        }
        
        .realtime-toast.warning {
            border-right-color: #f59e0b;
        }
        
        .toast-title {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .toast-message {
            font-size: 12px;
            color: #666;
        }
        
        .toast-close-btn {
            position: absolute;
            top: 8px;
            left: 12px;
            cursor: pointer;
            color: #999;
            font-size: 16px;
        }
        
        @media (max-width: 576px) {
            .notification-panel {
                width: 300px;
                left: -200px;
                right: auto;
            }
            
            .realtime-toast {
                right: 10px;
                left: 10px;
                width: auto;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// ============================================
// إعداد مستمعي الأحداث
// ============================================
function setupNotificationEvents() {
    const bell = document.getElementById('examNotificationBell');
    const panel = document.getElementById('examNotificationPanel');
    const markAllBtn = document.getElementById('markAllReadBtn');
    
    if (bell) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panel) {
                const isVisible = panel.style.display === 'block';
                panel.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    loadUserNotifications(); // تحديث عند الفتح
                }
            }
        });
    }
    
    // إغلاق اللوحة عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (panel && bell && !bell.contains(e.target) && !panel.contains(e.target)) {
            panel.style.display = 'none';
        }
    });
    
    if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllAsRead);
    }
}

// ============================================
// تحميل الإشعارات من قاعدة البيانات
// ============================================
async function loadUserNotifications() {
    if (!currentNotificationsUser || !window.supabase) return;
    
    try {
        const { data, error } = await window.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', currentNotificationsUser.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        // حساب الإشعارات غير المقروءة
        const unread = data.filter(n => !n.is_read).length;
        unreadCount = unread;
        updateNotificationBadge();
        
        // عرض القائمة
        displayNotificationsList(data || []);
        
    } catch (error) {
        console.error('❌ خطأ في تحميل الإشعارات:', error);
        displayNotificationsList([]);
    }
}

// ============================================
// عرض الإشعارات في القائمة
// ============================================
function displayNotificationsList(notifications) {
    const listContainer = document.getElementById('examNotificationList');
    if (!listContainer) return;
    
    if (!notifications || notifications.length === 0) {
        listContainer.innerHTML = '<div class="notification-empty-msg">📭 لا توجد إشعارات</div>';
        return;
    }
    
    listContainer.innerHTML = notifications.map(notif => `
        <div class="notification-item ${!notif.is_read ? 'unread' : ''}" 
             data-id="${notif.id}"
             onclick="markNotificationAsRead('${notif.id}')">
            <div class="notification-title">${escapeHtml(notif.title || 'إشعار')}</div>
            <div class="notification-message">${escapeHtml(notif.message || '')}</div>
            <div class="notification-time">${getTimeAgo(notif.created_at)}</div>
        </div>
    `).join('');
}

// ============================================
// الاشتراك في التحديثات الفورية (Realtime)
// ============================================
function subscribeToRealtimeNotifications() {
    if (!currentNotificationsUser || !window.supabase) {
        console.warn('⚠️ لا يمكن الاشتراك في Realtime');
        return;
    }
    
    // إلغاء الاشتراك السابق
    if (notificationSubscription) {
        notificationSubscription.unsubscribe();
    }
    
    // الاشتراك في جدول الإشعارات
    notificationSubscription = window.supabase
        .channel('exam-notifications-channel')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentNotificationsUser.id}`
        }, (payload) => {
            console.log('🔔 إشعار فوري جديد:', payload);
            onNewNotificationReceived(payload.new);
        })
        .subscribe((status) => {
            console.log('📡 حالة اشتراك الإشعارات:', status);
        });
}

// ============================================
// معالجة الإشعار الجديد
// ============================================
function onNewNotificationReceived(notification) {
    // زيادة العداد
    unreadCount++;
    updateNotificationBadge();
    
    // عرض إشعار منبثق (Toast)
    showToastNotification(notification);
    
    // تحديث القائمة إذا كانت مفتوحة
    const panel = document.getElementById('examNotificationPanel');
    if (panel && panel.style.display === 'block') {
        addNotificationToListTop(notification);
    }
    
    // تحديث العداد في localStorage للتخزين المؤقت
    try {
        localStorage.setItem(`notif_count_${currentNotificationsUser.id}`, unreadCount);
    } catch(e) {}
}

// ============================================
// عرض إشعار منبثق
// ============================================
function showToastNotification(notification) {
    const toast = document.createElement('div');
    toast.className = `realtime-toast ${notification.type || 'info'}`;
    toast.innerHTML = `
        <div class="toast-close-btn" onclick="this.parentElement.remove()">✕</div>
        <div class="toast-title">${escapeHtml(notification.title || '📢 إشعار جديد')}</div>
        <div class="toast-message">${escapeHtml(notification.message || '')}</div>
        <div style="font-size: 10px; color: #999; margin-top: 8px;">الآن</div>
    `;
    
    document.body.appendChild(toast);
    
    // إزالة بعد 5 ثوانٍ
    setTimeout(() => {
        if (toast && toast.remove) toast.remove();
    }, 5000);
}

// ============================================
// إضافة إشعار إلى أعلى القائمة
// ============================================
function addNotificationToListTop(notification) {
    const listContainer = document.getElementById('examNotificationList');
    if (!listContainer) return;
    
    // إزالة رسالة "لا توجد إشعارات"
    if (listContainer.querySelector('.notification-empty-msg')) {
        listContainer.innerHTML = '';
    }
    
    const newItem = document.createElement('div');
    newItem.className = 'notification-item unread';
    newItem.setAttribute('data-id', notification.id);
    newItem.setAttribute('onclick', `markNotificationAsRead('${notification.id}')`);
    newItem.innerHTML = `
        <div class="notification-title">${escapeHtml(notification.title || 'إشعار')}</div>
        <div class="notification-message">${escapeHtml(notification.message || '')}</div>
        <div class="notification-time">الآن</div>
    `;
    
    listContainer.insertBefore(newItem, listContainer.firstChild);
    
    // تحديد عدد العناصر والاكتفاء بآخر 50
    const items = listContainer.querySelectorAll('.notification-item');
    if (items.length > 50) {
        for (let i = 50; i < items.length; i++) {
            items[i].remove();
        }
    }
}

// ============================================
// تحديث عداد الإشعارات
// ============================================
function updateNotificationBadge() {
    const badge = document.getElementById('examNotificationCount');
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'block';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }
}

// ============================================
// تحديد إشعار كمقروء
// ============================================
window.markNotificationAsRead = async function(notificationId) {
    if (!currentNotificationsUser || !window.supabase) return;
    
    try {
        const { error } = await window.supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date() })
            .eq('id', notificationId)
            .eq('user_id', currentNotificationsUser.id);
        
        if (error) throw error;
        
        // تحديث الواجهة
        const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            item.classList.remove('unread');
        }
        
        // تقليل العداد
        if (unreadCount > 0) {
            unreadCount--;
            updateNotificationBadge();
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error);
    }
};

// ============================================
// تحديد الكل كمقروء
// ============================================
async function markAllAsRead() {
    if (!currentNotificationsUser || !window.supabase) return;
    
    try {
        const { error } = await window.supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date() })
            .eq('user_id', currentNotificationsUser.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        // تحديث الواجهة
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        
        unreadCount = 0;
        updateNotificationBadge();
        
    } catch (error) {
        console.error('❌ خطأ:', error);
    }
}

// ============================================
// التحقق من الإشعارات الجديدة (احتياطي)
// ============================================
async function checkNewNotifications() {
    if (!currentNotificationsUser || !window.supabase) return;
    
    try {
        const { count, error } = await window.supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentNotificationsUser.id)
            .eq('is_read', false);
        
        if (error) throw error;
        
        if (count !== unreadCount && count > unreadCount) {
            // توجد إشعارات جديدة لم تنعكس عبر Realtime
            await loadUserNotifications();
        }
        
    } catch (error) {
        console.error('❌ خطأ في التحقق الاحتياطي:', error);
    }
}

// ============================================
// دالة مساعدة: إنشاء إشعار جديد
// (تستخدمها دوال النظام الأخرى)
// ============================================
async function createNewNotification(userId, title, message, type = 'info', link = null) {
    if (!window.supabase) {
        console.error('❌ Supabase غير متاح');
        return null;
    }
    
    try {
        const { data, error } = await window.supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title: title,
                message: message,
                type: type,
                link: link,
                is_read: false,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        console.log('✅ تم إنشاء الإشعار:', data);
        return data;
        
    } catch (error) {
        console.error('❌ فشل إنشاء الإشعار:', error);
        return null;
    }
}

// ============================================
// دالة خاصة: إشعار قبول طالب في الامتحان
// ============================================
async function notifyStudentApproved(studentUserId, examName) {
    return await createNewNotification(
        studentUserId,
        '🎉 تم قبولك في الامتحان',
        `تم قبول طلبك في امتحان "${examName}" بنجاح. يمكنك البدء الآن.`,
        'success'
    );
}

// ============================================
// دالة خاصة: إشعار رفض طالب في الامتحان
// ============================================
async function notifyStudentRejected(studentUserId, examName, reason = '') {
    return await createNewNotification(
        studentUserId,
        '⚠️ تم رفض الطلب',
        `عذراً، تم رفض طلبك في امتحان "${examName}"${reason ? ' بسبب: ' + reason : ''}`,
        'warning'
    );
}

// ============================================
// دالة خاصة: إشعار نتيجة امتحان
// ============================================
async function notifyExamResult(studentUserId, examName, score, total) {
    return await createNewNotification(
        studentUserId,
        '📊 نتيجة الامتحان',
        `تم تصحيح امتحان "${examName}" - حصلت على ${score} من ${total}`,
        'info'
    );
}

// ============================================
// دالة تنظيف عند الخروج
// ============================================
function cleanupNotifications() {
    if (notificationSubscription) {
        notificationSubscription.unsubscribe();
        notificationSubscription = null;
    }
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// ============================================
// دوال مساعدة
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// ============================================
// تصدير الدوال للاستخدام العام
// ============================================
window.notificationSystem = {
    init: initNotificationSystem,
    create: createNewNotification,
    notifyStudentApproved: notifyStudentApproved,
    notifyStudentRejected: notifyStudentRejected,
    notifyExamResult: notifyExamResult,
    cleanup: cleanupNotifications
};
