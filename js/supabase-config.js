// supabase-config.js - ملف الاتصال الرئيسي

// ==================== إعدادات Supabase ====================
// ⚠️ استبدل هذه القيم بمفاتيح مشروع Supabase الجديد الخاص بك
const SUPABASE_URL = 'https://YOUR_NEW_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_NEW_ANON_KEY';

// إنشاء عميل Supabase
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== دوال مساعدة عامة ====================

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</div>
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

function showConfirm(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
        <div class="confirm-content">
            <div class="confirm-icon">❓</div>
            <div class="confirm-message">${message}</div>
            <div class="confirm-buttons">
                <button class="confirm-btn confirm-yes">نعم</button>
                <button class="confirm-btn confirm-no">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.querySelector('.confirm-yes').onclick = () => { modal.remove(); if (onConfirm) onConfirm(); };
    modal.querySelector('.confirm-no').onclick = () => modal.remove();
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '../index.html';
}

function checkAuth(allowedRoles = ['admin', 'teacher', 'student']) {
    const user = getUser();
    if (!user) { window.location.href = '../index.html'; return false; }
    if (!allowedRoles.includes(user.role)) {
        if (user.role === 'admin') window.location.href = '../admin-dashboard.html';
        else if (user.role === 'teacher') window.location.href = '../teacher-dashboard.html';
        else window.location.href = '../student-dashboard.html';
        return false;
    }
    return true;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-EG');
}

function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-EG');
}

// ==================== دوال المصادقة ====================

async function loginUser(identifier, password) {
    const hashedPassword = await hashPassword(password);
    
    const { data, error } = await sb
        .from('users')
        .select('*')
        .or(`email.eq.${identifier},phone.eq.${identifier}`)
        .eq('password_hash', hashedPassword)
        .single();
    
    if (error || !data) return { success: false, error: 'بيانات الدخول غير صحيحة' };
    if (data.status !== 'active') return { success: false, error: 'الحساب غير مفعل' };
    
    return { 
        success: true, 
        user: { 
            id: data.id, 
            name: data.name, 
            role: data.role, 
            email: data.email, 
            phone: data.phone,
            class_id: data.class_id
        } 
    };
}

async function registerStudent(name, phone, password, classId, email = null) {
    const hashedPassword = await hashPassword(password);
    
    const { data, error } = await sb
        .from('users')
        .insert({ 
            name, 
            phone, 
            email, 
            password_hash: hashedPassword, 
            role: 'student', 
            status: 'pending',
            class_id: classId 
        })
        .select()
        .single();
    
    if (error) {
        if (error.code === '23505') return { success: false, error: 'رقم الهاتف أو البريد مستخدم بالفعل' };
        return { success: false, error: error.message };
    }
    return { success: true, user: data };
}

// ==================== دوال عامة للمستخدمين ====================

async function fetchUsers(filters = {}) {
    let query = sb.from('users').select('*');
    
    if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
    }
    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function updateUserStatus(userId, status) {
    const { error } = await sb.from('users').update({ status }).eq('id', userId);
    return !error;
}

async function deleteUser(userId) {
    const { error } = await sb.from('users').delete().eq('id', userId);
    return !error;
}

async function resetUserPassword(userId, newPassword) {
    const hashedPassword = await hashPassword(newPassword);
    const { error } = await sb.from('users').update({ password_hash: hashedPassword }).eq('id', userId);
    return !error;
}

// ==================== دوال الصفوف ====================

async function fetchClasses() {
    const { data, error } = await sb.from('classes').select('*').order('name');
    if (error) return [];
    return data;
}

async function createClass(classData) {
    const { data, error } = await sb.from('classes').insert(classData).select().single();
    if (error) return null;
    return data;
}

async function updateClass(id, classData) {
    const { error } = await sb.from('classes').update(classData).eq('id', id);
    return !error;
}

async function deleteClass(id) {
    const { error } = await sb.from('classes').delete().eq('id', id);
    return !error;
}

// ==================== دوال المواد ====================

async function fetchSubjects() {
    const { data, error } = await sb.from('subjects').select('*').order('name');
    if (error) return [];
    return data;
}

async function createSubject(subjectData) {
    const { data, error } = await sb.from('subjects').insert(subjectData).select().single();
    if (error) return null;
    return data;
}

