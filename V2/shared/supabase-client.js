/**
 * ============================================
 * Supabase Client & Auth Module - MERGED V1+V2
 * Exam Platform - Uses V1's REAL database credentials
 * ============================================
 */

// ==================== V1 REAL DATABASE CREDENTIALS ====================
const SUPABASE_URL = 'https://cuchwughgvhiwgaoodib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Y2h3dWdoZ3ZoaXdnYW9vZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDUzMTUsImV4cCI6MjA5NjUyMTMxNX0.vM_wo2q8QYzdSa93wv4lAXv2q-zR1_5VXk2yfJ9pxgQ';

// Initialize Supabase client
let supabaseClient = null;

function getSupabaseClient() {
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    }
    return supabaseClient;
}

// Legacy V1 client (for backward compatibility)
const sb = getSupabaseClient();

// ==================== TABLE NAMES (V1's correct names) ====================
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

// ==================== V1 AUTH (SHA-256 - works with current DB) ====================

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
    window.location.href = '../login.html';
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loginUser(identifier, password) {
    try {
        const hashedPassword = await hashPassword(password);
        let query = sb.from(TABLES.users).select('*');

        if (/^\d+$/.test(identifier)) {
            query = query.eq('phone', identifier);
        } else {
            query = query.eq('username', identifier);
        }

        const { data, error } = await query.single();

        if (error || !data) {
            const { data: emailData, error: emailError } = await sb
                .from(TABLES.users).select('*').eq('email', identifier).single();
            if (emailError || !emailData) {
                return { success: false, error: 'المستخدم غير موجود' };
            }
            if (emailData.password_hash !== hashedPassword) {
                return { success: false, error: 'كلمة المرور غير صحيحة' };
            }
            if (emailData.status !== 'active') {
                return { success: false, error: 'الحساب غير مفعل' };
            }
            return {
                success: true,
                user: {
                    id: emailData.id, name: emailData.name, role: emailData.role,
                    email: emailData.email, phone: emailData.phone,
                    username: emailData.username, class_id: emailData.class_id,
                    status: emailData.status
                }
            };
        }

        if (data.password_hash !== hashedPassword) {
            return { success: false, error: 'كلمة المرور غير صحيحة' };
        }
        if (data.status !== 'active') {
            return { success: false, error: 'الحساب غير مفعل' };
        }

        return {
            success: true,
            user: {
                id: data.id, name: data.name, role: data.role,
                email: data.email, phone: data.phone,
                username: data.username, class_id: data.class_id,
                status: data.status
            }
        };
    } catch (error) {
        console.error('Error in loginUser:', error);
        return { success: false, error: 'حدث خطأ غير متوقع' };
    }
}

// ==================== ADMIN SUPER-POWERS ====================

function getOriginalUser() {
    try {
        const user = localStorage.getItem('originalUser');
        return user ? JSON.parse(user) : null;
    } catch (e) { return null; }
}

function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
}

function isAdminViewingAs() {
    return getOriginalUser() !== null;
}

function getEffectiveUser() {
    const current = getUser();
    if (current && current._impersonatedBy) return current;
    return current;
}

async function impersonateUser(userId) {
    if (!isAdmin()) return { success: false, error: 'غير مصرح' };
    const { data, error } = await sb.from(TABLES.users).select('*').eq('id', userId).single();
    if (error || !data) return { success: false, error: 'المستخدم غير موجود' };
    const originalUser = getUser();
    localStorage.setItem('originalUser', JSON.stringify(originalUser));
    const impersonatedUser = {
        id: data.id, name: data.name, role: data.role,
        email: data.email, phone: data.phone,
        username: data.username, class_id: data.class_id,
        status: data.status,
        _impersonatedBy: originalUser.id,
        _impersonatedByName: originalUser.name
    };
    setUser(impersonatedUser);
    return { success: true, user: impersonatedUser };
}

function stopImpersonation() {
    const originalUser = getOriginalUser();
    if (originalUser) {
        setUser(originalUser);
        localStorage.removeItem('originalUser');
        return true;
    }
    return false;
}

// ==================== V2 AUTH MODULE ====================
const examAuth = {
    async getUser() {
        const user = getUser();
        if (!user) return null;
        return { ...user, role: user.role || 'student' };
    },
    async signIn(email, password) { return loginUser(email, password); },
    async signOut() { logout(); return { error: null }; },
    async isAdmin() { return isAdmin(); },
    async isTeacher() {
        const user = getUser();
        return user && user.role === 'teacher';
    },
    async getSession() {
        const user = getUser();
        return { data: { session: user ? { user } : null }, error: null };
    },
    onAuthStateChange(callback) {
        return { data: { subscription: { unsubscribe: () => {} } } };
    }
};

// ==================== DATABASE MODULE ====================
const examDB = {
    client() { return getSupabaseClient(); },
    from(table) { return getSupabaseClient().from(table); },
    users() { return getSupabaseClient().from(TABLES.users); },
    classes() { return getSupabaseClient().from(TABLES.classes); },
    subjects() { return getSupabaseClient().from(TABLES.subjects); },
    exams() { return getSupabaseClient().from(TABLES.exams); },
    questions() { return getSupabaseClient().from(TABLES.questions); },
    examQuestions() { return getSupabaseClient().from(TABLES.exam_questions); },
    groups() { return getSupabaseClient().from(TABLES.groups); },
    groupMembers() { return getSupabaseClient().from(TABLES.group_members); },
    attempts() { return getSupabaseClient().from(TABLES.attempts); },
    notifications() { return getSupabaseClient().from(TABLES.notifications); },
    rpc(functionName, params = {}) {
        return getSupabaseClient().rpc(functionName, params);
    },
    subscribe(channel, callback) {
        return getSupabaseClient()
            .channel(channel)
            .on('postgres_changes', { event: '*', schema: 'public' }, callback)
            .subscribe();
    }
};

