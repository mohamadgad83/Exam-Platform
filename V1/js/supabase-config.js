// ============================================
// supabase-config.js - الملف الرئيسي للمشروع
// منصة الاختبارات - Exam Platform
// ============================================

// ==================== إعدادات Supabase ====================
const SUPABASE_URL = 'https://cuchwughgvhiwgaoodib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Y2h3dWdoZ3ZoaXdnYW9vZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDUzMTUsImV4cCI6MjA5NjUyMTMxNX0.vM_wo2q8QYzdSa93wv4lAXv2q-zR1_5VXk2yfJ9pxgQ';

// إنشاء عميل Supabase
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== أسماء الجداول ====================
const TABLES = {
    users: 'exam_users',
    classes: 'exam_classes',
    subjects: 'exam_subjects',
    class_subjects: 'exam_class_subjects',
    teacher_assignments: 'exam_teacher_assignments',
    exams: 'exam_exams',
    exam_questions: 'exam_exam_questions',
    questions: 'exam_questions_bank',
    groups: 'exam_groups',
    group_members: 'exam_group_members',
    requests: 'exam_requests',
    enrollments: 'exam_enrollments',
    attempts: 'exam_attempts',
    payments: 'exam_payments',
    payment_methods: 'exam_payment_methods',
    coupons: 'exam_coupons',
    notifications: 'exam_notifications'
};

// ==================== دوال المصادقة ====================

function encodeUserData(user) {
    return btoa(JSON.stringify(user));
}

function decodeUserData(encoded) {
    try {
        return JSON.parse(atob(encoded));
    } catch {
        return null;
    }
}

function setUser(user) {
    const encoded = encodeUserData(user);
    localStorage.setItem('user', encoded);
}

