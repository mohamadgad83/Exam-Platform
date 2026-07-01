// supabase/functions/calculate-score/index.ts
// حساب الدرجات على الخادم - منع التلاعب

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

    const { exam_id, student_id, answers, session_id } = await req.json();

    if (!exam_id || !student_id || !answers || !session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. التحقق من الجلسة - مش مفعلة
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('student_id', student_id)
      .eq('exam_id', exam_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid exam session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. التحقق من انتهاء الوقت
    const now = new Date();
    const endTime = new Date(session.end_time);
    if (now > endTime) {
      // تسجيل محاولة تسليم بعد الوقت
      await supabase.from('cheating_log').insert({
        student_id,
        exam_id,
        violation_type: 'late_submission',
        details: { submitted_at: now.toISOString(), end_time: session.end_time },
        severity: 'medium',
      });
    }

    // 3. جلب الأسئلة والإجابات الصحيحة من قاعدة البيانات (مش من الكلاينت!)
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, correct_answer, points, question_type, options')
      .eq('exam_id', exam_id);

    if (qError || !questions) {
      return new Response(
        JSON.stringify({ error: 'Failed to load questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. حساب الدرجة
    let totalScore = 0;
    let maxScore = 0;
    const detailedAnswers = [];

    for (const question of questions) {
      maxScore += question.points;
      const studentAnswer = answers[question.id];
      let isCorrect = false;
      let pointsEarned = 0;

      if (studentAnswer !== undefined && studentAnswer !== null) {
        if (question.question_type === 'mcq') {
          isCorrect = studentAnswer === question.correct_answer;
          pointsEarned = isCorrect ? question.points : 0;
        } else if (question.question_type === 'true_false') {
          isCorrect = String(studentAnswer).toLowerCase() === String(question.correct_answer).toLowerCase();
          pointsEarned = isCorrect ? question.points : 0;
        } else if (question.question_type === 'short_answer') {
          // مقارنة مرنة للإجابات المقالية
          const normalizedStudent = String(studentAnswer).trim().toLowerCase();
          const normalizedCorrect = String(question.correct_answer).trim().toLowerCase();
          isCorrect = normalizedStudent === normalizedCorrect;
          pointsEarned = isCorrect ? question.points : 0;
        } else if (question.question_type === 'essay') {
          // الإجابات المقالية بتُصحح يدوياً
          pointsEarned = 0;
          isCorrect = null; // pending manual grading
        } else if (question.question_type === 'matching') {
          isCorrect = JSON.stringify(studentAnswer) === JSON.stringify(question.correct_answer);
          pointsEarned = isCorrect ? question.points : 0;
        } else if (question.question_type === 'fill_blank') {
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
        }
      }

      totalScore += pointsEarned;

      detailedAnswers.push({
        question_id: question.id,
        student_answer: studentAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        max_points: question.points,
      });
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // 5. تحديد الدرجة (A, B, C, D, F)
    let grade = 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    // 6. التحقق من النجاح
    const { data: exam } = await supabase
      .from('exams')
      .select('passing_score')
      .eq('id', exam_id)
      .single();

    const passed = percentage >= (exam?.passing_score || 60);

    // 7. حفظ النتيجة
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
        time_taken: session.time_taken || 0,
        submitted_at: new Date().toISOString(),
        status: 'completed',
      }, { onConflict: 'exam_id,student_id' })
      .select()
      .single();

    if (resultError) throw resultError;

    // 8. حفظ الإجابات التفصيلية
    const answersToInsert = detailedAnswers.map((da) => ({
      result_id: result.id,
      question_id: da.question_id,
      student_answer: da.student_answer,
      correct_answer: da.correct_answer,
      is_correct: da.is_correct,
      points_earned: da.points_earned,
      max_points: da.max_points,
    }));

    await supabase.from('student_answers_detailed').insert(answersToInsert);

    // 9. تحديث حالة الجلسة
    await supabase
      .from('exam_sessions')
      .update({ status: 'completed', submitted_at: new Date().toISOString() })
      .eq('id', session_id);

    // 10. إنشاء شهادة لو نجح
    if (passed) {
      const { data: certExam } = await supabase
        .from('exams')
        .select('title, certificate_template_id')
        .eq('id', exam_id)
        .single();

      if (certExam?.certificate_template_id) {
        await supabase.from('certificates').insert({
          student_id,
          exam_id,
          result_id: result.id,
          template_id: certExam.certificate_template_id,
          issue_date: new Date().toISOString(),
          status: 'issued',
          verification_code: generateVerificationCode(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: totalScore,
        total_score: maxScore,
        percentage,
        grade,
        passed,
        detailed_answers: detailedAnswers,
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
