-- ============================================================
-- بيانات تجريبية (Seed Data) للمنصة
-- ============================================================

-- ملاحظة: استخدم UUIDs حقيقية من Supabase Auth أو استبدلها
-- هنا بنستخدم UUIDs عشوائية للتجربة

-- ============================================================
-- 1. بيانات المستخدمين (يجب إنشاؤهم في Supabase Auth أولاً)
-- ============================================================

-- بعد إنشاء المستخدمين في Auth، استخدم UUIDs الخاصة بهم هنا
-- INSERT INTO profiles (id, full_name, email, role, phone, status) VALUES
-- ('uuid-admin-1', 'أحمد محمد', 'admin@example.com', 'admin', '0500000001', 'active'),
-- ('uuid-teacher-1', 'خالد عبدالله', 'teacher1@example.com', 'teacher', '0500000002', 'active'),
-- ('uuid-teacher-2', 'فاطمة أحمد', 'teacher2@example.com', 'teacher', '0500000003', 'active'),
-- ('uuid-student-1', 'محمد علي', 'student1@example.com', 'student', '0500000004', 'active'),
-- ('uuid-student-2', 'سارة خالد', 'student2@example.com', 'student', '0500000005', 'active'),
-- ('uuid-student-3', 'عبدالرحمن سالم', 'student3@example.com', 'student', '0500000006', 'active'),
-- ('uuid-student-4', 'نورة فهد', 'student4@example.com', 'student', '0500000007', 'active'),
-- ('uuid-student-5', 'يوسف أحمد', 'student5@example.com', 'student', '0500000008', 'active');

-- ============================================================
-- 2. الفصول الدراسية
-- ============================================================

INSERT INTO classes (id, name, grade_level, description, teacher_id, max_students, status) VALUES
('11111111-1111-1111-1111-111111111111', 'الصف الأول الثانوي - أ', '1', 'فصل الصف الأول الثانوي - المجموعة أ', NULL, 30, 'active'),
('22222222-2222-2222-2222-222222222222', 'الصف الأول الثانوي - ب', '1', 'فصل الصف الأول الثانوي - المجموعة ب', NULL, 30, 'active'),
('33333333-3333-3333-3333-333333333333', 'الصف الثاني الثانوي - أ', '2', 'فصل الصف الثاني الثانوي - المجموعة أ', NULL, 30, 'active'),
('44444444-4444-4444-4444-444444444444', 'الصف الثالث الثانوي - أ', '3', 'فصل الصف الثالث الثانوي - المجموعة أ', NULL, 30, 'active');

-- ============================================================
-- 3. قوالب الشهادات
-- ============================================================

INSERT INTO certificate_templates (id, name, description, layout_config, font_family, primary_color, secondary_color, is_active) VALUES
('cert-template-1', 'شهادة النجاح الافتراضية', 'قالب شهادة النجاح الأساسي', '{
  "header": {"text": "شهادة إتمام", "fontSize": 32},
  "body": {"text": "يشهد المركز بأن الطالب قد اجتاز الامتحان بنجاح", "fontSize": 18},
  "footer": {"text": "بتاريخ الإصدار", "fontSize": 14}
}', 'Arial', '#1a237e', '#3949ab', true),
('cert-template-2', 'شهادة التفوق', 'قالب شهادة التفوق للطلاب المتميزين', '{
  "header": {"text": "شهادة تفوق", "fontSize": 36},
  "body": {"text": "تُمنح هذه الشهادة تقديراً للتميز والإنجاز", "fontSize": 18},
  "footer": {"text": "مع خالص التهاني", "fontSize": 14}
}', 'Georgia', '#d4af37', '#1a237e', true);

-- ============================================================
-- 4. الامتحانات
-- ============================================================

