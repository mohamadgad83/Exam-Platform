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
// ==================== إضافة الدوال الناقصة في نهاية الملف ====================

// ==================== دوال الامتحانات والأسئلة المتقدمة ====================

// جلب أسئلة الامتحان
async function fetchExamQuestions(examId) {
    const { data, error } = await sb
        .from('exam_questions')
        .select(`
            *,
            questions:question_id(*)
        `)
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });
    
    if (error) return [];
    return data || [];
}

// جلب محاولات الامتحان
async function fetchExamAttempts(filters = {}) {
    let query = sb.from('exam_attempts').select(`
        *,
        exams:exam_id(*),
        users:student_id(id, name, phone)
    `);
    
    if (filters.examId && filters.examId !== 'all') {
        query = query.eq('exam_id', filters.examId);
    }
    if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
    }
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error) return [];
    return data || [];
}

// إضافة سؤال للامتحان
async function addQuestionToExam(examId, questionId, points, orderIndex) {
    const { error } = await sb
        .from('exam_questions')
        .insert({
            exam_id: examId,
            question_id: questionId,
            points: points,
            order_index: orderIndex
        });
    
    if (error) {
        console.error('Error adding question to exam:', error);
        return false;
    }
    return true;
}

// إحصائيات المعلم
async function fetchTeacherStats(teacherId) {
    try {
        const [exams, questions, groups] = await Promise.all([
            sb.from('exams').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
            sb.from('questions').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
            sb.from('groups').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId)
        ]);
        
        // جلب عدد الطلاب من تعيينات المعلم
        const assignments = await fetchTeacherAssignments(teacherId);
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        let totalStudents = 0;
        
        if (classIds.length > 0) {
            const { count } = await sb
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'student')
                .in('class_id', classIds);
            totalStudents = count || 0;
        }
        
        return {
            totalExams: exams.count || 0,
            totalQuestions: questions.count || 0,
            totalGroups: groups.count || 0,
            totalStudents: totalStudents
        };
    } catch (error) {
        console.error('Error fetching teacher stats:', error);
        return { totalExams: 0, totalQuestions: 0, totalGroups: 0, totalStudents: 0 };
    }
}

// إحصائيات الطالب
async function fetchStudentStats(studentId) {
    try {
        const [attempts, groups] = await Promise.all([
            sb.from('exam_attempts').select('score, total_points').eq('student_id', studentId),
            sb.from('group_members').select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'approved')
        ]);
        
        let avgScore = 0;
        if (attempts.data && attempts.data.length > 0) {
            let totalPercent = 0;
            let validCount = 0;
            for (const a of attempts.data) {
                if (a.total_points && a.total_points > 0) {
                    totalPercent += (a.score / a.total_points) * 100;
                    validCount++;
                }
            }
            avgScore = validCount > 0 ? Math.round(totalPercent / validCount) : 0;
        }
        
        return {
            totalAttempts: attempts.data?.length || 0,
            totalGroups: groups.count || 0,
            avgScore: avgScore
        };
    } catch (error) {
        console.error('Error fetching student stats:', error);
        return { totalAttempts: 0, totalGroups: 0, avgScore: 0 };
    }
}

// جلب أسئلة المعلم (مع فلتر)
// أضف هذه الدوال المصححة في supabase-config.js

// جلب أسئلة المعلم (مع فلتر)
async function fetchTeacherQuestions(teacherId, filters = {}) {
    let query = sb.from('questions').select('*');
    
    query = query.eq('teacher_id', teacherId);
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
    }
    if (filters.class_id && filters.class_id !== 'all') {
        query = query.eq('class_id', parseInt(filters.class_id));
    }
    if (filters.subject_id && filters.subject_id !== 'all') {
        query = query.eq('subject_id', parseInt(filters.subject_id));
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error in fetchTeacherQuestions:', error);
        return [];
    }
    return data || [];
}
// تحديث حالة الامتحان
async function updateExamStatusInDB(examId, status) {
    const { error } = await sb.from('exams').update({ status }).eq('id', examId);
    if (error) return false;
    showToast(`تم ${status === 'published' ? 'نشر' : status === 'closed' ? 'إغلاق' : 'حفظ'} الامتحان`, 'success');
    return true;
}

