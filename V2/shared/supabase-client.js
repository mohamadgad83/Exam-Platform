// ============================================
// shared/supabase-client.js
// Supabase Client - مع دعم الـ Prefixes الجديدة
// ============================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

// ============================================
// التكوين - استخدم قيمك الحقيقية
// ============================================

const SUPABASE_URL = 'https://your-project.supabase.co';
// المفتاح مشفر (استخدم btoa('your_anon_key_here') لتشفيره)
const ENCODED_KEY = 'ZW5jb2RlZC1rZXktaGVyZQ=='; // 👈 استبدل هذا بمفتاحك المشفر
const SUPABASE_ANON_KEY = atob(ENCODED_KEY);

// ============================================
// إنشاء العميل الرئيسي
// ============================================

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: window.sessionStorage,
    storageKey: 'exam-platform-auth',
  },
  global: {
    headers: {
      'X-Application-Name': 'Exam Platform',
      'X-Client-Version': '3.0.0',
    },
  },
});

// ============================================
// 📚 دوال مساعدة لجداول الاختبارات (exam_*)
// ============================================

export const examDB = {
  // 👤 المستخدمون والأدوار
  users: () => supabase.from('exam_users'),
  students: () => supabase.from('exam_students'),
  teachers: () => supabase.from('exam_teachers'),
  
  // 📚 المواد والفصول
  subjects: () => supabase.from('exam_subjects'),
  classes: () => supabase.from('exam_classes'),
  grades: () => supabase.from('exam_grades'),
  stages: () => supabase.from('exam_stages'),
  
  // 📝 الاختبارات
  exams: () => supabase.from('exam_exams'),
  questions: () => supabase.from('exam_questions_bank'),
  examQuestions: () => supabase.from('exam_exam_questions'),
  
  // 📊 المحاولات والنتائج
  attempts: () => supabase.from('exam_attempts'),
  enrollments: () => supabase.from('exam_enrollments'),
  requests: () => supabase.from('exam_requests'),
  
  // 👥 المجموعات
  groups: () => supabase.from('exam_groups'),
  groupMembers: () => supabase.from('exam_group_members'),
  groupEnrollments: () => supabase.from('exam_group_enrollments'),
  
  // 💰 المدفوعات
  payments: () => supabase.from('exam_payments'),
  paymentMethods: () => supabase.from('exam_payment_methods'),
  paymentRequests: () => supabase.from('exam_payment_requests'),
  coupons: () => supabase.from('exam_coupons'),
  couponUsages: () => supabase.from('exam_coupon_usages'),
  
  // 🔔 الإشعارات
  notifications: () => supabase.from('exam_notifications'),
  
  // 🔗 العلاقات
  teacherAssignments: () => supabase.from('exam_teacher_assignments'),
  studentClasses: () => supabase.from('exam_student_classes'),
  classSubjects: () => supabase.from('exam_class_subjects'),
  
  // 📖 المنهج
  curriculum: () => supabase.from('exam_curriculum'),
  teacherCurriculum: () => supabase.from('exam_teacher_curriculum'),
  studentSubjects: () => supabase.from('exam_student_subjects'),
  
  // 📦 بنك الأسئلة
  questionBank: () => supabase.from('exam_question_bank'),
  questionShareRequests: () => supabase.from('exam_question_share_requests'),
  
  // 📝 حقول التسجيل
  registerFields: () => supabase.from('exam_register_fields'),
};

// ============================================
// 🏥 دوال مساعدة لجداول العيادة (clinic_*)
// ============================================

export const clinicDB = {
  profiles: () => supabase.from('clinic_profiles'),
  patients: () => supabase.from('clinic_patients'),
  appointments: () => supabase.from('clinic_appointments'),
  medicalRecords: () => supabase.from('clinic_medical_records'),
  settings: () => supabase.from('clinic_settings'),
  invoices: () => supabase.from('clinic_invoices'),
};

// ============================================
// 🔐 دوال المصادقة المحسنة
// ============================================

export const auth = {
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // تحديث آخر دخول في جدول exam_users
      await examDB.users()
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  async logout() {
    return supabase.auth.signOut();
  },
  
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
  
  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  },
  
  async getRole() {
    const user = await this.getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await examDB.users()
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (error) return null;
    return data?.role || 'student';
  },
  
  async getUserProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await examDB.users()
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) return null;
    return data;
  }
};

// ============================================
// 🛡️ دوال الأمان
// ============================================

// دالة لتسجيل الأحداث الأمنية
export async function logSecurityEvent(eventType, details = {}, success = true) {
  try {
    const user = await auth.getCurrentUser();
    const ip = await getClientIP();
    
    await supabase.from('security_events').insert({
      event_type: eventType,
      user_id: user?.id || null,
      ip_address: ip,
      user_agent: navigator.userAgent,
      details,
      success,
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// الحصول على IP العميل
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
}

// ============================================
// 📦 تصدير الكل
// ============================================

export default supabase;