INSERT INTO exams (id, title, description, subject, duration, total_questions, passing_score, status, created_by, shuffle_questions, shuffle_options, allow_retake, max_attempts, security_level, webcam_required, fullscreen_required, tab_switch_limit, auto_submit_on_violation, certificate_template_id) VALUES
('exam-math-1', 'امتحان الرياضيات - الوحدة الأولى', 'امتحان على الوحدة الأولى في الرياضيات: الأعداد الحقيقية والدوال', 'رياضيات', 60, 10, 60, 'published', NULL, true, true, false, 1, 'standard', false, false, 3, false, 'cert-template-1'),
('exam-science-1', 'امتحان العلوم - الكيمياء', 'امتحان على مبادئ الكيمياء العضوية', 'علوم', 45, 8, 50, 'published', NULL, true, true, true, 2, 'high', true, true, 2, true, 'cert-template-1'),
('exam-arabic-1', 'امتحان اللغة العربية - النحو', 'امتحان على قواعد النحو والصرف', 'لغة عربية', 90, 15, 70, 'published', NULL, false, false, false, 1, 'standard', false, false, 3, false, 'cert-template-2'),
('exam-english-1', 'English Grammar Test', 'Test on English grammar and vocabulary', 'English', 60, 12, 60, 'published', NULL, true, true, true, 3, 'standard', false, false, 3, false, 'cert-template-1'),
('exam-draft-1', 'امتحان تجريبي - مسودة', 'امتحان قيد التجهيز', 'فيزياء', 60, 10, 60, 'draft', NULL, false, false, false, 1, 'basic', false, false, 5, false, NULL);

-- ============================================================
-- 5. الأسئلة (امتحان الرياضيات)
-- ============================================================

INSERT INTO questions (id, exam_id, text, question_type, options, correct_answer, points, explanation, difficulty_level, tags) VALUES
('q-math-1', 'exam-math-1', 'ما هو حل المعادلة: 2x + 5 = 15؟', 'mcq', '["x = 5", "x = 10", "x = 7.5", "x = 20"]', 'x = 5', 10, 'نطرح 5 من الطرفين: 2x = 10، ثم نقسم على 2: x = 5', 'easy', '{"algebra","equations"}'),
('q-math-2', 'exam-math-1', 'أي من التالي يمثل دالة خطية؟', 'mcq', '["y = x² + 1", "y = 2x + 3", "y = 1/x", "y = √x"]', 'y = 2x + 3', 10, 'الدالة الخطية تأخذ الشكل y = mx + b', 'easy', '{"functions","linear"}'),
('q-math-3', 'exam-math-1', 'ما هو مجموع زوايا المثلث؟', 'mcq', '["90°", "180°", "270°", "360°"]', '180°', 10, 'مجموع زوايا أي مثلث يساوي 180 درجة', 'easy', '{"geometry","angles"}'),
('q-math-4', 'exam-math-1', 'إذا كان سعر 5 كتب 75 ريالاً، فما سعر 8 كتب؟', 'mcq', '["100 ريال", "120 ريال", "110 ريال", "130 ريال"]', '120 ريال', 15, 'سعر الكتاب الواحد = 75 ÷ 5 = 15 ريال. سعر 8 كتب = 15 × 8 = 120 ريال', 'medium', '{"proportions","word-problems"}'),
('q-math-5', 'exam-math-1', 'احسب: √144 + 3²', 'mcq', '["15", "21", "12", "18"]', '21', 15, '√144 = 12 و 3² = 9، إذن 12 + 9 = 21', 'medium', '{"roots","exponents"}'),
('q-math-6', 'exam-math-1', 'ما هو المجال (Domain) للدالة f(x) = 1/(x-2)؟', 'mcq', '["جميع الأعداد الحقيقية", "جميع الأعداد ما عدا 2", "x > 2", "x < 2"]', 'جميع الأعداد ما عدا 2', 15, 'المقام لا يمكن أن يساوي صفراً، إذن x ≠ 2', 'hard', '{"functions","domain"}'),
('q-math-7', 'exam-math-1', 'العدد π هو عدد نسبي.', 'true_false', '["صح", "خطأ"]', 'خطأ', 10, 'π هو عدد غير نسبي (irrational) لأنه لا يمكن التعبير عنه على شكل كسر', 'medium', '{"numbers","pi"}'),
('q-math-8', 'exam-math-1', 'اشرح بالتفصيل كيفية حل نظام المعادلات الخطية باستخدام طريقة الحذف.', 'essay', '[]', '', 20, 'طريقة الحذف تتضمن ضرب المعادلات بثوابت ثم جمعها أو طرحها للتخلص من أحد المتغيرات', 'hard', '{"systems","elimination"}'),
('q-math-9', 'exam-math-1', 'أكمل: الجذر التربيعي للعدد 64 يساوي ___', 'short_answer', '[]', '8', 10, '8 × 8 = 64', 'easy', '{"roots"}'),
('q-math-10', 'exam-math-1', 'رتب الأعداد التصاعدياً: 0.5, 1/3, 0.75, 2/5', 'ordering', '["1/3", "2/5", "0.5", "0.75"]', '["1/3", "2/5", "0.5", "0.75"]', 15, '1/3 ≈ 0.333, 2/5 = 0.4, 0.5, 0.75', 'medium', '{"fractions","ordering"}');