function getUser() {
    const encoded = localStorage.getItem('user');
    if (!encoded) return null;
    return decodeUserData(encoded);
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('originalUser');
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

async function loginUser(identifier, password) {
    const hashedPassword = await hashPassword(password);
    
    let query = sb.from(TABLES.users).select('*').eq('password_hash', hashedPassword);
    
    if (/^\d+$/.test(identifier)) {
        query = query.eq('phone', identifier);
    } else {
        query = query.eq('username', identifier);
    }
    
    const { data, error } = await query.single();
    
    if (error || !data) {
        const { data: emailData } = await sb
            .from(TABLES.users)
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
        .from(TABLES.users)
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
    let query = sb.from(TABLES.users).select('*');
    
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
    const { error } = await sb.from(TABLES.users).update({ status }).eq('id', userId);
    if (error) return false;
    showToast(`تم ${status === 'active' ? 'تفعيل' : 'تعليق'} المستخدم`, 'success');
    return true;
}

async function deleteUser(userId) {
    const { error } = await sb.from(TABLES.users).delete().eq('id', userId);
    if (error) return false;
    showToast('تم حذف المستخدم', 'success');
    return true;
}

async function resetUserPassword(userId, newPassword) {
    const hashedPassword = await hashPassword(newPassword);
    const { error } = await sb.from(TABLES.users).update({ password_hash: hashedPassword }).eq('id', userId);
    if (error) return false;
    showToast('تم إعادة تعيين كلمة المرور', 'success');
    return true;
}

// ==================== دوال الصفوف ====================

async function fetchClasses() {
    const { data, error } = await sb.from(TABLES.classes).select('*').order('name');
    if (error) return [];
    return data;
}

async function createClass(classData) {
    const { data, error } = await sb.from(TABLES.classes).insert(classData).select().single();
    if (error) return null;
    showToast('تم إضافة الصف', 'success');
    return data;
}

async function updateClass(id, classData) {
    const { error } = await sb.from(TABLES.classes).update(classData).eq('id', id);
    if (error) return false;
    showToast('تم تعديل الصف', 'success');
    return true;
}

async function deleteClass(id) {
    const { error } = await sb.from(TABLES.classes).delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف الصف', 'success');
    return true;
}

// ==================== دوال المواد ====================

async function fetchSubjects() {
    const { data, error } = await sb.from(TABLES.subjects).select('*').order('name');
    if (error) return [];
    return data;
}

async function createSubject(subjectData) {
    const { data, error } = await sb.from(TABLES.subjects).insert(subjectData).select().single();
    if (error) return null;
    showToast('تم إضافة المادة', 'success');
    return data;
}

async function updateSubject(id, subjectData) {
    const { error } = await sb.from(TABLES.subjects).update(subjectData).eq('id', id);
    if (error) return false;
    showToast('تم تعديل المادة', 'success');
    return true;
}

async function deleteSubject(id) {
    const { error } = await sb.from(TABLES.subjects).delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف المادة', 'success');
    return true;
}

// ==================== دوال ربط المواد بالصفوف ====================

async function fetchClassSubjects(classId) {
    const { data, error } = await sb
        .from(TABLES.class_subjects)
        .select(`*, subjects:${TABLES.subjects}(*)`)
        .eq('class_id', classId);
    if (error) return [];
    return data || [];
}

async function fetchSubjectClasses(subjectId) {
    const { data, error } = await sb
        .from(TABLES.class_subjects)
        .select(`*, classes:${TABLES.classes}(*)`)
        .eq('subject_id', subjectId);
    if (error) return [];
    return data || [];
}

async function addSubjectToClass(classId, subjectId) {
    const { error } = await sb
        .from(TABLES.class_subjects)
        .insert({ class_id: classId, subject_id: subjectId });
    if (error) return false;
    return true;
}

async function removeSubjectFromClass(classSubjectId) {
    const { error } = await sb
        .from(TABLES.class_subjects)
        .delete()
        .eq('id', classSubjectId);
    if (error) return false;
    return true;
}

// ==================== دوال تعيينات المعلمين ====================

async function fetchTeacherAssignments(teacherId) {
    const { data, error } = await sb
        .from(TABLES.teacher_assignments)
        .select(`*, classes:${TABLES.classes}(id, name), subjects:${TABLES.subjects}(id, name)`)
        .eq('teacher_id', teacherId);
    if (error) return [];
    return data;
}

async function addTeacherAssignment(teacherId, classId, subjectId) {
    const { error } = await sb
        .from(TABLES.teacher_assignments)
        .insert({ teacher_id: teacherId, class_id: classId, subject_id: subjectId });
    if (error) return false;
    showToast('تم تعيين المعلم', 'success');
    return true;
}

async function removeTeacherAssignment(id) {
    const { error } = await sb.from(TABLES.teacher_assignments).delete().eq('id', id);
    if (error) return false;
    showToast('تم إزالة التعيين', 'success');
    return true;
}

// ==================== دوال الامتحانات ====================

async function fetchExams(filters = {}) {
    let query = sb.from(TABLES.exams).select(`
        *,
        classes:${TABLES.classes}(id, name),
        subjects:${TABLES.subjects}(id, name),
        users:${TABLES.users}!exam_exams_teacher_id_fkey(id, name, username)
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
    const { data, error } = await sb.from(TABLES.exams).insert(examData).select().single();
    if (error) return null;
    showToast('تم إنشاء الامتحان', 'success');
    return data;
}

async function updateExam(examId, examData) {
    const { error } = await sb.from(TABLES.exams).update(examData).eq('id', examId);
    if (error) return false;
    showToast('تم تحديث الامتحان', 'success');
    return true;
}

async function updateExamStatusInDB(examId, status) {
    const { error } = await sb.from(TABLES.exams).update({ status }).eq('id', examId);
    if (error) return false;
    showToast(`تم ${status === 'published' ? 'نشر' : status === 'closed' ? 'إغلاق' : 'حفظ'} الامتحان`, 'success');
    return true;
}

async function deleteExam(id) {
    const { error } = await sb.from(TABLES.exams).delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف الامتحان', 'success');
    return true;
}

async function fetchExamQuestions(examId) {
    const { data, error } = await sb
        .from(TABLES.exam_questions)
        .select(`*, questions:${TABLES.questions}(*)`)
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });
    
    if (error) return [];
    return data || [];
}

async function addQuestionToExam(examId, questionId, points, orderIndex) {
    const { error } = await sb
        .from(TABLES.exam_questions)
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

// ==================== دوال الأسئلة ====================

async function fetchQuestions(filters = {}) {
    let query = sb.from(TABLES.questions).select('*');
    
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

async function fetchTeacherQuestions(teacherId, filters = {}) {
    let query = sb.from(TABLES.questions).select('*');
    
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

async function createQuestion(questionData) {
    const { data, error } = await sb.from(TABLES.questions).insert(questionData).select().single();
    if (error) return null;
    showToast('تم إضافة السؤال', 'success');
    return data;
}

async function updateQuestionStatus(id, status, feedback = null) {
    const updateData = { status };
    if (feedback) updateData.feedback = feedback;
    const { error } = await sb.from(TABLES.questions).update(updateData).eq('id', id);
    if (error) return false;
    showToast(`تم ${status === 'approved' ? 'اعتماد' : 'رفض'} السؤال`, 'success');
    return true;
}

async function deleteQuestion(id) {
    const { error } = await sb.from(TABLES.questions).delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف السؤال', 'success');
    return true;
}

// ==================== دوال المجموعات ====================

async function fetchGroups(filters = {}) {
    let query = sb.from(TABLES.groups).select(`
        *,
        classes:${TABLES.classes}(id, name),
        subjects:${TABLES.subjects}(id, name),
        users:${TABLES.users}!exam_groups_teacher_id_fkey(id, name, username)
    `);
    
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    
    for (const group of data) {
        const { count } = await sb
            .from(TABLES.group_members)
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('status', 'approved');
        group.member_count = count || 0;
    }
    
    return data;
}

async function createGroup(groupData) {
    const { data, error } = await sb.from(TABLES.groups).insert(groupData).select().single();
    if (error) return null;
    showToast('تم إنشاء المجموعة', 'success');
    return data;
}

async function updateGroup(id, groupData) {
    const { error } = await sb.from(TABLES.groups).update(groupData).eq('id', id);
    if (error) return false;
    showToast('تم تعديل المجموعة', 'success');
    return true;
}

async function deleteGroup(id) {
    const { error } = await sb.from(TABLES.groups).delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف المجموعة', 'success');
    return true;
}

async function joinGroup(groupId, studentId) {
    const { data: existing } = await sb
        .from(TABLES.group_members)
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
        .from(TABLES.group_members)
        .insert({ group_id: groupId, student_id: studentId, status: 'pending' })
        .select()
        .single();
    
    if (error) return { success: false, error: error.message };
    showToast('تم إرسال طلب الانضمام', 'success');
    return { success: true, data };
}

async function updateGroupMemberStatus(groupId, studentId, status) {
    const { error } = await sb
        .from(TABLES.group_members)
        .update({ status, joined_at: status === 'approved' ? new Date() : null })
        .eq('group_id', groupId)
        .eq('student_id', studentId);
    
    if (error) return false;
    showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, 'success');
    return true;
}

async function fetchGroupMembers(groupId) {
    const { data, error } = await sb
        .from(TABLES.group_members)
        .select(`*, users:${TABLES.users}!exam_group_members_student_id_fkey(id, name, phone)`)
        .eq('group_id', groupId);
    if (error) return [];
    return data;
}

async function fetchStudentGroupMemberships(studentId) {
    const { data, error } = await sb
        .from(TABLES.group_members)
        .select(`*, groups:${TABLES.groups}(*)`)
        .eq('student_id', studentId);
    
    if (error) return [];
    return data || [];
}

// ==================== دوال محاولات الامتحان ====================

async function startExamAttempt(examId, studentId) {
    const { data: existing } = await sb
        .from(TABLES.attempts)
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .eq('status', 'in_progress')
        .maybeSingle();
    
    if (existing) {
        return existing;
    }
    
    const { data, error } = await sb
        .from(TABLES.attempts)
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

async function saveAnswerToAttempt(attemptId, questionId, answer) {
    const { data: attempt } = await sb
        .from(TABLES.attempts)
        .select('answers')
        .eq('id', attemptId)
        .single();
    
    const answers = attempt?.answers || {};
    answers[questionId] = answer;
    
    const { error } = await sb
        .from(TABLES.attempts)
        .update({ answers: answers })
        .eq('id', attemptId);
    
    return !error;
}

async function submitExamAttempt(attemptId, answers, score, totalPoints) {
    const { error } = await sb
        .from(TABLES.attempts)
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

async function fetchExamAttempts(filters = {}) {
    let query = sb.from(TABLES.attempts).select(`
        *,
        exams:${TABLES.exams}(*),
        users:${TABLES.users}!exam_attempts_student_id_fkey(id, name, phone)
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

// ==================== دوال الطلبات ====================

async function createExamRequest(studentId, examId) {
    const { data: existing } = await sb
        .from(TABLES.requests)
        .select('*')
        .eq('student_id', studentId)
        .eq('exam_id', examId)
        .maybeSingle();
    
    if (existing) {
        showToast('لديك طلب سابق لهذا الامتحان', 'warning');
        return null;
    }
    
    const { data, error } = await sb
        .from(TABLES.requests)
        .insert({
            student_id: studentId,
            exam_id: examId,
            status: 'pending_admin'
        })
        .select()
        .single();
    
    if (error) return null;
    showToast('تم إرسال طلب الاشتراك', 'success');
    return data;
}

async function fetchExamRequests(filters = {}) {
    let query = sb.from(TABLES.requests).select(`
        *,
        exam:${TABLES.exams}(*),
        student:${TABLES.users}!exam_requests_student_id_fkey(id, name, phone),
        approver:${TABLES.users}!exam_requests_approved_by_fkey(id, name)
    `);
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.student_id) {
        query = query.eq('student_id', filters.student_id);
    }
    if (filters.exam_id) {
        query = query.eq('exam_id', filters.exam_id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
}

async function updateExamRequestStatus(requestId, status, rejectionReason = null) {
    const updateData = { status };
    if (status === 'approved') {
        updateData.approved_at = new Date();
        const user = getUser();
        if (user) updateData.approved_by = user.id;
    }
    if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
    }
    
    const { error } = await sb
        .from(TABLES.requests)
        .update(updateData)
        .eq('id', requestId);
    
    if (error) return false;
    
    if (status === 'approved') {
        const { data: request } = await sb
            .from(TABLES.requests)
            .select('exam_id, student_id')
            .eq('id', requestId)
            .single();
        
        if (request) {
            await sb
                .from(TABLES.enrollments)
                .insert({
                    exam_id: request.exam_id,
                    student_id: request.student_id,
                    exam_request_id: requestId,
                    enrolled_at: new Date()
                });
        }
    }
    
    showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, 'success');
    return true;
}

async function approveAllExamRequests(examId) {
    const { data: requests, error } = await sb
        .from(TABLES.requests)
        .select('id')
        .eq('exam_id', examId)
        .eq('status', 'pending_admin');
    
    if (error) return false;
    
    for (const request of requests) {
        await updateExamRequestStatus(request.id, 'approved');
    }
    
    showToast(`تم قبول ${requests.length} طلب`, 'success');
    return true;
}

// ==================== دوال المدفوعات والكوبونات ====================

async function fetchPayments(filters = {}) {
    let query = sb.from(TABLES.payments).select(`
        *,
        student:${TABLES.users}!exam_payments_student_id_fkey(id, name, phone),
        exam:${TABLES.exams}!exam_payments_exam_id_fkey(id, title),
        payment_method:${TABLES.payment_methods}(id, name),
        confirmer:${TABLES.users}!exam_payments_confirmed_by_fkey(id, name)
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
    if (error) return [];
    return data || [];
}

async function confirmPayment(paymentId, status, rejectionReason = null) {
    const user = getUser();
    const updateData = { 
        status: status,
        confirmed_by: user?.id,
        confirmed_at: new Date()
    };
    if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
    }
    
    const { error } = await sb
        .from(TABLES.payments)
        .update(updateData)
        .eq('id', paymentId);
    
    if (error) return false;
    
    if (status === 'confirmed') {
        const { data: payment } = await sb
            .from(TABLES.payments)
            .select('exam_request_id')
            .eq('id', paymentId)
            .single();
        
        if (payment && payment.exam_request_id) {
            await updateExamRequestStatus(payment.exam_request_id, 'approved');
        }
    }
    
    showToast(`تم ${status === 'confirmed' ? 'تأكيد' : 'رفض'} الدفع`, 'success');
    return true;
}

async function fetchPaymentMethods() {
    const { data, error } = await sb
        .from(TABLES.payment_methods)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
    
    if (error) return [];
    return data || [];
}

async function addPaymentMethod(methodData) {
    const user = getUser();
    const { error } = await sb
        .from(TABLES.payment_methods)
        .insert({
            ...methodData,
            created_by: user?.id,
            created_at: new Date()
        });
    
    if (error) return false;
    showToast('تم إضافة طريقة الدفع', 'success');
    return true;
}

async function deletePaymentMethod(methodId) {
    const { error } = await sb
        .from(TABLES.payment_methods)
        .delete()
        .eq('id', methodId);
    
    if (error) return false;
    showToast('تم حذف طريقة الدفع', 'success');
    return true;
}

async function fetchCoupons(filters = {}) {
    let query = sb.from(TABLES.coupons).select('*');
    
    if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
    }
    if (filters.target_exam_id) {
        query = query.eq('target_exam_id', filters.target_exam_id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
}

async function createCoupon(couponData) {
    const user = getUser();
    const { error } = await sb
        .from(TABLES.coupons)
        .insert({
            ...couponData,
            created_by: user?.id,
            created_at: new Date()
        });
    
    if (error) return false;
    showToast('تم إنشاء الكوبون', 'success');
    return true;
}

async function validateCoupon(code, examId, studentId) {
    const { data: coupon, error } = await sb
        .from(TABLES.coupons)
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();
    
    if (error || !coupon) {
        return { valid: false, message: 'الكوبون غير صالح' };
    }
    
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        return { valid: false, message: 'الكوبون لم يبدأ بعد' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        return { valid: false, message: 'انتهت صلاحية الكوبون' };
    }
    
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        return { valid: false, message: 'تم استخدام الكوبون الحد الأقصى' };
    }
    
    if (coupon.target_exam_id && coupon.target_exam_id !== examId) {
        return { valid: false, message: 'هذا الكوبون غير صالح لهذا الامتحان' };
    }
    
    if (coupon.target_students) {
        try {
            const targetStudents = JSON.parse(coupon.target_students);
            if (targetStudents.length > 0 && !targetStudents.includes(studentId)) {
                return { valid: false, message: 'هذا الكوبون غير صالح لك' };
            }
        } catch(e) {
            // إذا كانت target_students نص عادي، تجاهل
        }
    }
    
    return { valid: true, coupon: coupon };
}

// ==================== دوال الإشعارات ====================

async function fetchNotifications(userId, limit = 20) {
    const { data, error } = await sb
        .from(TABLES.notifications)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) return [];
    return data || [];
}

async function markNotificationAsRead(notificationId) {
    const { error } = await sb
        .from(TABLES.notifications)
        .update({ is_read: true })
        .eq('id', notificationId);
    
    return !error;
}

async function markAllNotificationsAsRead(userId) {
    const { error } = await sb
        .from(TABLES.notifications)
        .update({ is_read: true })
        .eq('user_id', userId);
    
    return !error;
}

async function addNotification(userId, title, message, type, relatedId = null) {
    const { error } = await sb
        .from(TABLES.notifications)
        .insert({
            user_id: userId,
            title: title,
            message: message,
            type: type,
            related_id: relatedId,
            created_at: new Date()
        });
    
    return !error;
}

// ==================== دوال الإحصائيات ====================

async function fetchAdminStats() {
    const [users, exams, pendingQuestions, attempts] = await Promise.all([
        sb.from(TABLES.users).select('*', { count: 'exact', head: true }),
        sb.from(TABLES.exams).select('*', { count: 'exact', head: true }),
        sb.from(TABLES.questions).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from(TABLES.attempts).select('*', { count: 'exact', head: true })
    ]);
    
    const { data: teachers } = await sb.from(TABLES.users).select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    const { data: students } = await sb.from(TABLES.users).select('*', { count: 'exact', head: true }).eq('role', 'student');
    
    return {
        totalUsers: users.count || 0,
        totalTeachers: teachers?.count || 0,
        totalStudents: students?.count || 0,
        totalExams: exams.count || 0,
        pendingQuestions: pendingQuestions.count || 0,
        totalAttempts: attempts.count || 0
    };
}

async function fetchTeacherStats(teacherId) {
    try {
        const [exams, questions, groups] = await Promise.all([
            sb.from(TABLES.exams).select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
            sb.from(TABLES.questions).select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
            sb.from(TABLES.groups).select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId)
        ]);
        
        const assignments = await fetchTeacherAssignments(teacherId);
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        let totalStudents = 0;
        
        if (classIds.length > 0) {
            const { count } = await sb
                .from(TABLES.users)
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

async function fetchStudentStats(studentId) {
    try {
        const [attempts, groups] = await Promise.all([
            sb.from(TABLES.attempts).select('score, total_points').eq('student_id', studentId),
            sb.from(TABLES.group_members).select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'approved')
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

async function fetchStudentDetailedStats(studentId) {
    try {
        const [attempts, groups] = await Promise.all([
            sb.from(TABLES.attempts)
                .select(`*, exams:${TABLES.exams}(title, passing_score)`)
                .eq('student_id', studentId)
                .order('submitted_at', { ascending: false }),
            sb.from(TABLES.group_members)
                .select(`*, groups:${TABLES.groups}(name, subjects:${TABLES.subjects}(name))`)
                .eq('student_id', studentId)
                .eq('status', 'approved')
        ]);
        
        let totalExams = 0;
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
        }
        
        const averageScore = totalExams > 0 ? Math.round(totalPercentage / totalExams) : 0;
        const successRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;
        
        return {
            totalExams: totalExams,
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

async function fetchExamStats(examId) {
    try {
        const [requests, enrollments, payments] = await Promise.all([
            sb.from(TABLES.requests).select('*', { count: 'exact' }).eq('exam_id', examId),
            sb.from(TABLES.enrollments).select('*', { count: 'exact' }).eq('exam_id', examId),
            sb.from(TABLES.payments).select('*', { count: 'exact' }).eq('exam_id', examId).eq('status', 'confirmed')
        ]);
        
        const pendingRequests = await sb
            .from(TABLES.requests)
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
        return { total_requests: 0, pending_count: 0, approved_count: 0, paid_count: 0 };
    }
}

async function fetchStudentsWithStats(teacherId, filters = {}) {
    try {
        const assignments = await fetchTeacherAssignments(teacherId);
        const classIds = [...new Set(assignments.map(a => a.class_id))];
        
        if (classIds.length === 0) return [];
        
        let query = sb
            .from(TABLES.users)
            .select('id, name, phone, class_id, created_at')
            .eq('role', 'student')
            .in('class_id', classIds);
        
        if (filters.classId && filters.classId !== 'all') {
            query = query.eq('class_id', parseInt(filters.classId));
        }
        
        const { data: students } = await query;
        if (!students || students.length === 0) return [];
        
        const studentIds = students.map(s => s.id);
        
        const { data: teacherExams } = await sb
            .from(TABLES.exams)
            .select('id, subject_id')
            .eq('teacher_id', teacherId);
        
        const teacherExamIds = (teacherExams || []).map(e => e.id);
        
        let allAttempts = [];
        if (teacherExamIds.length > 0) {
            const { data: attempts } = await sb
                .from(TABLES.attempts)
                .select(`*, exam:${TABLES.exams}(id, title, passing_score, subject_id)`)
                .in('student_id', studentIds)
                .in('exam_id', teacherExamIds)
                .in('status', ['submitted', 'graded']);
            allAttempts = attempts || [];
        }
        
        const result = students.map(student => {
            let attempts = allAttempts.filter(a => a.student_id === student.id);
            
            if (filters.subjectId && filters.subjectId !== 'all') {
                attempts = attempts.filter(a => a.exam?.subject_id == filters.subjectId);
            }
            
            let examCount = attempts.length;
            let avgPercentage = 0;
            let passedCount = 0;
            let totalPercentage = 0;
            
            for (const attempt of attempts) {
                if (attempt.total_points && attempt.total_points > 0) {
                    const percentage = (attempt.score / attempt.total_points) * 100;
                    totalPercentage += percentage;
                    if (percentage >= (attempt.exam?.passing_score || 50)) {
                        passedCount++;
                    }
                }
            }
            
            avgPercentage = examCount > 0 ? Math.round(totalPercentage / examCount) : 0;
            
            return {
                ...student,
                examCount,
                avgPercentage,
                passedCount,
                attempts: attempts
            };
        });
        
        return result;
        
    } catch (error) {
        console.error('Error fetching students with stats:', error);
        return [];
    }
}

async function fetchTeacherAvailableClasses(teacherId) {
    const assignments = await fetchTeacherAssignments(teacherId);
    const classIds = [...new Set(assignments.map(a => a.class_id))];
    
    if (classIds.length === 0) return [];
    
    const { data } = await sb.from(TABLES.classes).select('*').in('id', classIds).order('name');
    return data || [];
}

async function fetchTeacherAvailableSubjects(teacherId) {
    const assignments = await fetchTeacherAssignments(teacherId);
    const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
    
    if (subjectIds.length === 0) return [];
    
    const { data } = await sb.from(TABLES.subjects).select('*').in('id', subjectIds).order('name');
    return data || [];
}

// ==================== تصدير الدوال للنطاق العام ====================

window.sb = sb;
window.TABLES = TABLES;
window.setUser = setUser;
window.getUser = getUser;
window.logout = logout;
window.checkAuth = checkAuth;
window.hashPassword = hashPassword;
window.loginUser = loginUser;
window.registerStudent = registerStudent;
window.fetchUsers = fetchUsers;
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
window.resetUserPassword = resetUserPassword;
window.fetchClasses = fetchClasses;
window.createClass = createClass;
window.updateClass = updateClass;
window.deleteClass = deleteClass;
window.fetchSubjects = fetchSubjects;
window.createSubject = createSubject;
window.updateSubject = updateSubject;
window.deleteSubject = deleteSubject;
window.fetchClassSubjects = fetchClassSubjects;
window.fetchSubjectClasses = fetchSubjectClasses;
window.addSubjectToClass = addSubjectToClass;
window.removeSubjectFromClass = removeSubjectFromClass;
window.fetchTeacherAssignments = fetchTeacherAssignments;
window.addTeacherAssignment = addTeacherAssignment;
window.removeTeacherAssignment = removeTeacherAssignment;
window.fetchExams = fetchExams;
window.createExam = createExam;
window.updateExam = updateExam;
window.updateExamStatusInDB = updateExamStatusInDB;
window.deleteExam = deleteExam;
window.fetchExamQuestions = fetchExamQuestions;
window.addQuestionToExam = addQuestionToExam;
window.fetchQuestions = fetchQuestions;
window.fetchTeacherQuestions = fetchTeacherQuestions;
window.createQuestion = createQuestion;
window.updateQuestionStatus = updateQuestionStatus;
window.deleteQuestion = deleteQuestion;
window.fetchGroups = fetchGroups;
window.createGroup = createGroup;
window.updateGroup = updateGroup;
window.deleteGroup = deleteGroup;
window.joinGroup = joinGroup;
window.updateGroupMemberStatus = updateGroupMemberStatus;
window.fetchGroupMembers = fetchGroupMembers;
window.fetchStudentGroupMemberships = fetchStudentGroupMemberships;
window.startExamAttempt = startExamAttempt;
window.saveAnswerToAttempt = saveAnswerToAttempt;
window.submitExamAttempt = submitExamAttempt;
window.fetchExamAttempts = fetchExamAttempts;
window.createExamRequest = createExamRequest;
window.fetchExamRequests = fetchExamRequests;
window.updateExamRequestStatus = updateExamRequestStatus;
window.approveAllExamRequests = approveAllExamRequests;
window.fetchPayments = fetchPayments;
window.confirmPayment = confirmPayment;
window.fetchPaymentMethods = fetchPaymentMethods;
window.addPaymentMethod = addPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;
window.fetchCoupons = fetchCoupons;
window.createCoupon = createCoupon;
window.validateCoupon = validateCoupon;
window.fetchNotifications = fetchNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.addNotification = addNotification;
window.fetchAdminStats = fetchAdminStats;
window.fetchTeacherStats = fetchTeacherStats;
window.fetchStudentStats = fetchStudentStats;
window.fetchStudentDetailedStats = fetchStudentDetailedStats;
window.fetchExamStats = fetchExamStats;
window.fetchStudentsWithStats = fetchStudentsWithStats;
window.fetchTeacherAvailableClasses = fetchTeacherAvailableClasses;
window.fetchTeacherAvailableSubjects = fetchTeacherAvailableSubjects;

console.log('✅ supabase-config.js loaded successfully');