// جلب الصفوف المتاحة للمعلم
async function fetchTeacherAvailableClasses(teacherId) {
    const assignments = await fetchTeacherAssignments(teacherId);
    const classIds = [...new Set(assignments.map(a => a.class_id))];
    
    if (classIds.length === 0) return [];
    
    const { data } = await sb.from('classes').select('*').in('id', classIds).order('name');
    return data || [];
}

// جلب المواد المتاحة للمعلم
async function fetchTeacherAvailableSubjects(teacherId) {
    const assignments = await fetchTeacherAssignments(teacherId);
    const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
    
    if (subjectIds.length === 0) return [];
    
    const { data } = await sb.from('subjects').select('*').in('id', subjectIds).order('name');
    return data || [];
}

// بدء محاولة امتحان
async function startExamAttempt(examId, studentId) {
    // التحقق من وجود محاولة سابقة غير مكتملة
    const { data: existing } = await sb
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .eq('status', 'in_progress')
        .maybeSingle();
    
    if (existing) {
        return existing;
    }
    
    const { data, error } = await sb
        .from('exam_attempts')
        .insert({
            exam_id: examId,
            student_id: studentId,
            start_time: new Date(),
            status: 'in_progress',
            answers: {}
        })
        .select()
        .single();
    
    if (error) return null;
    return data;
}

// حفظ إجابة
async function saveAnswerToAttempt(attemptId, questionId, answer) {
    // جلب المحاولة الحالية
    const { data: attempt } = await sb
        .from('exam_attempts')
        .select('answers')
        .eq('id', attemptId)
        .single();
    
    const answers = attempt?.answers || {};
    answers[questionId] = answer;
    
    const { error } = await sb
        .from('exam_attempts')
        .update({ answers: answers })
        .eq('id', attemptId);
    
    return !error;
}

// تسليم الامتحان
async function submitExamAttempt(attemptId, answers, score, totalPoints) {
    const { error } = await sb
        .from('exam_attempts')
        .update({
            answers: answers,
            score: score,
            total_points: totalPoints,
            status: 'submitted',
            submitted_at: new Date()
        })
        .eq('id', attemptId);
    
    return !error;
}

// ==================== دوال الطلبات ====================

// إنشاء طلب امتحان
async function createExamRequest(studentId, examId) {
    const { data: existing } = await sb
        .from('exam_requests')
        .select('*')
        .eq('student_id', studentId)
        .eq('exam_id', examId)
        .maybeSingle();
    
    if (existing) {
        showToast('لديك طلب سابق لهذا الامتحان', 'warning');
        return null;
    }
    
    const { data, error } = await sb
        .from('exam_requests')
        .insert({
            student_id: studentId,
            exam_id: examId,
            status: 'pending'
        })
        .select()
        .single();
    
    if (error) return null;
    showToast('تم إرسال طلب الاشتراك', 'success');
    return data;
}

