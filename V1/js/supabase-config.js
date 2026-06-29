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

// ==================== دوال مساعدة ====================

function getUser() {
    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('originalUser');
    window.location.href = 'index.html';
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== دوال المصادقة ====================

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

// ==================== دوال الصفوف ====================

async function fetchClasses() {
    const { data, error } = await sb.from(TABLES.classes).select('*').order('name');
    if (error) {
        console.error('Error fetching classes:', error);
        return [];
    }
    return data || [];
}

// ==================== دوال المواد ====================

async function fetchSubjects() {
    const { data, error } = await sb.from(TABLES.subjects).select('*').order('name');
    if (error) {
        console.error('Error fetching subjects:', error);
        return [];
    }
    return data || [];
}

// ==================== دوال ربط المواد بالصفوف ====================

async function fetchClassSubjects(classId) {
    const { data, error } = await sb
        .from(TABLES.class_subjects)
        .select('*, subjects:' + TABLES.subjects + '(*)')
        .eq('class_id', classId);
    if (error) return [];
    return data || [];
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
        query = query.or('name.ilike.%' + filters.search + '%,phone.ilike.%' + filters.search + '%,email.ilike.%' + filters.search + '%,username.ilike.%' + filters.search + '%');
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
}

// ==================== دوال تعيينات المعلمين ====================

async function fetchTeacherAssignments(teacherId) {
    const { data, error } = await sb
        .from(TABLES.teacher_assignments)
        .select('*, classes:' + TABLES.classes + '(id, name), subjects:' + TABLES.subjects + '(id, name)')
        .eq('teacher_id', teacherId);
    if (error) return [];
    return data || [];
}

// ==================== دوال الامتحانات ====================

async function fetchExams(filters = {}) {
    let query = sb.from(TABLES.exams).select('*');
    
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
    return data || [];
}

async function createExam(examData) {
    const { data, error } = await sb.from(TABLES.exams).insert(examData).select().single();
    if (error) return null;
    showToast('تم إنشاء الامتحان', 'success');
    return data;
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
    return data || [];
}

async function createQuestion(questionData) {
    const { data, error } = await sb.from(TABLES.questions).insert(questionData).select().single();
    if (error) return null;
    showToast('تم إضافة السؤال', 'success');
    return data;
}

// ==================== دوال المجموعات ====================

async function fetchGroups(filters = {}) {
    let query = sb.from(TABLES.groups).select('*');
    
    if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
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

// ==================== دوال الطلبات ====================

async function fetchExamRequests(filters = {}) {
    let query = sb.from(TABLES.requests).select('*');
    
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
    showToast('تم تحديث الطلب', 'success');
    return true;
}

// ==================== دوال المدفوعات ====================

async function fetchPaymentMethods() {
    const { data, error } = await sb
        .from(TABLES.payment_methods)
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
    
    if (error) return [];
    return data || [];
}

// ==================== دوال الكوبونات ====================

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
        } catch(e) {}
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

// ==================== دوال الإحصائيات ====================

async function fetchAdminStats() {
    try {
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
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return { totalUsers: 0, totalTeachers: 0, totalStudents: 0, totalExams: 0, pendingQuestions: 0, totalAttempts: 0 };
    }
}

// ==================== تصدير الدوال للنطاق العام ====================

window.sb = sb;
window.TABLES = TABLES;
window.getUser = getUser;
window.setUser = setUser;
window.logout = logout;
window.hashPassword = hashPassword;
window.loginUser = loginUser;
window.fetchClasses = fetchClasses;
window.fetchSubjects = fetchSubjects;
window.fetchClassSubjects = fetchClassSubjects;
window.fetchUsers = fetchUsers;
window.fetchTeacherAssignments = fetchTeacherAssignments;
window.fetchExams = fetchExams;
window.createExam = createExam;
window.fetchQuestions = fetchQuestions;
window.createQuestion = createQuestion;
window.fetchGroups = fetchGroups;
window.startExamAttempt = startExamAttempt;
window.saveAnswerToAttempt = saveAnswerToAttempt;
window.submitExamAttempt = submitExamAttempt;
window.fetchExamRequests = fetchExamRequests;
window.updateExamRequestStatus = updateExamRequestStatus;
window.fetchPaymentMethods = fetchPaymentMethods;
window.validateCoupon = validateCoupon;
window.fetchNotifications = fetchNotifications;
window.fetchAdminStats = fetchAdminStats;

// دوال إضافية للتوافق مع الكود القديم
window.fetchClassesOld = fetchClasses;
window.fetchSubjectsOld = fetchSubjects;

console.log('✅ supabase-config.js loaded successfully');
