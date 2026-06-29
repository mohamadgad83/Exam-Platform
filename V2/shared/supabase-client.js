/**
 * ============================================
 * Supabase Client & Auth Module
 * Exam Platform V2
 * ============================================
 */

// Supabase configuration - يجب تعديلها حسب مشروعك
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

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

// ============================================
// Auth Module
// ============================================
const examAuth = {
    /**
     * Get current user with role info
     */
    async getUser() {
        const client = getSupabaseClient();
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) return null;
        
        // Fetch additional profile data
        const { data: profile } = await client
            .from('profiles')
            .select('role, full_name, avatar_url')
            .eq('id', user.id)
            .single();
        
        if (profile) {
            user.user_metadata = { ...user.user_metadata, ...profile };
            user.role = profile.role || 'student';
        }
        
        return user;
    },

    /**
     * Sign in with email and password
     */
    async signIn(email, password, options = {}) {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) return { data: null, error };
        
        // Update last login
        await client
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id);
        
        return { data, error: null };
    },

    /**
     * Sign up new user
     */
    async signUp(email, password, metadata = {}) {
        const client = getSupabaseClient();
        
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: metadata.full_name || '',
                    role: metadata.role || 'student'
                }
            }
        });
        
        if (error) return { data: null, error };
        
        // Create profile record
        if (data.user) {
            await client.from('profiles').insert({
                id: data.user.id,
                email: email,
                full_name: metadata.full_name || '',
                role: metadata.role || 'student',
                created_at: new Date().toISOString()
            });
            
            // If student, create student record
            if (metadata.role === 'student') {
                await client.from('exam_students').insert({
                    user_id: data.user.id,
                    full_name: metadata.full_name || '',
                    email: email,
                    created_at: new Date().toISOString()
                });
            }
        }
        
        return { data, error: null };
    },

    /**
     * Sign out
     */
    async signOut() {
        const client = getSupabaseClient();
        await client.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
    },

    /**
     * Reset password
     */
    async resetPassword(email) {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });
        return { data, error };
    },

    /**
     * Update password
     */
    async updatePassword(newPassword) {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.updateUser({
            password: newPassword
        });
        return { data, error };
    },

    /**
     * Check if admin
     */
    async isAdmin() {
        const user = await this.getUser();
        return user?.role === 'admin' || user?.user_metadata?.role === 'admin';
    },

    /**
     * Check if teacher
     */
    async isTeacher() {
        const user = await this.getUser();
        return user?.role === 'teacher' || user?.user_metadata?.role === 'teacher';
    },

    /**
     * Get current session
     */
    async getSession() {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.getSession();
        return { data, error };
    },

    /**
     * Subscribe to auth changes
     */
    onAuthStateChange(callback) {
        const client = getSupabaseClient();
        return client.auth.onAuthStateChange(callback);
    }
};

// ============================================
// Database Module
// ============================================
const examDB = {
    /**
     * Get raw Supabase client for advanced queries
     */
    client() {
        return getSupabaseClient();
    },

    /**
     * Students table
     */
    students() {
        return getSupabaseClient().from('exam_students');
    },

    /**
     * Exams table
     */
    exams() {
        return getSupabaseClient().from('exam_exams');
    },

    /**
     * Exam questions junction table
     */
    examQuestions() {
        return getSupabaseClient().from('exam_exam_questions');
    },

    /**
     * Questions bank
     */
    questionsBank() {
        return getSupabaseClient().from('exam_questions_bank');
    },

    /**
     * Exam attempts
     */
    attempts() {
        return getSupabaseClient().from('exam_attempts');
    },

    /**
     * Student answers
     */
    answers() {
        return getSupabaseClient().from('exam_student_answers');
    },

    /**
     * Subjects
     */
    subjects() {
        return getSupabaseClient().from('exam_subjects');
    },

    /**
     * Security logs
     */
    securityLogs() {
        return getSupabaseClient().from('exam_security_logs');
    },

    /**
     * Notifications
     */
    notifications() {
        return getSupabaseClient().from('exam_notifications');
    },

    /**
     * Profiles
     */
    profiles() {
        return getSupabaseClient().from('profiles');
    },

    /**
     * Generic query builder
     */
    from(table) {
        return getSupabaseClient().from(table);
    },

    /**
     * RPC call
     */
    rpc(functionName, params = {}) {
        return getSupabaseClient().rpc(functionName, params);
    },

    /**
     * Realtime subscription
     */
    subscribe(channel, callback) {
        return getSupabaseClient()
            .channel(channel)
            .on('postgres_changes', { event: '*', schema: 'public' }, callback)
            .subscribe();
    },

    /**
     * Upload file to storage
     */
    async uploadFile(bucket, path, file) {
        const { data, error } = await getSupabaseClient()
            .storage
            .from(bucket)
            .upload(path, file, { upsert: true });
        return { data, error };
    },

    /**
     * Get public URL for file
     */
    getPublicUrl(bucket, path) {
        return getSupabaseClient()
            .storage
            .from(bucket)
            .getPublicUrl(path).data.publicUrl;
    }
};

// Initialize on load
(function init() {
    // Ensure supabase library is loaded
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Please include supabase-js script.');
        return;
    }
    
    // Auto-refresh session
    getSupabaseClient().auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.removeItem('exam_backup');
        }
    });
})();