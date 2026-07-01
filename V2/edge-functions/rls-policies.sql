-- ============================================================
-- سياسات أمان RLS (Row Level Security) - للمستقبل
-- ============================================================

-- تفعيل RLS على الجداول
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. سياسات جدول profiles (الملفات الشخصية)
-- ============================================================

-- السماح للمستخدم بقراءة ملفه الشخصي فقط
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- السماح للمستخدم بتحديث ملفه الشخصي فقط
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- المشرفين يقدروا يشوفوا كل الملفات الشخصية
CREATE POLICY "Admins can read all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- المشرفين يقدروا يحدثوا كل الملفات الشخصية
CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- المعلمين يقدروا يشوفوا ملفات طلابهم فقط
CREATE POLICY "Teachers can read their students' profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'
        )
        AND role = 'student'
    );

-- ============================================================
-- 2. سياسات جدول exams (الامتحانات)
-- ============================================================

-- المشرفين يقدروا يعملوا كل حاجة
CREATE POLICY "Admins full access on exams"
    ON exams FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- المعلمين يقدروا يشوفوا امتحاناتهم فقط
CREATE POLICY "Teachers can read own exams"
    ON exams FOR SELECT
    USING (created_by = auth.uid());

-- المعلمين يقدروا يعدلوا امتحاناتهم فقط
CREATE POLICY "Teachers can update own exams"
    ON exams FOR UPDATE
    USING (created_by = auth.uid());

-- المعلمين يقدروا يحذفوا امتحاناتهم فقط
CREATE POLICY "Teachers can delete own exams"
    ON exams FOR DELETE
    USING (created_by = auth.uid());

-- المعلمين يقدروا ينشئوا امتحانات
CREATE POLICY "Teachers can create exams"
    ON exams FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')
        )
    );

-- الطلاب يقدروا يشوفوا الامتحانات المنشورة فقط
CREATE POLICY "Students can read published exams"
    ON exams FOR SELECT
    USING (
        status = 'published'
        AND EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student'
        )
    );

-- ============================================================
-- 3. سياسات جدول questions (الأسئلة)
-- ============================================================

CREATE POLICY "Admins full access on questions"
    ON questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Teachers can manage own exam questions"
    ON questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = questions.exam_id AND e.created_by = auth.uid()
        )
    );

-- الطلاب يشوفوا الأسئلة أثناء الامتحان فقط (مش الإجابات الصحيحة)
CREATE POLICY "Students can read questions during exam"
    ON questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exam_sessions es
            WHERE es.exam_id = questions.exam_id
            AND es.student_id = auth.uid()
            AND es.status = 'active'
        )
    );

-- ============================================================
-- 4. سياسات جدول results (النتائج)
-- ============================================================

-- الطالب يشوف نتيجته فقط
CREATE POLICY "Students can read own results"
    ON results FOR SELECT
    USING (student_id = auth.uid());

-- المعلم يشوف نتائج امتحاناته فقط
CREATE POLICY "Teachers can read exam results"
    ON results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = results.exam_id AND e.created_by = auth.uid()
        )
    );

-- المشرف يشوف كل النتائج
CREATE POLICY "Admins can read all results"
    ON results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Edge Functions تقدر تكتب نتائج (باستخدام service role)
CREATE POLICY "Service role can insert results"
    ON results FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update results"
    ON results FOR UPDATE
    USING (true);

-- ============================================================
-- 5. سياسات جدول exam_sessions (جلسات الامتحان)
-- ============================================================

CREATE POLICY "Students can manage own sessions"
    ON exam_sessions FOR ALL
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can read exam sessions"
    ON exam_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = exam_sessions.exam_id AND e.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can read all sessions"
    ON exam_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- 6. سياسات جدول cheating_log (سجل الغش)
-- ============================================================

-- المشرفين يشوفوا كل السجل
CREATE POLICY "Admins can read all cheating logs"
    ON cheating_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- المعلمين يشوفوا سجل غش امتحاناتهم فقط
CREATE POLICY "Teachers can read exam cheating logs"
    ON cheating_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = cheating_log.exam_id AND e.created_by = auth.uid()
        )
    );

-- Edge Functions تقدر تكتب في السجل
CREATE POLICY "Service role can insert cheating logs"
    ON cheating_log FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can update cheating logs"
    ON cheating_log FOR UPDATE
    USING (true);

-- ============================================================
-- 7. سياسات جدول certificates (الشهادات)
-- ============================================================

-- الطالب يشوف شهاداته فقط
CREATE POLICY "Students can read own certificates"
    ON certificates FOR SELECT
    USING (student_id = auth.uid());

-- المعلم يشوف شهادات امتحاناته
CREATE POLICY "Teachers can read exam certificates"
    ON certificates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = certificates.exam_id AND e.created_by = auth.uid()
        )
    );

-- المشرف يشوف كل الشهادات
CREATE POLICY "Admins can read all certificates"
    ON certificates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Edge Functions تقدر تكتب شهادات
CREATE POLICY "Service role can insert certificates"
    ON certificates FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 8. سياسات جدول notifications (الإشعارات)
-- ============================================================

-- المستخدم يشوف إشعاراته فقط
CREATE POLICY "Users can read own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- المستخدم يحدث إشعاراته فقط (تحديد كمقروء)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Edge Functions تقدر تكتب إشعارات
CREATE POLICY "Service role can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 9. سياسات جدول student_answers_detailed
-- ============================================================

-- الطالب يشوف إجاباته فقط
CREATE POLICY "Students can read own detailed answers"
    ON student_answers_detailed FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM results r
            WHERE r.id = student_answers_detailed.result_id AND r.student_id = auth.uid()
        )
    );

-- المعلم يشوف إجابات امتحاناته
CREATE POLICY "Teachers can read exam detailed answers"
    ON student_answers_detailed FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM results r
            JOIN exams e ON e.id = r.exam_id
            WHERE r.id = student_answers_detailed.result_id AND e.created_by = auth.uid()
        )
    );

-- Edge Functions تقدر تكتب
CREATE POLICY "Service role can insert detailed answers"
    ON student_answers_detailed FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 10. سياسات جدول generated_reports
-- ============================================================

CREATE POLICY "Users can read own generated reports"
    ON generated_reports FOR SELECT
    USING (generated_by = auth.uid());

CREATE POLICY "Admins can read all generated reports"
    ON generated_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Service role can insert generated reports"
    ON generated_reports FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- 11. سياسات جدول activity_log
-- ============================================================

CREATE POLICY "Admins can read activity log"
    ON activity_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can read own activity"
    ON activity_log FOR SELECT
    USING (user_id = auth.uid());

-- ============================================================
-- 12. سياسات جدول classes (الفصول)
-- ============================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on classes"
    ON classes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Teachers can read assigned classes"
    ON classes FOR SELECT
    USING (
        teacher_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Students can read their class"
    ON classes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.class_id = classes.id
        )
    );

-- ============================================================
-- 13. سياسات جدول certificate_templates
-- ============================================================

CREATE POLICY "Admins full access on certificate templates"
    ON certificate_templates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Everyone can read active templates"
    ON certificate_templates FOR SELECT
    USING (is_active = true);

-- ============================================================
-- 14. سياسات جدول settings
-- ============================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read settings"
    ON settings FOR SELECT
    USING (true);

CREATE POLICY "Admins can update settings"
    ON settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================
-- 15. سياسات جدول subscriptions
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions"
    ON subscriptions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can read all subscriptions"
    ON subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );
