// ============================================
// supabase-config.js - الملف الرئيسي للمشروع
// منصة الاختبارات - Exam Platform
// ============================================

// ==================== إعدادات Supabase ====================
const SUPABASE_URL = 'https://cuchwughgvhiwgaoodib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Y2h3dWdoZ3ZoaXdnYW9vZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDUzMTUsImV4cCI6MjA5NjUyMTMxNX0.vM_wo2q8QYzdSa93wv4lAXv2q-zR1_5VXk2yfJ9pxgQ';

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

function showConfirm(message, onConfirm, onCancel = null) {
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
    modal.querySelector('.confirm-no').onclick = () => { modal.remove(); if (onCancel) onCancel(); };
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
    window.location.href = 'index.html';
}

function checkAuth(allowedRoles = ['admin', 'teacher', 'student']) {
    const user = getUser();
    if (!user) { 
        window.location.href = 'index.html'; 
        return false; 
    }
    if (!allowedRoles.includes(user.role)) {
        if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
        else if (user.role === 'teacher') window.location.href = 'teacher-dashboard.html';
        else window.location.href = 'student-dashboard.html';
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
    
    let query = sb.from('users').select('*').eq('password_hash', hashedPassword);
    
    if (/^\d+$/.test(identifier)) {
        query = query.eq('phone', identifier);
    } else {
        query = query.eq('username', identifier);
    }
    
    const { data, error } = await query.single();
    
    if (error || !data) {
        const { data: emailData } = await sb
            .from('users')
            .select('*')
            .eq('email', identifier)
            .eq('password_hash', hashedPassword)
            .single();
        
        if (emailData) {
            if (emailData.status !== 'active') {
                return { success: false, error: 'الحساب غير مفعل' };
            }
            return {
                success: true,
                user: {
                    id: emailData.id,
                    name: emailData.name,
                    role: emailData.role,
                    email: emailData.email,
                    phone: emailData.phone,
                    username: emailData.username,
                    class_id: emailData.class_id,
                    status: emailData.status
                }
            };
        }
        return { success: false, error: 'بيانات الدخول غير صحيحة' };
    }
    
    if (data.status !== 'active') {
        return { success: false, error: 'الحساب غير مفعل' };
    }
    
    return {
        success: true,
        user: {
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
            phone: data.phone,
            username: data.username,
            class_id: data.class_id,
            status: data.status
        }
    };
}

async function registerStudent(name, phone, password, classId, email = null) {
    const hashedPassword = await hashPassword(password);
    
    const { data, error } = await sb
        .from('users')
        .insert({ 
            name, phone, email, password_hash: hashedPassword, 
            role: 'student', status: 'pending', class_id: classId 
        })
        .select()
        .single();
    
    if (error) {
        if (error.code === '23505') return { success: false, error: 'رقم الهاتف أو البريد مستخدم بالفعل' };
        return { success: false, error: error.message };
    }
    return { success: true, user: data };
}

// ==================== دوال المستخدمين ====================

async function fetchUsers(filters = {}) {
    let query = sb.from('users').select('*');
    
    if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
    }
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%,username.ilike.%${filters.search}%`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function updateUserStatus(userId, status) {
    const { error } = await sb.from('users').update({ status }).eq('id', userId);
    if (error) return false;
    showToast(`تم ${status === 'active' ? 'تفعيل' : 'تعليق'} المستخدم`, 'success');
    return true;
}

async function deleteUser(userId) {
    const { error } = await sb.from('users').delete().eq('id', userId);
    if (error) return false;
    showToast('تم حذف المستخدم', 'success');
    return true;
}

async function resetUserPassword(userId, newPassword) {
    const hashedPassword = await hashPassword(newPassword);
    const { error } = await sb.from('users').update({ password_hash: hashedPassword }).eq('id', userId);
    if (error) return false;
    showToast('تم إعادة تعيين كلمة المرور', 'success');
    return true;
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
    showToast('تم إضافة الصف', 'success');
    return data;
}

async function updateClass(id, classData) {
    const { error } = await sb.from('classes').update(classData).eq('id', id);
    if (error) return false;
    showToast('تم تعديل الصف', 'success');
    return true;
}

async function deleteClass(id) {
    const { error } = await sb.from('classes').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف الصف', 'success');
    return true;
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
    showToast('تم إضافة المادة', 'success');
    return data;
}

async function updateSubject(id, subjectData) {
    const { error } = await sb.from('subjects').update(subjectData).eq('id', id);
    if (error) return false;
    showToast('تم تعديل المادة', 'success');
    return true;
}

async function deleteSubject(id) {
    const { error } = await sb.from('subjects').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف المادة', 'success');
    return true;
}

// ==================== دوال ربط المواد بالصفوف ====================

async function fetchClassSubjects(classId) {
    const { data, error } = await sb
        .from('class_subjects')
        .select('*, subjects(*)')
        .eq('class_id', classId);
    if (error) return [];
    return data || [];
}

async function fetchSubjectClasses(subjectId) {
    const { data, error } = await sb
        .from('class_subjects')
        .select('*, classes(*)')
        .eq('subject_id', subjectId);
    if (error) return [];
    return data || [];
}

async function addSubjectToClass(classId, subjectId) {
    const { error } = await sb
        .from('class_subjects')
        .insert({ class_id: classId, subject_id: subjectId });
    if (error) return false;
    return true;
}

async function removeSubjectFromClass(classSubjectId) {
    const { error } = await sb
        .from('class_subjects')
        .delete()
        .eq('id', classSubjectId);
    if (error) return false;
    return true;
}

// ==================== دوال تعيينات المعلمين ====================

async function fetchTeacherAssignments(teacherId) {
    const { data, error } = await sb
        .from('teacher_assignments')
        .select('*, classes(id, name), subjects(id, name)')
        .eq('teacher_id', teacherId);
    if (error) return [];
    return data;
}

async function addTeacherAssignment(teacherId, classId, subjectId) {
    const { error } = await sb
        .from('teacher_assignments')
        .insert({ teacher_id: teacherId, class_id: classId, subject_id: subjectId });
    if (error) return false;
    showToast('تم تعيين المعلم', 'success');
    return true;
}

async function removeTeacherAssignment(id) {
    const { error } = await sb.from('teacher_assignments').delete().eq('id', id);
    if (error) return false;
    showToast('تم إزالة التعيين', 'success');
    return true;
}

// ==================== دوال الامتحانات ====================

async function fetchExams(filters = {}) {
    let query = sb.from('exams').select(`
        *,
        classes!exams_class_id_fkey(id, name),
        subjects!exams_subject_id_fkey(id, name),
        users!exams_teacher_id_fkey(id, name, username)
    `);
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.classId && filters.classId !== 'all') {
        query = query.eq('class_id', filters.classId);
    }
    if (filters.subjectId && filters.subjectId !== 'all') {
        query = query.eq('subject_id', filters.subjectId);
    }
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createExam(examData) {
    const { data, error } = await sb.from('exams').insert(examData).select().single();
    if (error) return null;
    showToast('تم إنشاء الامتحان', 'success');
    return data;
}

async function updateExamStatus(id, status) {
    const { error } = await sb.from('exams').update({ status }).eq('id', id);
    if (error) return false;
    showToast(`تم ${status === 'published' ? 'نشر' : 'حفظ'} الامتحان`, 'success');
    return true;
}

async function deleteExam(id) {
    const { error } = await sb.from('exams').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف الامتحان', 'success');
    return true;
}

// ==================== دوال الأسئلة ====================

async function fetchQuestions(filters = {}) {
    let query = sb.from('questions').select('*, users!questions_teacher_id_fkey(id, name, username)');
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
    }
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
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

async function createQuestion(questionData) {
    const { data, error } = await sb.from('questions').insert(questionData).select().single();
    if (error) return null;
    showToast('تم إضافة السؤال', 'success');
    return data;
}

async function updateQuestionStatus(id, status, feedback = null) {
    const updateData = { status };
    if (feedback) updateData.feedback = feedback;
    const { error } = await sb.from('questions').update(updateData).eq('id', id);
    if (error) return false;
    showToast(`تم ${status === 'approved' ? 'اعتماد' : 'رفض'} السؤال`, 'success');
    return true;
}

async function deleteQuestion(id) {
    const { error } = await sb.from('questions').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف السؤال', 'success');
    return true;
}

// ==================== دوال المجموعات ====================

async function fetchGroups(filters = {}) {
    let query = sb.from('groups').select(`
        *,
        classes!groups_class_id_fkey(id, name),
        subjects!groups_subject_id_fkey(id, name),
        users!groups_teacher_id_fkey(id, name, username)
    `);
    
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    
    for (const group of data) {
        const { count } = await sb
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('status', 'approved');
        group.member_count = count || 0;
    }
    
    return data;
}

async function createGroup(groupData) {
    const { data, error } = await sb.from('groups').insert(groupData).select().single();
    if (error) return null;
    showToast('تم إنشاء المجموعة', 'success');
    return data;
}

async function updateGroup(id, groupData) {
    const { error } = await sb.from('groups').update(groupData).eq('id', id);
    if (error) return false;
    showToast('تم تعديل المجموعة', 'success');
    return true;
}

async function deleteGroup(id) {
    const { error } = await sb.from('groups').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف المجموعة', 'success');
    return true;
}

async function joinGroup(groupId, studentId) {
    const { data: existing } = await sb
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('student_id', studentId)
        .maybeSingle();
    
    if (existing) {
        if (existing.status === 'pending') return { success: false, error: 'لديك طلب قيد المراجعة' };
        if (existing.status === 'approved') return { success: false, error: 'أنت بالفعل عضو' };
        return { success: false, error: 'لا يمكنك الانضمام' };
    }
    
    const { data, error } = await sb
        .from('group_members')
        .insert({ group_id: groupId, student_id: studentId, status: 'pending' })
        .select()
        .single();
    
    if (error) return { success: false, error: error.message };
    showToast('تم إرسال طلب الانضمام', 'success');
    return { success: true, data };
}

async function updateGroupMemberStatus(groupId, studentId, status) {
    const { error } = await sb
        .from('group_members')
        .update({ status, joined_at: status === 'approved' ? new Date() : null })
        .eq('group_id', groupId)
        .eq('student_id', studentId);
    
    if (error) return false;
    showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, 'success');
    return true;
}

async function fetchGroupMembers(groupId) {
    const { data, error } = await sb
        .from('group_members')
        .select('*, users!group_members_student_id_fkey(id, name, phone)')
        .eq('group_id', groupId);
    if (error) return [];
    return data;
}

// ==================== دوال الإحصائيات ====================

async function fetchAdminStats() {
    const [users, exams, pendingQuestions, attempts] = await Promise.all([
        sb.from('users').select('*', { count: 'exact', head: true }),
        sb.from('exams').select('*', { count: 'exact', head: true }),
        sb.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('exam_attempts').select('*', { count: 'exact', head: true })
    ]);
    
    const { data: teachers } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    const { data: students } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
    
    return {
        totalUsers: users.count || 0,
        totalTeachers: teachers?.count || 0,
        totalStudents: students?.count || 0,
        totalExams: exams.count || 0,
        pendingQuestions: pendingQuestions.count || 0,
        totalAttempts: attempts.count || 0
    };
}

console.log('✅ supabase-config.js loaded successfully');
console.log('✅ Available functions: hashPassword, loginUser, getUser, setUser, logout, checkAuth, createGroup, createExam, createQuestion, etc.');