-- ============================================================
-- 6. أسئلة امتحان العلوم
-- ============================================================

INSERT INTO questions (id, exam_id, text, question_type, options, correct_answer, points, explanation, difficulty_level, tags) VALUES
('q-sci-1', 'exam-science-1', 'ما هو الرمز الكيميائي للماء؟', 'mcq', '["HO", "H₂O", "OH", "H₂O₂"]', 'H₂O', 10, 'الماء يتكون من ذرتي هيدروجين وذرة أكسجين', 'easy', '{"chemistry","water"}'),
('q-sci-2', 'exam-science-1', 'أي من التالي يعتبر مركباً عضوياً؟', 'mcq', '["NaCl", "CO₂", "CH₄", "H₂SO₄"]', 'CH₄', 10, 'CH₄ (الميثان) يحتوي على كربون وروابط C-H وهو مركب عضوي', 'medium', '{"organic","compounds"}'),
('q-sci-3', 'exam-science-1', 'التحلل الكهربائي للماء ينتج هيدروجين وأكسجين.', 'true_false', '["صح", "خطأ"]', 'صح', 10, '2H₂O → 2H₂ + O₂', 'easy', '{"electrolysis","water"}'),
('q-sci-4', 'exam-science-1', 'ما هو pH المحلول الحمضي؟', 'mcq', '["أكبر من 7", "يساوي 7", "أقل من 7", "يساوي 14"]', 'أقل من 7', 10, 'المحاليل الحمضية لها pH أقل من 7، والقاعدية أكبر من 7', 'easy', '{"ph","acids"}'),
('q-sci-5', 'exam-science-1', 'اشرح عملية البلمرة واذكر مثالاً عليها.', 'essay', '[]', '', 20, 'البلمرة هي تفاعل كيميائي يربط جزيئات صغيرة (مونومرات) لتكوين سلاسل طويلة (بوليمرات). مثال: تبلمر الإيثلين لإنتاج البولي إيثلين', 'hard', '{"polymerization","organic"}');

-- ============================================================
-- 7. أسئلة امتحان اللغة العربية
-- ============================================================

INSERT INTO questions (id, exam_id, text, question_type, options, correct_answer, points, explanation, difficulty_level, tags) VALUES
('q-arab-1', 'exam-arabic-1', '"الكتابُ مفيدٌ" - ما نوع "الكتابُ" في الجملة؟', 'mcq', '["فاعل", "مبتدأ", "خبر", "مفعول به"]', 'مبتدأ', 10, '"الكتابُ" مبتدأ مرفوع وعلامة رفعه الضمة الظاهرة', 'easy', '{"grammar","nominal-sentence"}'),
('q-arab-2', 'exam-arabic-1', 'أي الكلمات التالية مؤنث؟', 'mcq', '["قلم", "كتاب", "شمس", "بيت"]', 'شمس', 10, '"شمس" اسم مؤنث بلفظه', 'easy', '{"gender","nouns"}'),
('q-arab-3', 'exam-arabic-1', '"كتبَ الطالبُ الدرسَ" - ما نوع "الدرسَ"؟', 'mcq', '["فاعل", "مبتدأ", "خبر", "مفعول به"]', 'مفعول به', 10, '"الدرسَ" مفعول به منصوب وعلامة نصبه الفتحة الظاهرة', 'easy', '{"grammar","verbal-sentence"}'),
('q-arab-4', 'exam-arabic-1', 'صحّح الخطأ: "ذهب الطلاب إلى المدرسة وهم سعادات"', 'short_answer', '[]', 'سعداء', 10, 'الصواب "سعداء" لأن "سعادات" جمع مؤنث سالم وهنا نحتاج صفة للمذكر', 'medium', '{"grammar","adjectives"}'),
('q-arab-5', 'exam-arabic-1', 'ما هو الفرق بين "إن" و"أن"؟ اشرح بأمثلة.', 'essay', '[]', '', 20, '"إن" حرف توكيد ونصب يدخل على الجملة الاسمية فينصب المبتدأ ويرفع الخبر. "أن" مصدرية أو تفسيرية تأتي بعد أفعال القلوب والتحويل', 'hard', '{"grammar","particles"}');

