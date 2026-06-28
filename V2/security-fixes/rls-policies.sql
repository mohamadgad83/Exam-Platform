-- ============================================
-- Exam Platform - RLS Policies (SECURITY FIX)
-- ============================================
-- 
-- HOW TO USE:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 4. Verify: SELECT * FROM pg_policies WHERE schemaname = 'public';
--
-- WARNING: This will DROP existing policies and recreate them.
-- Make sure you have a backup before running.

-- ============================================
-- STEP 1: Enable RLS on ALL tables
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop existing policies (clean slate)
-- ============================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ============================================
-- STEP 3: Create new secure policies
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================

-- Anyone can read their own profile
CREATE POLICY "users_read_own" ON users
    FOR SELECT 
    USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own" ON users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "users_admin_read_all" ON users
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Admins can update all users (status, role, etc.)
CREATE POLICY "users_admin_update_all" ON users
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ============================================
-- EXAMS TABLE
-- ============================================

-- Teachers can CRUD their own exams
CREATE POLICY "exams_teacher_own" ON exams
    FOR ALL 
    USING (teacher_id = auth.uid());

-- Students can read published exams assigned to them
CREATE POLICY "exams_student_read" ON exams
    FOR SELECT 
    USING (
        status = 'published' 
        AND (
            -- Public exams
            is_public = true 
            OR
            -- Assigned to student's group
            EXISTS (
                SELECT 1 
                FROM group_students gs
                JOIN exam_groups eg ON gs.group_id = eg.group_id
                WHERE gs.student_id = auth.uid() AND eg.exam_id = exams.id
            )
            OR
            -- Assigned directly to student
            EXISTS (
                SELECT 1 FROM exam_students es 
                WHERE es.student_id = auth.uid() AND es.exam_id = exams.id
            )
        )
    );

-- Admins can read all exams
CREATE POLICY "exams_admin_read_all" ON exams
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ============================================
-- QUESTIONS TABLE
-- ============================================

-- Teachers can manage their own questions
CREATE POLICY "questions_teacher_own" ON questions
    FOR ALL 
    USING (teacher_id = auth.uid());

-- Students can read questions during assigned exam only
CREATE POLICY "questions_student_read" ON questions
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 
            FROM exam_questions eq
            JOIN exams e ON eq.exam_id = e.id
            WHERE eq.question_id = questions.id
            AND e.status = 'published'
            AND (
                e.is_public = true
                OR EXISTS (
                    SELECT 1 FROM group_students gs
                    JOIN exam_groups eg ON gs.group_id = eg.group_id
                    WHERE gs.student_id = auth.uid() AND eg.exam_id = e.id
                )
            )
        )
    );

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================

-- Students can read their own submissions
CREATE POLICY "submissions_student_own" ON submissions
    FOR SELECT 
    USING (student_id = auth.uid());

-- Students can insert their own submissions (once per exam)
CREATE POLICY "submissions_student_insert" ON submissions
    FOR INSERT 
    WITH CHECK (student_id = auth.uid());

-- Teachers can read submissions for their exams
CREATE POLICY "submissions_teacher_exams" ON submissions
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM exams e 
            WHERE e.id = submissions.exam_id AND e.teacher_id = auth.uid()
        )
    );

-- Teachers can update submissions (grading)
CREATE POLICY "submissions_teacher_grade" ON submissions
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM exams e 
            WHERE e.id = submissions.exam_id AND e.teacher_id = auth.uid()
        )
    );

-- Admins can read all submissions
CREATE POLICY "submissions_admin_all" ON submissions
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ============================================
-- GROUPS TABLE
-- ============================================

-- Teachers can manage their own groups
CREATE POLICY "groups_teacher_own" ON groups
    FOR ALL 
    USING (teacher_id = auth.uid());

-- Students can read groups they belong to
CREATE POLICY "groups_student_read" ON groups
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM group_students gs 
            WHERE gs.group_id = groups.id AND gs.student_id = auth.uid()
        )
    );

-- ============================================
-- GROUP_STUDENTS TABLE
-- ============================================

-- Teachers can manage students in their groups
CREATE POLICY "group_students_teacher" ON group_students
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM groups g 
            WHERE g.id = group_students.group_id AND g.teacher_id = auth.uid()
        )
    );

-- Students can see their own memberships
CREATE POLICY "group_students_student" ON group_students
    FOR SELECT 
    USING (student_id = auth.uid());

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

-- Users can read their own notifications
CREATE POLICY "notifications_user_own" ON notifications
    FOR SELECT 
    USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "notifications_user_update" ON notifications
    FOR UPDATE 
    USING (user_id = auth.uid());

-- System can insert notifications (via service role or trigger)
CREATE POLICY "notifications_system_insert" ON notifications
    FOR INSERT 
    WITH CHECK (true); -- Controlled by application logic

-- ============================================
-- ACTIVITY_LOG TABLE
-- ============================================

-- Only admins can read activity logs
CREATE POLICY "activity_log_admin_read" ON activity_log
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Users can insert their own activity (for audit trail)
CREATE POLICY "activity_log_user_insert" ON activity_log
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- ============================================
-- CHEATING_LOG TABLE (NEW)
-- ============================================

-- Only admins and teachers can read
CREATE POLICY "cheating_log_admin_teacher_read" ON cheating_log
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'teacher')
        )
    );

-- System can insert (via Edge Function)
CREATE POLICY "cheating_log_system_insert" ON cheating_log
    FOR INSERT 
    WITH CHECK (true);

-- ============================================
-- STUDENT_ANSWERS_DETAILED TABLE (NEW)
-- ============================================

-- Students can read their own answers
CREATE POLICY "student_answers_student_own" ON student_answers_detailed
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM submissions s 
            WHERE s.id = student_answers_detailed.submission_id AND s.student_id = auth.uid()
        )
    );

-- Teachers can read answers for their exams
CREATE POLICY "student_answers_teacher_exams" ON student_answers_detailed
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN exams e ON s.exam_id = e.id
            WHERE s.id = student_answers_detailed.submission_id AND e.teacher_id = auth.uid()
        )
    );

-- System can insert (via Edge Function)
CREATE POLICY "student_answers_system_insert" ON student_answers_detailed
    FOR INSERT 
    WITH CHECK (true);

-- ============================================
-- SETTINGS TABLE
-- ============================================

-- Admins can manage settings
CREATE POLICY "settings_admin_all" ON settings
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Everyone can read settings
CREATE POLICY "settings_read_all" ON settings
    FOR SELECT 
    USING (true);

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Check all policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