// ==================== DATA FETCHING ====================

async function fetchClasses() {
    try {
        const { data, error } = await sb.from(TABLES.classes).select('*').order('name');
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchSubjects() {
    try {
        const { data, error } = await sb.from(TABLES.subjects).select('*').order('name');
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchUsers(filters = {}) {
    try {
        let query = sb.from(TABLES.users).select('*');
        if (filters.role && filters.role !== 'all') query = query.eq('role', filters.role);
        if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchExams(filters = {}) {
    try {
        let query = sb.from(TABLES.exams).select('*');
        if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
        if (filters.classId && filters.classId !== 'all') query = query.eq('class_id', filters.classId);
        if (filters.subjectId && filters.subjectId !== 'all') query = query.eq('subject_id', filters.subjectId);
        if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchQuestions(filters = {}) {
    try {
        let query = sb.from(TABLES.questions).select('*');
        if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
        if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
        if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId);
        if (filters.classId && filters.classId !== 'all') query = query.eq('class_id', filters.classId);
        if (filters.subjectId && filters.subjectId !== 'all') query = query.eq('subject_id', filters.subjectId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchGroups(filters = {}) {
    try {
        let query = sb.from(TABLES.groups).select('*');
        if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchGroupMembers(groupId) {
    try {
        const { data, error } = await sb.from(TABLES.group_members).select('*').eq('group_id', groupId);
        if (error) { console.error('Error:', error); return []; }
        return data || [];
    } catch (error) { console.error('Error:', error); return []; }
}

async function fetchAdminStats() {
    try {
        const { data: users } = await sb.from(TABLES.users).select('role');
        const { data: exams } = await sb.from(TABLES.exams).select('status');
        const { data: questions } = await sb.from(TABLES.questions).select('status').eq('status', 'pending');
        const { data: groups } = await sb.from(TABLES.groups).select('id');
        const { data: attempts } = await sb.from(TABLES.attempts).select('id');

        return {
            totalUsers: users?.length || 0,
            teachers: users?.filter(u => u.role === 'teacher').length || 0,
            students: users?.filter(u => u.role === 'student').length || 0,
            totalExams: exams?.length || 0,
            pendingQuestions: questions?.length || 0,
            totalGroups: groups?.length || 0,
            totalAttempts: attempts?.length || 0
        };
    } catch (error) {
        return { totalUsers: 0, teachers: 0, students: 0, totalExams: 0, pendingQuestions: 0, totalGroups: 0, totalAttempts: 0 };
    }
}

async function fetchTeacherStats(teacherId) {
    try {
        const { data: exams } = await sb.from(TABLES.exams).select('id').eq('teacher_id', teacherId);
        const { data: questions } = await sb.from(TABLES.questions).select('id').eq('teacher_id', teacherId);
        const { data: groups } = await sb.from(TABLES.groups).select('id').eq('teacher_id', teacherId);
        return {
            totalExams: exams?.length || 0,
            totalQuestions: questions?.length || 0,
            totalGroups: groups?.length || 0
        };
    } catch (error) {
        return { totalExams: 0, totalQuestions: 0, totalGroups: 0 };
    }
}

async function fetchStudentStats(studentId) {
    try {
        const { data: attempts } = await sb.from(TABLES.attempts).select('score, total_points').eq('student_id', studentId);
        const { data: groups } = await sb.from(TABLES.group_members).select('id').eq('student_id', studentId);
        const totalAttempts = attempts?.length || 0;
        const avgScore = totalAttempts > 0
            ? Math.round(attempts.reduce((sum, a) => sum + (a.score / a.total_points * 100), 0) / totalAttempts)
            : 0;
        return { totalAttempts, totalGroups: groups?.length || 0, avgScore };
    } catch (error) {
        return { totalAttempts: 0, totalGroups: 0, avgScore: 0 };
    }
}

// ==================== EXPORTS ====================
window.sb = sb;
window.getSupabaseClient = getSupabaseClient;
window.getUser = getUser;
window.setUser = setUser;
window.logout = logout;
window.hashPassword = hashPassword;
window.loginUser = loginUser;
window.isAdmin = isAdmin;
window.isAdminViewingAs = isAdminViewingAs;
window.getEffectiveUser = getEffectiveUser;
window.impersonateUser = impersonateUser;
window.stopImpersonation = stopImpersonation;
window.examAuth = examAuth;
window.examDB = examDB;
window.TABLES = TABLES;
window.fetchClasses = fetchClasses;
window.fetchSubjects = fetchSubjects;
window.fetchUsers = fetchUsers;
window.fetchExams = fetchExams;
window.fetchQuestions = fetchQuestions;
window.fetchGroups = fetchGroups;
window.fetchGroupMembers = fetchGroupMembers;
window.fetchAdminStats = fetchAdminStats;
window.fetchTeacherStats = fetchTeacherStats;
window.fetchStudentStats = fetchStudentStats;

console.log('✅ supabase-client.js (Merged V1+V2) loaded successfully');