// جلب طلبات الامتحان
async function fetchExamRequests(filters = {}) {
    let query = sb.from('exam_requests').select(`
        *,
        exams:exam_id(*),
        users:student_id(id, name, phone)
    `);
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
    }
    if (filters.examId) {
        query = query.eq('exam_id', filters.examId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

// تحديث حالة طلب الامتحان
async function updateExamRequestStatus(requestId, status, rejectionReason = null) {
    const updateData = { status };
    if (rejectionReason) updateData.rejection_reason = rejectionReason;
    
    const { error } = await sb
        .from('exam_requests')
        .update(updateData)
        .eq('id', requestId);
    
    if (error) return false;
    showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, 'success');
    return true;
}

// ==================== دوال المجموعات المحسنة ====================

// جلب عضوية الطالب في المجموعات
async function fetchStudentGroupMemberships(studentId) {
    const { data, error } = await sb
        .from('group_members')
        .select('*, groups:group_id(*)')
        .eq('student_id', studentId);
    
    if (error) return [];
    return data || [];
}

// جلب طلبات الانضمام للمجموعة (للمعلم)
async function fetchGroupJoinRequests(groupId, status = 'pending') {
    const { data, error } = await sb
        .from('group_members')
        .select('*, users:student_id(id, name, phone)')
        .eq('group_id', groupId)
        .eq('status', status);
    
    if (error) return [];
    return data || [];
}
// ==================== إضافة في نهاية supabase-config.js ====================

// جلب إحصائيات الامتحان للمعلم
async function fetchExamStatistics(examId) {
    try {
        // جلب جميع محاولات الامتحان
        const { data: attempts } = await sb
            .from('exam_attempts')
            .select('*, users:student_id(id, name, phone)')
            .eq('exam_id', examId);
        
        if (!attempts || attempts.length === 0) {
            return {
                totalAttempts: 0,
                averageScore: 0,
                passedCount: 0,
                failedCount: 0,
                pendingCount: 0,
                topStudents: [],
                scoreDistribution: { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }
            };
        }
        
        let totalScore = 0;
        let passedCount = 0;
        let failedCount = 0;
        let pendingCount = 0;
        const distribution = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
        const studentScores = [];
        
        for (const attempt of attempts) {
            if (attempt.status === 'graded' || attempt.status === 'submitted') {
                const percentage = attempt.total_points ? (attempt.score / attempt.total_points) * 100 : 0;
                totalScore += percentage;
                
                if (percentage >= 50) passedCount++;
                else failedCount++;
                
                // توزيع الدرجات
                if (percentage <= 20) distribution['0-20']++;
                else if (percentage <= 40) distribution['21-40']++;
                else if (percentage <= 60) distribution['41-60']++;
                else if (percentage <= 80) distribution['61-80']++;
                else distribution['81-100']++;
                
                studentScores.push({
                    name: attempt.users?.name || 'طالب',
                    score: Math.round(percentage)
                });
            } else {
                pendingCount++;
            }
        }
        
        const gradedCount = passedCount + failedCount;
        const averageScore = gradedCount > 0 ? Math.round(totalScore / gradedCount) : 0;
        
        // ترتيب الطلاب حسب الدرجة
        const topStudents = studentScores.sort((a, b) => b.score - a.score).slice(0, 5);
        
        return {
            totalAttempts: attempts.length,
            averageScore: averageScore,
            passedCount: passedCount,
            failedCount: failedCount,
            pendingCount: pendingCount,
            topStudents: topStudents,
            scoreDistribution: distribution
        };
    } catch (error) {
        console.error('Error fetching exam statistics:', error);
        return null;
    }
}

// جلب إحصائيات الطالب التفصيلية
async function fetchStudentDetailedStats(studentId) {
    try {
        const [attempts, groups] = await Promise.all([
            sb.from('exam_attempts')
                .select('*, exams:exam_id(title, passing_score)')
                .eq('student_id', studentId)
                .order('submitted_at', { ascending: false }),
            sb.from('group_members')
                .select('*, groups:group_id(name, subjects:subject_id(name))')
                .eq('student_id', studentId)
                .eq('status', 'approved')
        ]);
        
        let totalExams = 0;
        let completedExams = 0;
        let passedExams = 0;
        let totalPercentage = 0;
        let bestExam = { title: '', score: 0 };
        let recentExams = [];
        
        for (const attempt of attempts.data || []) {
            if (attempt.status === 'graded' || attempt.status === 'submitted') {
                totalExams++;
                const percentage = attempt.total_points ? (attempt.score / attempt.total_points) * 100 : 0;
                totalPercentage += percentage;
                
                if (percentage >= (attempt.exams?.passing_score || 50)) {
                    passedExams++;
                }
                
                if (percentage > bestExam.score) {
                    bestExam = { title: attempt.exams?.title || 'امتحان', score: Math.round(percentage) };
                }
                
                if (recentExams.length < 5) {
                    recentExams.push({
                        title: attempt.exams?.title || 'امتحان',
                        score: Math.round(percentage),
                        date: attempt.submitted_at,
                        passed: percentage >= (attempt.exams?.passing_score || 50)
                    });
                }
            }
            if (attempt.status === 'submitted') {
                completedExams++;
            }
        }
        
        const averageScore = totalExams > 0 ? Math.round(totalPercentage / totalExams) : 0;
        const successRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;
        
        return {
            totalExams: totalExams,
            completedExams: completedExams,
            passedExams: passedExams,
            averageScore: averageScore,
            successRate: successRate,
            bestExam: bestExam,
            recentExams: recentExams,
            groupsCount: groups.data?.length || 0
        };
    } catch (error) {
        console.error('Error fetching student detailed stats:', error);
        return null;
    }
}
// ==================== دوال الامتحانات المتقدمة ====================

// إنشاء امتحان جديد
async function createExam(examData) {
    try {
        const { data, error } = await sb
            .from('exams')
            .insert(examData)
            .select()
            .single();
        
        if (error) throw error;
        showToast('تم إنشاء الامتحان بنجاح', 'success');
        return data;
    } catch (error) {
        console.error('Error creating exam:', error);
        showToast('حدث خطأ في إنشاء الامتحان', 'error');
        return null;
    }
}

// تحديث الامتحان
async function updateExam(examId, examData) {
    try {
        const { error } = await sb
            .from('exams')
            .update(examData)
            .eq('id', examId);
        
        if (error) throw error;
        showToast('تم تحديث الامتحان', 'success');
        return true;
    } catch (error) {
        console.error('Error updating exam:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// حذف الامتحان
async function deleteExam(examId) {
    try {
        const { error } = await sb
            .from('exams')
            .delete()
            .eq('id', examId);
        
        if (error) throw error;
        showToast('تم حذف الامتحان', 'success');
        return true;
    } catch (error) {
        console.error('Error deleting exam:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// جلب طلبات الاشتراك
async function fetchExamRequests(filters = {}) {
    try {
        let query = sb.from('exam_requests').select(`
            *,
            exam:exam_id(*),
            student:student_id(id, name, phone),
            approver:approved_by(id, name)
        `);
        
        if (filters.exam_id) {
            query = query.eq('exam_id', filters.exam_id);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.student_id) {
            query = query.eq('student_id', filters.student_id);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching exam requests:', error);
        return [];
    }
}

// تحديث حالة طلب الاشتراك
async function updateExamRequestStatus(requestId, status, rejectionReason = null) {
    try {
        const updateData = { status };
        if (status === 'approved') {
            updateData.approved_at = new Date();
            updateData.approved_by = getUser().id;
        }
        if (rejectionReason) {
            updateData.rejection_reason = rejectionReason;
        }
        
        const { error } = await sb
            .from('exam_requests')
            .update(updateData)
            .eq('id', requestId);
        
        if (error) throw error;
        
        // إذا تمت الموافقة، أضف الطالب إلى exam_enrollments
        if (status === 'approved') {
            const { data: request } = await sb
                .from('exam_requests')
                .select('exam_id, student_id')
                .eq('id', requestId)
                .single();
            
            if (request) {
                await sb
                    .from('exam_enrollments')
                    .insert({
                        exam_id: request.exam_id,
                        student_id: request.student_id,
                        exam_request_id: requestId,
                        enrolled_by: getUser().id,
                        enrolled_at: new Date()
                    })
                    .select();
            }
        }
        
        showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, 'success');
        return true;
    } catch (error) {
        console.error('Error updating request status:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// قبول جميع طلبات امتحان (للمجاني)
async function approveAllExamRequests(examId) {
    try {
        const { data: requests, error } = await sb
            .from('exam_requests')
            .select('id, student_id')
            .eq('exam_id', examId)
            .eq('status', 'pending_admin');
        
        if (error) throw error;
        
        for (const request of requests) {
            await updateExamRequestStatus(request.id, 'approved');
        }
        
        showToast(`تم قبول ${requests.length} طلب`, 'success');
        return true;
    } catch (error) {
        console.error('Error approving all requests:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// جلب المدفوعات
async function fetchPayments(filters = {}) {
    try {
        let query = sb.from('payments').select(`
            *,
            student:student_id(id, name, phone),
            exam:exam_id(id, title),
            payment_method:payment_method_id(id, name),
            confirmer:confirmed_by(id, name)
        `);
        
        if (filters.exam_id) {
            query = query.eq('exam_id', filters.exam_id);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.student_id) {
            query = query.eq('student_id', filters.student_id);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching payments:', error);
        return [];
    }
}

// تأكيد الدفع
async function confirmPayment(paymentId, status, rejectionReason = null) {
    try {
        const updateData = { 
            status: status,
            confirmed_by: getUser().id,
            confirmed_at: new Date()
        };
        if (rejectionReason) {
            updateData.rejection_reason = rejectionReason;
        }
        
        const { error } = await sb
            .from('payments')
            .update(updateData)
            .eq('id', paymentId);
        
        if (error) throw error;
        
        // إذا تم تأكيد الدفع، قم بقبول طلب الاشتراك المرتبط
        if (status === 'confirmed') {
            const { data: payment } = await sb
                .from('payments')
                .select('exam_request_id')
                .eq('id', paymentId)
                .single();
            
            if (payment && payment.exam_request_id) {
                await updateExamRequestStatus(payment.exam_request_id, 'approved');
            }
        }
        
        showToast(`تم ${status === 'confirmed' ? 'تأكيد' : 'رفض'} الدفع`, 'success');
        return true;
    } catch (error) {
        console.error('Error confirming payment:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// جلب طرق الدفع
async function fetchPaymentMethods() {
    try {
        const { data, error } = await sb
            .from('payment_methods')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        return [];
    }
}

// إضافة طريقة دفع جديدة
async function addPaymentMethod(methodData) {
    try {
        const { error } = await sb
            .from('payment_methods')
            .insert({
                ...methodData,
                created_by: getUser().id,
                created_at: new Date()
            });
        
        if (error) throw error;
        showToast('تم إضافة طريقة الدفع', 'success');
        return true;
    } catch (error) {
        console.error('Error adding payment method:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// حذف طريقة دفع
async function deletePaymentMethod(methodId) {
    try {
        const { error } = await sb
            .from('payment_methods')
            .delete()
            .eq('id', methodId);
        
        if (error) throw error;
        showToast('تم حذف طريقة الدفع', 'success');
        return true;
    } catch (error) {
        console.error('Error deleting payment method:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// جلب الكوبونات
async function fetchCoupons(filters = {}) {
    try {
        let query = sb.from('coupons').select('*');
        
        if (filters.is_active !== undefined) {
            query = query.eq('is_active', filters.is_active);
        }
        if (filters.target_exam_id) {
            query = query.eq('target_exam_id', filters.target_exam_id);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching coupons:', error);
        return [];
    }
}

// إنشاء كوبون جديد
async function createCoupon(couponData) {
    try {
        const { error } = await sb
            .from('coupons')
            .insert({
                ...couponData,
                created_by: getUser().id,
                created_at: new Date()
            });
        
        if (error) throw error;
        showToast('تم إنشاء الكوبون', 'success');
        return true;
    } catch (error) {
        console.error('Error creating coupon:', error);
        showToast('حدث خطأ', 'error');
        return false;
    }
}

// التحقق من صحة الكوبون
async function validateCoupon(code, examId, studentId) {
    try {
        const { data: coupon, error } = await sb
            .from('coupons')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();
        
        if (error || !coupon) {
            return { valid: false, message: 'الكوبون غير صالح' };
        }
        
        // التحقق من صلاحية التاريخ
        const now = new Date();
        if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            return { valid: false, message: 'الكوبون لم يبدأ بعد' };
        }
        if (coupon.valid_until && new Date(coupon.valid_until) < now) {
            return { valid: false, message: 'انتهت صلاحية الكوبون' };
        }
        
        // التحقق من عدد الاستخدامات
        if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
            return { valid: false, message: 'تم استخدام الكوبون максимальное عدد المرات' };
        }
        
        // التحقق من الامتحان المستهدف
        if (coupon.target_exam_id && coupon.target_exam_id !== examId) {
            return { valid: false, message: 'هذا الكوبون غير صالح لهذا الامتحان' };
        }
        
        // التحقق من الطلاب المستهدفين
        if (coupon.target_students) {
            const targetStudents = JSON.parse(coupon.target_students);
            if (targetStudents.length > 0 && !targetStudents.includes(studentId)) {
                return { valid: false, message: 'هذا الكوبون غير صالح لك' };
            }
        }
        
        return { valid: true, coupon: coupon };
    } catch (error) {
        console.error('Error validating coupon:', error);
        return { valid: false, message: 'حدث خطأ' };
    }
}

// استخدام كوبون
async function useCoupon(code, examId, studentId, examRequestId) {
    try {
        const validation = await validateCoupon(code, examId, studentId);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }
        
        const coupon = validation.coupon;
        
        // تحديث عدد الاستخدامات
        await sb
            .from('coupons')
            .update({ used_count: coupon.used_count + 1 })
            .eq('id', coupon.id);
        
        // تسجيل الاستخدام
        await sb
            .from('coupon_usages')
            .insert({
                coupon_id: coupon.id,
                student_id: studentId,
                exam_request_id: examRequestId,
                used_at: new Date()
            });
        
        return { success: true, coupon: coupon };
    } catch (error) {
        console.error('Error using coupon:', error);
        return { success: false, message: 'حدث خطأ' };
    }
}

// جلب الإشعارات
async function fetchNotifications(userId, limit = 20) {
    try {
        const { data, error } = await sb
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

// تحديث حالة الإشعار (قراءة)
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await sb
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
}

// تحديث كل الإشعارات كمقروءة
async function markAllNotificationsAsRead(userId) {
    try {
        const { error } = await sb
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
    }
}

// إضافة إشعار جديد
async function addNotification(userId, title, message, type, relatedId = null) {
    try {
        const { error } = await sb
            .from('notifications')
            .insert({
                user_id: userId,
                title: title,
                message: message,
                type: type,
                related_id: relatedId,
                created_at: new Date()
            });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error adding notification:', error);
        return false;
    }
}

// جلب إحصائيات الامتحان
async function fetchExamStats(examId) {
    try {
        const [requests, enrollments, payments] = await Promise.all([
            sb.from('exam_requests').select('*', { count: 'exact' }).eq('exam_id', examId),
            sb.from('exam_enrollments').select('*', { count: 'exact' }).eq('exam_id', examId),
            sb.from('payments').select('*', { count: 'exact' }).eq('exam_id', examId).eq('status', 'confirmed')
        ]);
        
        const pendingRequests = await sb
            .from('exam_requests')
            .select('*', { count: 'exact' })
            .eq('exam_id', examId)
            .eq('status', 'pending_admin');
        
        return {
            total_requests: requests.count || 0,
            pending_count: pendingRequests.count || 0,
            approved_count: enrollments.count || 0,
            paid_count: payments.count || 0
        };
    } catch (error) {
        console.error('Error fetching exam stats:', error);
        return {
            total_requests: 0,
            pending_count: 0,
            approved_count: 0,
            paid_count: 0
        };
    }
}
// ==================== دوال إضافية ناقصة ====================

// حفظ إجابة في محاولة الامتحان
async function saveAnswerToAttempt(attemptId, questionId, answer) {
    try {
        // جلب المحاولة الحالية
        const { data: attempt, error: fetchError } = await sb
            .from('exam_attempts')
            .select('answers')
            .eq('id', attemptId)
            .single();
        
        if (fetchError) throw fetchError;
        
        const answers = attempt?.answers || {};
        answers[questionId] = answer;
        
        const { error: updateError } = await sb
            .from('exam_attempts')
            .update({ answers: answers })
            .eq('id', attemptId);
        
        if (updateError) throw updateError;
        
        return true;
    } catch (error) {
        console.error('Error saving answer:', error);
        return false;
    }
}

// جلب إحصائيات الامتحان
async function fetchExamStats(examId) {
    try {
        const [requests, attempts] = await Promise.all([
            sb.from('exam_requests').select('*', { count: 'exact', head: true }).eq('exam_id', examId),
            sb.from('exam_attempts').select('*', { count: 'exact', head: true }).eq('exam_id', examId)
        ]);
        
        const pendingRequests = await sb
            .from('exam_requests')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', examId)
            .eq('status', 'pending_admin');
        
        return {
            total_requests: requests.count || 0,
            pending_count: pendingRequests.count || 0,
            total_attempts: attempts.count || 0,
            approved_count: (requests.count || 0) - (pendingRequests.count || 0)
        };
    } catch (error) {
        console.error('Error fetching exam stats:', error);
        return { total_requests: 0, pending_count: 0, total_attempts: 0, approved_count: 0 };
    }
}

// جلب آخر n من الامتحانات لمعلم معين
async function fetchRecentExams(teacherId, limit = 5) {
    try {
        const { data, error } = await sb
            .from('exams')
            .select('*, subjects:subject_id(name), classes:class_id(name)')
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching recent exams:', error);
        return [];
    }
}

// تصدير الدوال الجديدة للنطاق العام
window.saveAnswerToAttempt = saveAnswerToAttempt;
window.fetchExamStats = fetchExamStats;
window.fetchRecentExams = fetchRecentExams;

console.log('✅ supabase-config.js updated with missing functions');
console.log('✅ جميع دوال الامتحانات المتقدمة تم تحميلها بنجاح');
console.log('✅ supabase-config.js updated with all missing functions');
console.log('✅ supabase-config.js loaded successfully');
console.log('✅ Available functions: hashPassword, loginUser, getUser, setUser, logout, checkAuth, createGroup, createExam, createQuestion, etc.');
