// ============================================
// supabase/functions/calculate-score/index.ts
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers });
    }

    const { exam_id, student_id, answers, time_taken } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ استخدام exam_exams
    const { data: exam, error: examError } = await supabase
      .from('exam_exams')
      .select('id, title, passing_score, max_attempts, teacher_id')
      .eq('id', exam_id)
      .single();

    if (examError) throw examError;

    // ✅ استخدام exam_exam_questions
    const { data: questions, error: questionsError } = await supabase
      .from('exam_exam_questions')
      .select(`
        question_id,
        questions:exam_questions_bank(id, correct_answer, points, explanation)
      `)
      .eq('exam_id', exam_id);

    if (questionsError) throw questionsError;

    let score = 0;
    let totalMarks = 0;
    const detailedAnswers = [];

    for (const q of questions) {
      const studentAnswer = answers[q.question_id];
      const isCorrect = studentAnswer === q.questions.correct_answer;

      if (isCorrect) {
        score += q.questions.points || 1;
      }
      totalMarks += q.questions.points || 1;

      detailedAnswers.push({
        question_id: q.question_id,
        selected_option: studentAnswer,
        correct_answer: q.questions.correct_answer,
        is_correct: isCorrect,
        marks_obtained: isCorrect ? q.questions.points : 0,
        explanation: q.questions.explanation,
      });
    }

    const passed = score >= (exam?.passing_score || 50);

    // ✅ استخدام exam_attempts
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id,
        student_id,
        score,
        total_points: totalMarks,
        answers: detailedAnswers,
        time_taken,
        status: 'graded',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // ✅ استخدام exam_notifications
    await supabase.from('exam_notifications').insert({
      user_id: student_id,
      title: passed ? 'تهانينا! لقد نجحت في الاختبار' : 'نتيجة الاختبار متاحة',
      message: `لقد حصلت على ${score}/${totalMarks} (${((score/totalMarks)*100).toFixed(1)}%)`,
      type: 'result',
      related_id: exam_id,
    });

    return new Response(JSON.stringify({
      success: true,
      data: { attempt, score, totalMarks, passed },
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