-- ============================================================
-- 8. نتائج تجريبية
-- ============================================================

-- ملاحظة: استبدل UUIDs بـ UUIDs حقيقية من قاعدة البيانات
-- INSERT INTO results (id, exam_id, student_id, score, total_score, percentage, grade, passed, time_taken, submitted_at, status, attempt_number) VALUES
-- ('res-1', 'exam-math-1', 'uuid-student-1', 85, 100, 85, 'B', true, 45*60, NOW() - INTERVAL '2 days', 'completed', 1),
-- ('res-2', 'exam-math-1', 'uuid-student-2', 92, 100, 92, 'A', true, 50*60, NOW() - INTERVAL '1 day', 'completed', 1),
-- ('res-3', 'exam-math-1', 'uuid-student-3', 55, 100, 55, 'F', false, 60*60, NOW() - INTERVAL '3 days', 'completed', 1),
-- ('res-4', 'exam-science-1', 'uuid-student-1', 40, 50, 80, 'B', true, 35*60, NOW() - INTERVAL '1 day', 'completed', 1),
-- ('res-5', 'exam-science-1', 'uuid-student-4', 45, 50, 90, 'A', true, 30*60, NOW() - INTERVAL '5 hours', 'completed', 1);

-- ============================================================
-- 9. إشعارات تجريبية
-- ============================================================

-- INSERT INTO notifications (id, user_id, type, title, message, data, read) VALUES
-- ('notif-1', 'uuid-student-1', 'exam_completed', 'تم تسليم الامتحان', 'لقد أكملت امتحان الرياضيات بنجاح. درجتك: 85%', '{"exam_id": "exam-math-1", "score": 85}', true),
-- ('notif-2', 'uuid-student-1', 'exam_reminder', 'تذكير بالامتحان', 'امتحان العلوم غداً الساعة 9 صباحاً', '{"exam_id": "exam-science-1"}', false),
-- ('notif-3', 'uuid-teacher-1', 'exam_submitted', 'تم تسليم امتحان', 'قام طالب بتسليم امتحان الرياضيات', '{"exam_id": "exam-math-1", "student_id": "uuid-student-1"}', false);

-- ============================================================
-- 10. سجل غش تجريبي
-- ============================================================

-- INSERT INTO cheating_log (id, student_id, exam_id, violation_type, details, severity, violation_count, status) VALUES
-- ('cheat-1', 'uuid-student-3', 'exam-math-1', 'tab_switch', '{"count": 2, "url": "google.com"}', 'medium', 2, 'active'),
-- ('cheat-2', 'uuid-student-3', 'exam-math-1', 'window_blur', '{"duration": 5000}', 'low', 1, 'active'),
-- ('cheat-3', 'uuid-student-5', 'exam-science-1', 'copy_paste', '{"attempted": true}', 'medium', 1, 'reviewed');

-- ============================================================
-- 11. إعدادات إضافية
-- ============================================================

INSERT INTO settings (key, value, description) VALUES
('exam_default_duration', '60', 'المدة الافتراضية للامتحان بالدقائق'),
('exam_default_passing_score', '60', 'درجة النجاح الافتراضية'),
('enable_cheating_detection', 'true', 'تفعيل كشف الغش'),
('enable_webcam_monitoring', 'false', 'تفعيل مراقبة الكاميرا'),
('enable_auto_submit', 'true', 'تفعيل التسليم التلقائي'),
('max_tab_switches', '3', 'أقصى عدد لتبديل التبويبات'),
('notification_email_enabled', 'true', 'تفعيل إشعارات البريد الإلكتروني'),
('platform_contact_email', '"support@exams-platform.com"', 'بريد التواصل'),
('terms_of_service_url', '""', 'رابط شروط الخدمة'),
('privacy_policy_url', '""', 'رابط سياسة الخصوصية')
ON CONFLICT (key) DO NOTHING;
