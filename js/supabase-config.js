// ============================================
// supabase-config.js - الملف الرئيسي للمشروع
// منصة الاختبارات - Exam Platform
// ============================================

// ==================== إعدادات Supabase ====================
const SUPABASE_URL = 'https://cuchwughgvhiwgaoodib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Y2h3dWdoZ3ZoaXdnYW9vZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDUzMTUsImV4cCI6MjA5NjUyMTMxNX0.vM_wo2q8QYzdSa93wv4lAXv2q-zR1_5VXk2yfJ9pxgQ';

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

// ==================== دوال المصادقة (Auth) ====================

async function loginUser(identifier, password) {
    const hashedPassword = await hashPassword(password);
    
    const { data, error } = await sb
        .from('users')
        .select('*')
        .or(`email.eq.${identifier},phone.eq.${identifier}`)
        .eq('password_hash', hashedPassword)
        .single();
    
    if (error || !data) return { success: false, error: 'بيانات الدخول غير صحيحة' };
    if (data.status !== 'active') return { success: false, error: 'الحساب غير مفعل، يرجى الانتظار حتى موافقة الأدمن' };
    
    return { 
        success: true, 
        user: { 
            id: data.id, 
            name: data.name, 
            role: data.role, 
            email: data.email, 
            phone: data.phone,
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

// ==================== دوال المستخدمين (Users) - مع صلاحيات ====================

async function fetchUsers(filters = {}, currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('users').select('*');
    
    // تطبيق الفلاتر
    if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
    }
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }
    
    // صلاحيات المعلم: يرى فقط طلابه
    if (currentUserRole === 'teacher' && currentUserId) {
        // جلب الطلاب المسجلين في صفوف/مواد هذا المعلم
        const assignments = await sb
            .from('teacher_assignments')
            .select('class_id')
            .eq('teacher_id', currentUserId);
        
        const classIds = assignments.data?.map(a => a.class_id) || [];
        
        if (classIds.length > 0) {
            const students = await sb
                .from('users')
                .select('id')
                .eq('role', 'student')
                .in('class_id', classIds);
            const studentIds = students.data?.map(s => s.id) || [];
            
            if (studentIds.length > 0) {
                query = query.in('id', studentIds);
            } else {
                return [];
            }
        } else {
            return [];
        }
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createUser(userData) {
    const hashedPassword = await hashPassword(userData.password);
    
    const { data, error } = await sb
        .from('users')
        .insert({
            name: userData.name,
            phone: userData.phone,
            email: userData.email || null,
            password_hash: hashedPassword,
            role: userData.role,
            class_id: userData.class_id || null,
            status: 'active'
        })
        .select()
        .single();
    
    if (error) return null;
    
    // إذا كان المعلم، أضف تعييناته
    if (userData.role === 'teacher' && userData.assignments) {
        for (const assignment of userData.assignments) {
            await sb.from('teacher_assignments').insert({
                teacher_id: data.id,
                class_id: assignment.class_id,
                subject_id: assignment.subject_id
            });
        }
    }
    
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

// ==================== دوال الصفوف (Classes) ====================

async function fetchClasses(currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('classes').select('*');
    
    // صلاحيات المعلم: يرى فقط الصفوف المسندة له
    if (currentUserRole === 'teacher' && currentUserId) {
        const assignments = await sb
            .from('teacher_assignments')
            .select('class_id')
            .eq('teacher_id', currentUserId);
        
        const classIds = assignments.data?.map(a => a.class_id) || [];
        if (classIds.length > 0) {
            query = query.in('id', classIds);
        } else {
            return [];
        }
    }
    
    const { data, error } = await query.order('name');
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

// ==================== دوال المواد (Subjects) ====================

async function fetchSubjects(currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('subjects').select('*');
    
    // صلاحيات المعلم: يرى فقط المواد المسندة له
    if (currentUserRole === 'teacher' && currentUserId) {
        const assignments = await sb
            .from('teacher_assignments')
            .select('subject_id')
            .eq('teacher_id', currentUserId);
        
        const subjectIds = assignments.data?.map(a => a.subject_id) || [];
        if (subjectIds.length > 0) {
            query = query.in('id', subjectIds);
        } else {
            return [];
        }
    }
    
    const { data, error } = await query.order('name');
    if (error) return [];
    return data;
}

async function createSubject(subjectData) {
    const { data, error } = await sb.from('subjects').insert(subjectData).select().single();
    if (error) return null;
    showToast('تم إضافة المادة', 'success');
    return data;
}

async function deleteSubject(id) {
    const { error } = await sb.from('subjects').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف المادة', 'success');
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
    const { data, error } = await sb
        .from('teacher_assignments')
        .insert({ teacher_id: teacherId, class_id: classId, subject_id: subjectId })
        .select()
        .single();
    if (error) return null;
    showToast('تم تعيين المعلم', 'success');
    return data;
}

async function removeTeacherAssignment(id) {
    const { error } = await sb.from('teacher_assignments').delete().eq('id', id);
    if (error) return false;
    showToast('تم إزالة التعيين', 'success');
    return true;
}

// ==================== دوال الامتحانات (Exams) ====================

async function fetchExams(filters = {}, currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('exams').select(`
        *,
        classes!exams_class_id_fkey(id, name),
        subjects!exams_subject_id_fkey(id, name),
        users!exams_teacher_id_fkey(id, name)
    `);
    
    // صلاحيات المعلم: يرى فقط امتحاناته
    if (currentUserRole === 'teacher' && currentUserId) {
        query = query.eq('teacher_id', currentUserId);
    }
    // صلاحيات الطالب: يرى فقط الامتحانات المنشورة التي تناسب صفه
    else if (currentUserRole === 'student' && currentUserId) {
        query = query.eq('status', 'published');
        const user = await sb.from('users').select('class_id').eq('id', currentUserId).single();
        if (user.data?.class_id) {
            query = query.eq('class_id', user.data.class_id);
        }
    }
    
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

async function fetchExamById(id) {
    const { data, error } = await sb
        .from('exams')
        .select('*, classes(name), subjects(name), users!exams_teacher_id_fkey(name)')
        .eq('id', id)
        .single();
    if (error) return null;
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
    showToast(`تم ${status === 'published' ? 'نشر' : status === 'closed' ? 'إغلاق' : 'حفظ'} الامتحان`, 'success');
    return true;
}

async function deleteExam(id) {
    const { error } = await sb.from('exams').delete().eq('id', id);
    if (error) return false;
    showToast('تم حذف الامتحان', 'success');
    return true;
}

// ==================== دوال طلبات الامتحان ====================

async function fetchExamRequests(filters = {}, currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('exam_requests').select(`
        *,
        users!exam_requests_student_id_fkey(id, name, phone),
        exams!exam_requests_exam_id_fkey(id, title, teacher_id, status)
    `);
    
    // صلاحيات المعلم: يرى فقط طلبات امتحاناته
    if (currentUserRole === 'teacher' && currentUserId) {
        const teacherExams = await sb
            .from('exams')
            .select('id')
            .eq('teacher_id', currentUserId);
        const examIds = teacherExams.data?.map(e => e.id) || [];
        if (examIds.length > 0) {
            query = query.in('exam_id', examIds);
        } else {
            return [];
        }
    }
    // صلاحيات الطالب: يرى فقط طلباته
    else if (currentUserRole === 'student' && currentUserId) {
        query = query.eq('student_id', currentUserId);
    }
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createExamRequest(studentId, examId) {
    const { data, error } = await sb
        .from('exam_requests')
        .insert({ student_id: studentId, exam_id: examId, status: 'pending' })
        .select()
        .single();
    if (error) return null;
    showToast('تم إرسال طلب الاشتراك، في انتظار موافقة المعلم', 'success');
    return data;
}

async function updateExamRequestStatus(requestId, status) {
    const { error } = await sb
        .from('exam_requests')
        .update({ status, approved_at: status === 'approved' ? new Date() : null })
        .eq('id', requestId);
    if (error) return false;
    showToast(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب`, 'success');
    return true;
}

// ==================== دوال الأسئلة (Questions) ====================

async function fetchQuestions(filters = {}, currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('questions').select('*, users!questions_teacher_id_fkey(id, name)');
    
    // صلاحيات المعلم: يرى فقط أسئلته
    if (currentUserRole === 'teacher' && currentUserId) {
        query = query.eq('teacher_id', currentUserId);
    }
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function createQuestion(questionData) {
    const { data, error } = await sb.from('questions').insert(questionData).select().single();
    if (error) return null;
    showToast('تم إضافة السؤال، في انتظار موافقة الأدمن', 'success');
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

// ==================== دوال المجموعات (Groups) ====================

async function fetchGroups(filters = {}, currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('groups').select(`
        *,
        classes!groups_class_id_fkey(id, name),
        subjects!groups_subject_id_fkey(id, name),
        users!groups_teacher_id_fkey(id, name)
    `);
    
    // صلاحيات المعلم: يرى فقط مجموعاته
    if (currentUserRole === 'teacher' && currentUserId) {
        query = query.eq('teacher_id', currentUserId);
    }
    // صلاحيات الطالب: يرى فقط المجموعات المفتوحة
    else if (currentUserRole === 'student') {
        query = query.eq('is_open', true);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    
    // جلب عدد الأعضاء لكل مجموعة
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
        if (existing.status === 'pending') return { success: false, error: 'لديك طلب انضمام قيد المراجعة' };
        if (existing.status === 'approved') return { success: false, error: 'أنت بالفعل عضو في هذه المجموعة' };
        return { success: false, error: 'لا يمكنك الانضمام لهذه المجموعة' };
    }
    
    const { data, error } = await sb
        .from('group_members')
        .insert({ group_id: groupId, student_id: studentId, status: 'pending' })
        .select()
        .single();
    
    if (error) return { success: false, error: error.message };
    showToast('تم إرسال طلب الانضمام، في انتظار موافقة المعلم', 'success');
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
        .select('*, users!group_members_student_id_fkey(id, name, phone, email)')
        .eq('group_id', groupId);
    if (error) return [];
    return data;
}

async function fetchGroupPendingRequests(teacherId) {
    const groups = await fetchGroups({}, 'teacher', teacherId);
    let allPending = [];
    for (const group of groups) {
        const members = await fetchGroupMembers(group.id);
        const pending = members.filter(m => m.status === 'pending');
        pending.forEach(p => {
            allPending.push({ groupId: group.id, groupName: group.name, studentId: p.student_id, studentName: p.users?.name });
        });
    }
    return allPending;
}

// ==================== دوال محاولات الامتحان ====================

async function fetchExamAttempts(filters = {}, currentUserRole = 'admin', currentUserId = null) {
    let query = sb.from('exam_attempts').select(`
        *,
        users!exam_attempts_student_id_fkey(id, name, phone),
        exams!exam_attempts_exam_id_fkey(id, title, teacher_id)
    `);
    
    // صلاحيات المعلم: يرى فقط محاولات طلابه في امتحاناته
    if (currentUserRole === 'teacher' && currentUserId) {
        const teacherExams = await sb
            .from('exams')
            .select('id')
            .eq('teacher_id', currentUserId);
        const examIds = teacherExams.data?.map(e => e.id) || [];
        if (examIds.length > 0) {
            query = query.in('exam_id', examIds);
        } else {
            return [];
        }
    }
    // صلاحيات الطالب: يرى فقط محاولاته
    else if (currentUserRole === 'student' && currentUserId) {
        query = query.eq('student_id', currentUserId);
    }
    
    if (filters.examId) {
        query = query.eq('exam_id', filters.examId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function startExamAttempt(examId, studentId) {
    const { data, error } = await sb
        .from('exam_attempts')
        .insert({ exam_id: examId, student_id: studentId, status: 'in_progress' })
        .select()
        .single();
    
    if (error) return null;
    return data;
}

async function saveAnswer(attemptId, questionId, answer) {
    const { data: attempt } = await sb
        .from('exam_attempts')
        .select('answers')
        .eq('id', attemptId)
        .single();
    
    const answers = attempt?.answers || {};
    answers[questionId] = answer;
    
    const { error } = await sb
        .from('exam_attempts')
        .update({ answers })
        .eq('id', attemptId);
    
    return !error;
}

async function submitExamAttempt(attemptId, answers, score, totalPoints) {
    const { error } = await sb
        .from('exam_attempts')
        .update({ 
            status: 'submitted', 
            submitted_at: new Date(),
            answers: answers,
            score: score,
            total_points: totalPoints
        })
        .eq('id', attemptId);
    
    if (error) return false;
    showToast('تم تسليم الامتحان بنجاح', 'success');
    return true;
}

// ==================== دوال الإشعارات ====================

async function fetchNotifications(userId, userRole) {
    let query = sb.from('notifications').select('*');
    
    if (userRole !== 'admin') {
        query = query.or(`target_role.eq.all,target_role.eq.${userRole}`);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
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

async function fetchTeacherStats(teacherId) {
    const [exams, questions, groups, assignments] = await Promise.all([
        sb.from('exams').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
        sb.from('questions').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
        sb.from('groups').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId),
        sb.from('teacher_assignments').select('*', { count: 'exact', head: true }).eq('teacher_id', teacherId)
    ]);
    
    // جلب عدد الطلاب المسجلين في صفوف المعلم
    const assignmentsData = await sb
        .from('teacher_assignments')
        .select('class_id')
        .eq('teacher_id', teacherId);
    
    let studentCount = 0;
    if (assignmentsData.data && assignmentsData.data.length > 0) {
        const classIds = assignmentsData.data.map(a => a.class_id);
        const students = await sb
            .from('student_classes')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds);
        studentCount = students.count || 0;
    }
    
    return {
        totalExams: exams.count || 0,
        totalQuestions: questions.count || 0,
        totalGroups: groups.count || 0,
        totalStudents: studentCount || 0
    };
}

async function fetchStudentStats(studentId) {
    const [attempts, groups] = await Promise.all([
        sb.from('exam_attempts').select('*', { count: 'exact', head: true }).eq('student_id', studentId),
        sb.from('group_members').select('*', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'approved')
    ]);
    
    const { data: attemptsData } = await sb
        .from('exam_attempts')
        .select('score, total_points')
        .eq('student_id', studentId)
        .eq('status', 'submitted');
    
    let avgScore = 0;
    if (attemptsData && attemptsData.length > 0) {
        const total = attemptsData.reduce((sum, a) => sum + ((a.score / a.total_points) * 100), 0);
        avgScore = Math.round(total / attemptsData.length);
    }
    
    return {
        totalAttempts: attempts.count || 0,
        totalGroups: groups.count || 0,
        avgScore: avgScore
    };
}

// ==================== دوال أسئلة الامتحان ====================

async function fetchExamQuestions(examId) {
    const { data, error } = await sb
        .from('exam_questions')
        .select('*, questions(*)')
        .eq('exam_id', examId)
        .order('order_num');
    if (error) return [];
    return data;
}

async function addQuestionToExam(examId, questionId, points, orderNum) {
    const { data, error } = await sb
        .from('exam_questions')
        .insert({ exam_id: examId, question_id: questionId, points, order_num: orderNum })
        .select()
        .single();
    if (error) return null;
    return data;
}

async function removeQuestionFromExam(examId, questionId) {
    const { error } = await sb
        .from('exam_questions')
        .delete()
        .eq('exam_id', examId)
        .eq('question_id', questionId);
    return !error;
}

// ==================== دوال تسجيل الطلاب في الصفوف ====================

async function fetchStudentClasses(studentId) {
    const { data, error } = await sb
        .from('student_classes')
        .select('*, classes(name)')
        .eq('student_id', studentId);
    if (error) return [];
    return data;
}

async function enrollStudentInClass(studentId, classId) {
    const { data, error } = await sb
        .from('student_classes')
        .insert({ student_id: studentId, class_id: classId })
        .select()
        .single();
    if (error) return null;
    return data;
}

console.log('✅ supabase-config.js loaded successfully');
