-- ============================================
-- Exam Platform - New Tables Schema
-- ============================================
--
-- Run this AFTER the existing tables are created
-- These tables are needed for security and advanced features

-- ============================================
-- CHEATING_LOG: Security violations during exams
-- ============================================
CREATE TABLE IF NOT EXISTS cheating_log (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  violations JSONB NOT NULL DEFAULT '[]',
  ip_address TEXT,
  user_agent TEXT,
  screen_resolution TEXT,
  server_timestamp TIMESTAMPTZ DEFAULT NOW(),
  client_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cheating_log_exam ON cheating_log(exam_id);
CREATE INDEX idx_cheating_log_student ON cheating_log(student_id);
CREATE INDEX idx_cheating_log_created ON cheating_log(created_at);

-- ============================================
-- STUDENT_ANSWERS_DETAILED: Detailed answer tracking
-- ============================================
CREATE TABLE IF NOT EXISTS student_answers_detailed (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT REFERENCES submissions(id) ON DELETE CASCADE,
  question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
  question_text TEXT,
  selected_option INTEGER,
  correct_option INTEGER,
  is_correct BOOLEAN DEFAULT FALSE,
  marks_obtained INTEGER DEFAULT 0,
  marks_total INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  answer_changes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_answers_submission ON student_answers_detailed(submission_id);
CREATE INDEX idx_student_answers_question ON student_answers_detailed(question_id);

-- ============================================
-- QUESTION_ATTACHMENTS: Images/videos for questions
-- ============================================
CREATE TABLE IF NOT EXISTS question_attachments (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'video', 'audio'
  file_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_attachments_question ON question_attachments(question_id);

-- ============================================
-- EXAM_TEMPLATES: Pre-made exam templates
-- ============================================
CREATE TABLE IF NOT EXISTS exam_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  subject_id BIGINT REFERENCES subjects(id),
  duration INTEGER NOT NULL DEFAULT 60,
  total_marks INTEGER NOT NULL DEFAULT 100,
  passing_score INTEGER DEFAULT 50,
  question_count INTEGER DEFAULT 20,
  shuffle_questions BOOLEAN DEFAULT TRUE,
  shuffle_options BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exam_templates_subject ON exam_templates(subject_id);
CREATE INDEX idx_exam_templates_public ON exam_templates(is_public);

-- ============================================
-- CERTIFICATES: Completion certificates
-- ============================================
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id BIGINT REFERENCES exams(id) ON DELETE CASCADE,
  submission_id BIGINT REFERENCES submissions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  percentage NUMERIC(5,2),
  passed BOOLEAN DEFAULT FALSE,
  certificate_url TEXT,
  verification_code TEXT UNIQUE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_certificates_student ON certificates(student_id);
CREATE INDEX idx_certificates_exam ON certificates(exam_id);
CREATE INDEX idx_certificates_code ON certificates(verification_code);

-- ============================================
-- ANNOUNCEMENTS: Platform-wide announcements
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all', -- 'all', 'students', 'teachers', 'admins'
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON announcements(is_active, start_date, end_date);

-- ============================================
-- EXAM_GROUPS: Link exams to groups (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS exam_groups (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT REFERENCES exams(id) ON DELETE CASCADE,
  group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, group_id)
);

CREATE INDEX idx_exam_groups_exam ON exam_groups(exam_id);
CREATE INDEX idx_exam_groups_group ON exam_groups(group_id);

-- ============================================
-- EXAM_STUDENTS: Direct exam-student assignments
-- ============================================
CREATE TABLE IF NOT EXISTS exam_students (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

CREATE INDEX idx_exam_students_exam ON exam_students(exam_id);
CREATE INDEX idx_exam_students_student ON exam_students(student_id);

-- ============================================
-- ADD NEW COLUMNS TO EXISTING TABLES
-- ============================================

-- Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'inactive'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Add columns to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_results TEXT DEFAULT 'immediately' CHECK (show_results IN ('immediately', 'after_close', 'after_date', 'manual'));
ALTER TABLE exams ADD COLUMN IF NOT EXISTS allowed_attempts INTEGER DEFAULT 1;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 50;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS negative_marking BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(3,2) DEFAULT 0;

-- Add columns to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES auth.users(id);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

-- Add columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS bloom_level TEXT DEFAULT 'remember' CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update last_login on users
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_login = NOW();
    NEW.login_count = COALESCE(OLD.login_count, 0) + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_last_login BEFORE UPDATE ON auth.users
    FOR EACH ROW WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
    EXECUTE FUNCTION update_last_login();

-- Auto-create certificate on passing exam
CREATE OR REPLACE FUNCTION create_certificate_on_pass()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.passed = TRUE AND NEW.score >= (
        SELECT passing_score FROM exams WHERE id = NEW.exam_id
    ) THEN
        INSERT INTO certificates (
            student_id, exam_id, submission_id, score, total_marks, 
            percentage, passed, verification_code
        ) VALUES (
            NEW.student_id, NEW.exam_id, NEW.id, NEW.score, NEW.total_marks,
            NEW.percentage, TRUE, 
            'CERT-' || substr(md5(random()::text), 1, 8) || '-' || NEW.id
        )
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_certificate AFTER INSERT ON submissions
    FOR EACH ROW EXECUTE FUNCTION create_certificate_on_pass();

-- ============================================
-- VERIFY CREATION
-- ============================================

SELECT 'Tables created successfully' as status;

SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('cheating_log', 'student_answers_detailed', 'question_attachments', 'exam_templates', 'certificates', 'announcements', 'exam_groups', 'exam_students')
ORDER BY table_name, ordinal_position;
