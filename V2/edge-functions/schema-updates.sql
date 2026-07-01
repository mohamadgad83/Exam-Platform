-- ============================================================
-- تحديثات قاعدة البيانات - الجداول الجديدة
-- ============================================================

-- 1. جدول تفاصيل إجابات الطلاب (Student Answers Detailed)
CREATE TABLE IF NOT EXISTS student_answers_detailed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    student_answer JSONB,
    correct_answer JSONB,
    is_correct BOOLEAN,
    points_earned DECIMAL(10,2) DEFAULT 0,
    max_points DECIMAL(10,2) DEFAULT 0,
    question_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(result_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_student_answers_result ON student_answers_detailed(result_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question ON student_answers_detailed(question_id);

-- 2. جدول سجل الغش (Cheating Log)
CREATE TABLE IF NOT EXISTS cheating_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    session_id UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
    violation_type VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    violation_count INTEGER DEFAULT 1,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'reviewed', 'dismissed', 'escalated')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cheating_student ON cheating_log(student_id);
CREATE INDEX IF NOT EXISTS idx_cheating_exam ON cheating_log(exam_id);
CREATE INDEX IF NOT EXISTS idx_cheating_type ON cheating_log(violation_type);
CREATE INDEX IF NOT EXISTS idx_cheating_severity ON cheating_log(severity);
CREATE INDEX IF NOT EXISTS idx_cheating_timestamp ON cheating_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_cheating_status ON cheating_log(status);

-- 3. جدول الشهادات (Certificates)
CREATE TABLE IF NOT EXISTS certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    result_id UUID REFERENCES results(id) ON DELETE SET NULL,
    template_id UUID,
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('issued', 'revoked', 'expired', 'pending')),
    verification_code VARCHAR(20) UNIQUE,
    download_url TEXT,
    revoked_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, exam_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_exam ON certificates(exam_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(verification_code);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);

-- 4. جدول قوالب الشهادات (Certificate Templates)
CREATE TABLE IF NOT EXISTS certificate_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    background_image TEXT,
    layout_config JSONB DEFAULT '{}',
    font_family VARCHAR(100) DEFAULT 'Arial',
    primary_color VARCHAR(20) DEFAULT '#1a237e',
    secondary_color VARCHAR(20) DEFAULT '#3949ab',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول الإشعارات (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- 6. جدول التقارير المولدة (Generated Reports)
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    filename VARCHAR(500),
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_type ON generated_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON generated_reports(generated_by);

-- 7. تحديثات على جدول الامتحانات
ALTER TABLE exams ADD COLUMN IF NOT EXISTS certificate_template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS allow_retake BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS security_level VARCHAR(20) DEFAULT 'standard' CHECK (security_level IN ('basic', 'standard', 'high', 'maximum'));
ALTER TABLE exams ADD COLUMN IF NOT EXISTS webcam_required BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS fullscreen_required BOOLEAN DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS tab_switch_limit INTEGER DEFAULT 3;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS auto_submit_on_violation BOOLEAN DEFAULT false;

-- 8. تحديثات على جدول النتائج
ALTER TABLE results ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE results ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE results ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE results ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE results ADD COLUMN IF NOT EXISTS feedback TEXT;

-- 9. تحديثات على جدول الجلسات
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS time_taken INTEGER DEFAULT 0;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS final_score DECIMAL(10,2);
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(100);
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- 10. تحديثات على جدول الأسئلة
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20) DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);

-- 11. تحديثات على جدول الملفات الشخصية
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- 12. جدول سجل الأنشطة (Activity Log)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- 13. جدول الإعدادات (Settings)
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إعدادات افتراضية
INSERT INTO settings (key, value, description) VALUES
('platform_name', '"منصة الاختبارات"', 'اسم المنصة'),
('platform_logo', '""', 'رابط الشعار'),
('default_timezone', '"Asia/Riyadh"', 'المنطقة الزمنية الافتراضية'),
('default_language', '"ar"', 'اللغة الافتراضية'),
('maintenance_mode', 'false', 'وضع الصيانة'),
('registration_enabled', 'true', 'تفعيل التسجيل'),
('max_file_size', '10485760', 'أقصى حجم ملف بالبايت (10MB)'),
('allowed_file_types', '["pdf","doc","docx","jpg","png","mp4"]', 'أنواع الملفات المسموحة'),
('session_timeout', '1800', 'مهلة الجلسة بالثواني'),
('password_min_length', '8', 'أقل طول لكلمة المرور')
ON CONFLICT (key) DO NOTHING;

-- 14. دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- تطبيق الدالة على الجداول
DROP TRIGGER IF EXISTS update_student_answers_updated_at ON student_answers_detailed;
CREATE TRIGGER update_student_answers_updated_at
    BEFORE UPDATE ON student_answers_detailed
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_certificates_updated_at ON certificates;
CREATE TRIGGER update_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_certificate_templates_updated_at ON certificate_templates;
CREATE TRIGGER update_certificate_templates_updated_at
    BEFORE UPDATE ON certificate_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15. دالة لتسجيل النشاط تلقائياً
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
    VALUES (
        COALESCE(current_setting('app.current_user_id', true)::UUID, NULL),
        TG_OP,
        TG_TABLE_NAME,
        NEW.id,
        jsonb_build_object('old_data', to_jsonb(OLD), 'new_data', to_jsonb(NEW))
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 16. إضافة قيد فريد على النتائج (امتحان + طالب)
ALTER TABLE results DROP CONSTRAINT IF EXISTS unique_exam_student;
ALTER TABLE results ADD CONSTRAINT unique_exam_student UNIQUE (exam_id, student_id);

-- 17. إنشاء فهرس مركب للبحث السريع
CREATE INDEX IF NOT EXISTS idx_results_exam_student ON results(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_results_student_status ON results(student_id, status);

-- 18. جدول الاشتراكات (لو احتجنا مستقبلاً)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'free',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
