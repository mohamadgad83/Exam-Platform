// supabase/functions/submit-exam/index.ts
// تسليم الامتحان وحفظ الإجابات بشكل آمن

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { exam_id, student_id, answers, session_id, force_submit } = await req.json();

    // التحقق من الحقول
    if (!exam_id || !student_id || !answers || !session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: exam_id, student_id, answers, session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. التحقق من الجلسة
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('student_id', student_id)
      .eq('exam_id', exam_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired exam session', code: 'INVALID_SESSION' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. التحقق من حالة الجلسة
    if (session.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Exam already submitted', code: 'ALREADY_SUBMITTED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.status === 'terminated') {
      return new Response(
        JSON.stringify({ error: 'Exam session was terminated', code: 'SESSION_TERMINATED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. التحقق من الوقت
    const now = new Date();
    const endTime = new Date(session.end_time);
    const isTimeExpired = now > endTime;

    if (isTimeExpired && !force_submit) {
      return new Response(
        JSON.stringify({
          error: 'Exam time has expired',
          code: 'TIME_EXPIRED',
          can_force_submit: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. التحقق من إعدادات الامتحان
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, duration, passing_score, shuffle_questions, shuffle_options, allow_retake, max_attempts, certificate_template_id, status')
      .eq('id', exam_id)
      .single();

    if (examError || !exam) {
      return new Response(
        JSON.stringify({ error: 'Exam not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (exam.status !== 'published') {
      return new Response(
        JSON.stringify({ error: 'Exam is not available', code: 'EXAM_NOT_AVAILABLE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. التحقق من عدد المحاولات
    const { data: attemptCount } = await supabase
      .from('results')
      .select('id', { count: 'exact' })
      .eq('exam_id', exam_id)
      .eq('student_id', student_id);

    const attempts = attemptCount?.length || 0;
    if (!exam.allow_retake && attempts > 0) {
      return new Response(
        JSON.stringify({ error: 'Retake not allowed', code: 'NO_RETAKE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (exam.max_attempts && attempts >= exam.max_attempts) {
      return new Response(
        JSON.stringify({ error: 'Maximum attempts reached', code: 'MAX_ATTEMPTS' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. جلب الأسئلة
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, correct_answer, points, question_type, options, text')
      .eq('exam_id', exam_id);

    if (qError || !questions) {
      return new Response(
        JSON.stringify({ error: 'Failed to load questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. حساب الدرجة
    let totalScore = 0;
    let maxScore = 0;
    const detailedAnswers = [];

    for (const question of questions) {
      maxScore += question.points;
      const studentAnswer = answers[question.id];
      let isCorrect = false;
      let pointsEarned = 0;

      if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        switch (question.question_type) {
          case 'mcq':
            isCorrect = studentAnswer === question.correct_answer;
            pointsEarned = isCorrect ? question.points : 0;
            break;
          case 'true_false':
            isCorrect = String(studentAnswer).toLowerCase() === String(question.correct_answer).toLowerCase();
            pointsEarned = isCorrect ? question.points : 0;
            break;
          case 'short_answer':
            const normStudent = String(studentAnswer).trim().toLowerCase();
            const normCorrect = String(question.correct_answer).trim().toLowerCase();
            isCorrect = normStudent === normCorrect;
            pointsEarned = isCorrect ? question.points : 0;
            break;
          case 'essay':
            isCorrect = null; // pending manual grading
            pointsEarned = 0;
            break;
          case 'matching':
            isCorrect = JSON.stringify(studentAnswer) === JSON.stringify(question.correct_answer);
            pointsEarned = isCorrect ? question.points : 0;
            break;
          case 'fill_blank':
            const blanks = question.correct_answer;
            let correctBlanks = 0;
            if (Array.isArray(studentAnswer) && Array.isArray(blanks)) {
              for (let i = 0; i < blanks.length; i++) {
                if (String(studentAnswer[i]).trim().toLowerCase() === String(blanks[i]).trim().toLowerCase()) {
                  correctBlanks++;
                }
              }
              pointsEarned = (correctBlanks / blanks.length) * question.points;
              isCorrect = correctBlanks === blanks.length;
            }
            break;
          case 'ordering':
            isCorrect = JSON.stringify(studentAnswer) === JSON.stringify(question.correct_answer);
            pointsEarned = isCorrect ? question.points : 0;
            break;
        }
      }

      totalScore += pointsEarned;

      detailedAnswers.push({
        question_id: question.id,
        question_text: question.text,
        student_answer: studentAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        max_points: question.points,
        question_type: question.question_type,
      });
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // تحديد الدرجة
    let grade = 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    const passed = percentage >= (exam.passing_score || 60);

    // 8. حساب الوقت المستغرق
    const startTime = new Date(session.start_time);
    const timeTaken = Math.round((now.getTime() - startTime.getTime()) / 1000); // بالثواني

    // 9. حفظ النتيجة
    const { data: result, error: resultError } = await supabase
      .from('results')
      .upsert({
        exam_id,
        student_id,
        score: totalScore,
        total_score: maxScore,
        percentage,
        grade,
        passed,
        time_taken: timeTaken,
        submitted_at: now.toISOString(),
        status: 'completed',
        attempt_number: attempts + 1,
        session_id,
      }, { onConflict: 'exam_id,student_id' })
      .select()
      .single();

    if (resultError) throw resultError;

    // 10. حفظ الإجابات التفصيلية
    if (detailedAnswers.length > 0) {
      const answersToInsert = detailedAnswers.map((da) => ({
        result_id: result.id,
        question_id: da.question_id,
        student_answer: da.student_answer,
        correct_answer: da.correct_answer,
        is_correct: da.is_correct,
        points_earned: da.points_earned,
        max_points: da.max_points,
        question_type: da.question_type,
      }));

      await supabase.from('student_answers_detailed').insert(answersToInsert);
    }

    // 11. تحديث الجلسة
    await supabase
      .from('exam_sessions')
      .update({
        status: isTimeExpired ? 'expired' : 'completed',
        submitted_at: now.toISOString(),
        time_taken: timeTaken,
        final_score: totalScore,
      })
      .eq('id', session_id);

    // 12. تسجيل وقت انتهاء الامتحان
    if (isTimeExpired) {
      await supabase.from('cheating_log').insert({
        student_id,
        exam_id,
        violation_type: 'late_submission',
        details: { submitted_at: now.toISOString(), end_time: session.end_time, force_submit },
        severity: 'medium',
        session_id,
      });
    }

    // 13. إنشاء شهادة لو نجح
    if (passed && exam.certificate_template_id) {
      const { data: existingCert } = await supabase
        .from('certificates')
        .select('id')
        .eq('student_id', student_id)
        .eq('exam_id', exam_id)
        .single();

      if (!existingCert) {
        await supabase.from('certificates').insert({
          student_id,
          exam_id,
          result_id: result.id,
          template_id: exam.certificate_template_id,
          issue_date: now.toISOString(),
          status: 'issued',
          verification_code: generateVerificationCode(),
        });
      }
    }

    // 14. إرسال إشعار للطالب
    await supabase.from('notifications').insert({
      user_id: student_id,
      type: 'exam_completed',
      title: 'تم تسليم الامتحان',
      message: `لقد أكملت امتحان "${exam.title}" بنجاح. درجتك: ${percentage}%`,
      data: { exam_id, result_id: result.id, score: totalScore, percentage },
      read: false,
    });

    // 15. إرسال إشعار للمعلم
    const { data: examWithTeacher } = await supabase
      .from('exams')
      .select('created_by')
      .eq('id', exam_id)
      .single();

    if (examWithTeacher?.created_by) {
      await supabase.from('notifications').insert({
        user_id: examWithTeacher.created_by,
        type: 'exam_submitted',
        title: 'تم تسليم امتحان',
        message: `قام طالب بتسليم امتحان "${exam.title}"`,
        data: { exam_id, student_id, result_id: result.id },
        read: false,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        result_id: result.id,
        score: totalScore,
        total_score: maxScore,
        percentage,
        grade,
        passed,
        time_taken: timeTaken,
        detailed_answers: detailedAnswers,
        message: isTimeExpired ? 'تم التسليم بعد انتهاء الوقت' : 'تم التسليم بنجاح',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3 || i === 7) code += '-';
  }
  return code;
}
