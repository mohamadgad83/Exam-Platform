// ============================================
// supabase-config.js - الملف الرئيسي
// منصة الاختبارات - Exam Platform
// ============================================

// ==================== إعدادات Supabase ====================
const SUPABASE_URL = 'https://cuchwughgvhiwgaoodib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Y2h3dWdoZ3ZoaXdnYW9vZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDUzMTUsImV4cCI6MjA5NjUyMTMxNX0.vM_wo2q8QYzdSa93wv4lAXv2q-zR1_5VXk2yfJ9pxgQ';

// إنشاء عميل Supabase
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase client initialized');

// ==================== دوال المستخدم ====================

function getUser() {
    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch (e) {
        console.error('Error getting user:', e);
        return null;
    }
}

function setUser(user) {
    try {
        localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {
        console.error('Error setting user:', e);
    }
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
    try {
        console.log('🔐 محاولة تسجيل الدخول:', identifier);
        
        const hashedPassword = await hashPassword(password);
        console.log('✅ تم تشفير كلمة المرور');
        
        // البحث عن المستخدم
        let query = sb.from('exam_users').select('*');
        
        if (/^\d+$/.test(identifier)) {
            query = query.eq('phone', identifier);
        } else {
            query = query.eq('username', identifier);
        }
        
        const { data, error } = await query.single();
        
        if (error) {
            console.error('❌ خطأ في البحث:', error);
            // محاولة البحث بالبريد الإلكتروني
            const { data: emailData, error: emailError } = await sb
                .from('exam_users')
                .select('*')
                .eq('email', identifier)
                .single();
            
            if (emailError || !emailData) {
                return { success: false, error: 'المستخدم غير موجود' };
            }
            
            // التحقق من كلمة المرور
            if (emailData.password_hash !== hashedPassword) {
                return { success: false, error: 'كلمة المرور غير صحيحة' };
            }
            
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
        
        // التحقق من كلمة المرور
        if (data.password_hash !== hashedPassword) {
            return { success: false, error: 'كلمة المرور غير صحيحة' };
        }
        
        if (data.status !== 'active') {
            return { success: false, error: 'الحساب غير مفعل' };
        }
        
        console.log('✅ تسجيل الدخول ناجح:', data.username);
        
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
    } catch (error) {
        console.error('❌ خطأ في loginUser:', error);
        return { success: false, error: 'حدث خطأ غير متوقع' };
    }
}

// ==================== دوال الصفوف ====================

async function fetchClasses() {
    try {
        console.log('📚 جاري تحميل الصفوف...');
        const { data, error } = await sb.from('exam_classes').select('*').order('name');
        if (error) {
            console.error('❌ خطأ في تحميل الصفوف:', error);
            return [];
        }
        console.log('✅ تم تحميل', data?.length || 0, 'صف');
        return data || [];
    } catch (error) {
        console.error('❌ خطأ:', error);
        return [];
    }
}

// ==================== دوال المواد ====================

async function fetchSubjects() {
    try {
        const { data, error } = await sb.from('exam_subjects').select('*').order('name');
        if (error) {
            console.error('Error fetching subjects:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

// ==================== دوال المستخدمين ====================

async function fetchUsers(filters = {}) {
    try {
        let query = sb.from('exam_users').select('*');
        
        if (filters.role && filters.role !== 'all') {
            query = query.eq('role', filters.role);
        }
        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

// ==================== دوال الامتحانات ====================

async function fetchExams(filters = {}) {
    try {
        let query = sb.from('exam_exams').select('*');
        
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
        if (error) {
            console.error('Error fetching exams:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

async function createExam(examData) {
    try {
        const { data, error } = await sb.from('exam_exams').insert(examData).select().single();
        if (error) {
            console.error('Error creating exam:', error);
            return null;
        }
        return data;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// ==================== دوال الأسئلة ====================

async function fetchQuestions(filters = {}) {
    try {
        let query = sb.from('exam_questions_bank').select('*');
        
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
        if (error) {
            console.error('Error fetching questions:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

// ==================== دوال إضافية (فارغة لتجنب الأخطاء) ====================

async function fetchTeacherAssignments() { return []; }
async function fetchClassSubjects() { return []; }
async function fetchExamRequests() { return []; }
async function updateExamRequestStatus() { return true; }
async function startExamAttempt() { return null; }
async function saveAnswerToAttempt() { return true; }
async function submitExamAttempt() { return true; }
async function fetchPaymentMethods() { return []; }
async function validateCoupon() { return { valid: false, message: 'غير متاح' }; }
async function fetchNotifications() { return []; }
async function fetchAdminStats() { return { totalUsers: 0, totalTeachers: 0, totalStudents: 0, totalExams: 0, pendingQuestions: 0, totalAttempts: 0 }; }
async function fetchTeacherStats() { return { totalExams: 0, totalQuestions: 0, totalGroups: 0, totalStudents: 0 }; }
async function fetchStudentStats() { return { totalAttempts: 0, totalGroups: 0, avgScore: 0 }; }
async function updateUserStatus() { return true; }
async function deleteUser() { return true; }
async function resetUserPassword() { return true; }
async function createClass() { return null; }
async function updateClass() { return true; }
async function deleteClass() { return true; }
async function createSubject() { return null; }
async function updateSubject() { return true; }
async function deleteSubject() { return true; }
async function addSubjectToClass() { return true; }
async function removeSubjectFromClass() { return true; }
async function addTeacherAssignment() { return true; }
async function removeTeacherAssignment() { return true; }
async function updateExamStatusInDB() { return true; }
async function deleteExam() { return true; }
async function fetchExamQuestions() { return []; }
async function addQuestionToExam() { return true; }
async function fetchTeacherQuestions() { return []; }
async function createQuestion() { return null; }
async function updateQuestionStatus() { return true; }
async function deleteQuestion() { return true; }
async function fetchGroups() { return []; }
async function createGroup() { return null; }
async function updateGroup() { return true; }
async function deleteGroup() { return true; }
async function joinGroup() { return { success: false, error: 'غير متاح' }; }
async function updateGroupMemberStatus() { return true; }
async function fetchGroupMembers() { return []; }
async function fetchStudentGroupMemberships() { return []; }
async function createExamRequest() { return null; }
async function approveAllExamRequests() { return true; }
async function fetchPayments() { return []; }
async function confirmPayment() { return true; }
async function addPaymentMethod() { return true; }
async function deletePaymentMethod() { return true; }
async function fetchCoupons() { return []; }
async function createCoupon() { return true; }
async function markNotificationAsRead() { return true; }
async function markAllNotificationsAsRead() { return true; }
async function addNotification() { return true; }
async function fetchStudentDetailedStats() { return null; }
async function fetchExamStats() { return { total_requests: 0, pending_count: 0, approved_count: 0, paid_count: 0 }; }
async function fetchStudentsWithStats() { return []; }
async function fetchTeacherAvailableClasses() { return []; }
async function fetchTeacherAvailableSubjects() { return []; }

// ==================== تصدير الدوال ====================

window.sb = sb;
window.getUser = getUser;
window.setUser = setUser;
window.logout = logout;
window.hashPassword = hashPassword;
window.loginUser = loginUser;
window.fetchClasses = fetchClasses;
window.fetchSubjects = fetchSubjects;
window.fetchUsers = fetchUsers;
window.fetchExams = fetchExams;
window.createExam = createExam;
window.fetchQuestions = fetchQuestions;
window.fetchTeacherAssignments = fetchTeacherAssignments;
window.fetchClassSubjects = fetchClassSubjects;
window.fetchExamRequests = fetchExamRequests;
window.updateExamRequestStatus = updateExamRequestStatus;
window.startExamAttempt = startExamAttempt;
window.saveAnswerToAttempt = saveAnswerToAttempt;
window.submitExamAttempt = submitExamAttempt;
window.fetchPaymentMethods = fetchPaymentMethods;
window.validateCoupon = validateCoupon;
window.fetchNotifications = fetchNotifications;
window.fetchAdminStats = fetchAdminStats;
window.fetchTeacherStats = fetchTeacherStats;
window.fetchStudentStats = fetchStudentStats;
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
window.resetUserPassword = resetUserPassword;
window.createClass = createClass;
window.updateClass = updateClass;
window.deleteClass = deleteClass;
window.createSubject = createSubject;
window.updateSubject = updateSubject;
window.deleteSubject = deleteSubject;
window.addSubjectToClass = addSubjectToClass;
window.removeSubjectFromClass = removeSubjectFromClass;
window.addTeacherAssignment = addTeacherAssignment;
window.removeTeacherAssignment = removeTeacherAssignment;
window.updateExamStatusInDB = updateExamStatusInDB;
window.deleteExam = deleteExam;
window.fetchExamQuestions = fetchExamQuestions;
window.addQuestionToExam = addQuestionToExam;
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
window.createExamRequest = createExamRequest;
window.approveAllExamRequests = approveAllExamRequests;
window.fetchPayments = fetchPayments;
window.confirmPayment = confirmPayment;
window.addPaymentMethod = addPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;
window.fetchCoupons = fetchCoupons;
window.createCoupon = createCoupon;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.addNotification = addNotification;
window.fetchStudentDetailedStats = fetchStudentDetailedStats;
window.fetchExamStats = fetchExamStats;
window.fetchStudentsWithStats = fetchStudentsWithStats;
window.fetchTeacherAvailableClasses = fetchTeacherAvailableClasses;
window.fetchTeacherAvailableSubjects = fetchTeacherAvailableSubjects;

console.log('✅ supabase-config.js loaded successfully');
console.log('✅ sb:', typeof sb);
console.log('✅ loginUser:', typeof loginUser);
console.log('✅ fetchClasses:', typeof fetchClasses);