async function deleteSubject(id) {
    const { error } = await sb.from('subjects').delete().eq('id', id);
    return !error;
}

// ==================== دوال الامتحانات ====================

async function fetchExams(filters = {}) {
    let query = sb.from('exams').select('*, classes(name), subjects(name), users!exams_teacher_id_fkey(name)');
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.classId && filters.classId !== 'all') {
        query = query.eq('class_id', filters.classId);
    }
    if (filters.subjectId && filters.subjectId !== 'all') {
        query = query.eq('subject_id', filters.subjectId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createExam(examData) {
    const { data, error } = await sb.from('exams').insert(examData).select().single();
    if (error) return null;
    return data;
}

async function updateExamStatus(id, status) {
    const { error } = await sb.from('exams').update({ status }).eq('id', id);
    return !error;
}

async function deleteExam(id) {
    const { error } = await sb.from('exams').delete().eq('id', id);
    return !error;
}

// ==================== دوال الأسئلة ====================

async function fetchQuestions(filters = {}) {
    let query = sb.from('questions').select('*, users(name)');
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
    }
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createQuestion(questionData) {
    const { data, error } = await sb.from('questions').insert(questionData).select().single();
    if (error) return null;
    return data;
}

async function updateQuestionStatus(id, status, feedback = null) {
    const updateData = { status };
    if (feedback) updateData.feedback = feedback;
    const { error } = await sb.from('questions').update(updateData).eq('id', id);
    return !error;
}

async function deleteQuestion(id) {
    const { error } = await sb.from('questions').delete().eq('id', id);
    return !error;
}

// ==================== دوال المجموعات ====================

async function fetchGroups(filters = {}) {
    let query = sb.from('groups').select('*, classes(name), subjects(name), users!groups_teacher_id_fkey(name)');
    
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createGroup(groupData) {
    const { data, error } = await sb.from('groups').insert(groupData).select().single();
    if (error) return null;
    return data;
}

async function updateGroup(id, groupData) {
    const { error } = await sb.from('groups').update(groupData).eq('id', id);
    return !error;
}

async function deleteGroup(id) {
    const { error } = await sb.from('groups').delete().eq('id', id);
    return !error;
}

async function joinGroup(groupId, studentId) {
    const { data, error } = await sb
        .from('group_members')
        .insert({ group_id: groupId, student_id: studentId, status: 'pending' })
        .select()
        .single();
    if (error) return null;
    return data;
}

async function updateGroupMemberStatus(groupId, studentId, status) {
    const { error } = await sb
        .from('group_members')
        .update({ status, joined_at: status === 'approved' ? new Date() : null })
        .eq('group_id', groupId)
        .eq('student_id', studentId);
    return !error;
}

// ==================== دوال الإشعارات ====================

async function fetchNotifications() {
    const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) return [];
    return data;
}

async function createNotification(notificationData) {
    const { data, error } = await sb.from('notifications').insert(notificationData).select().single();
    if (error) return null;
    return data;
}

// ==================== دوال الإحصائيات ====================

async function fetchAdminStats() {
    const [users, exams, questions, attempts] = await Promise.all([
        sb.from('users').select('*', { count: 'exact', head: true }),
        sb.from('exams').select('*', { count: 'exact', head: true }),
        sb.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('exam_attempts').select('*', { count: 'exact', head: true })
    ]);
    
    return {
        totalUsers: users.count || 0,
        totalExams: exams.count || 0,
        pendingQuestions: questions.count || 0,
        totalAttempts: attempts.count || 0
    };
}

async function fetchTeacherStats(teacherId) {
    const [exams, questions, groups] = await Promise.all([
        sb.from('exams').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
        sb.from('questions').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
        sb.from('groups').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId)
    ]);
    
    return {
        totalExams: exams.count || 0,
        totalQuestions: questions.count || 0,
        totalGroups: groups.count || 0
    };
}

async function fetchStudentStats(studentId) {
    const [attempts, groups] = await Promise.all([
        sb.from('exam_attempts').select('*', { count: 'exact', head: true }).eq('student_id', studentId),
        sb.from('group_members').select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'approved')
    ]);
    
    return {
        totalAttempts: attempts.count || 0,
        totalGroups: groups.count || 0
    };
}

console.log('✅ supabase-config.js loaded successfully');
