// supabase/functions/calculate-score/index.ts
// ============================================
// Edge Function: Calculate Exam Score Securely
// ============================================
// 
// WHY THIS IS NEEDED:
// - Client-side scoring can be manipulated (student can change their score)
// - Correct answers should NEVER be sent to client
// - This function runs on server with Service Role Key
//
// HOW TO DEPLOY:
// 1. supabase functions deploy calculate-score
// 2. Set secrets: supabase secrets set SERVICE_ROLE_KEY=xxx

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { exam_id, student_id, answers, time_taken, security_violations } = await req.json()

    // Validate inputs
    if (!exam_id || typeof exam_id !== 'number') {
      return new Response(
        JSON.stringify({ error: 'معرف الامتحان مطلوب ويجب أن يكون رقماً' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!student_id || typeof student_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'معرف الطالب مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'الإجابات مطلوبة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase with Service Role Key (server-side only!)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: { persistSession: false }
      }
    )

    // Get exam details
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, title, teacher_id, duration, total_marks, passing_score, shuffle_questions, shuffle_options')
      .eq('id', exam_id)
      .single()

    if (examError || !exam) {
      return new Response(
        JSON.stringify({ error: 'الامتحان غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if student already submitted
    const { data: existingSubmission, error: existingError } = await supabase
      .from('submissions')
      .select('id')
      .eq('exam_id', exam_id)
      .eq('student_id', student_id)
      .maybeSingle()

    if (existingSubmission) {
      return new Response(
        JSON.stringify({ error: 'لقد قمت بتسليم هذا الامتحان مسبقاً' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get correct answers (server-side only!)
    const { data: examQuestions, error: qError } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        question:questions(id, correct_answer, marks, question_text, options)
      `)
      .eq('exam_id', exam_id)

    if (qError || !examQuestions) {
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على أسئلة الامتحان' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate score
    let totalScore = 0
    let correctCount = 0
    let wrongCount = 0
    const detailedAnswers = []

    for (const eq of examQuestions) {
      const questionId = eq.question_id
      const studentAnswer = answers[questionId]
      const correctAnswer = eq.question.correct_answer
      const marks = eq.question.marks || 1

      const isCorrect = studentAnswer !== undefined && studentAnswer === correctAnswer

      if (isCorrect) {
        totalScore += marks
        correctCount++
      } else {
        wrongCount++
      }

      detailedAnswers.push({
        question_id: questionId,
        question_text: eq.question.question_text,
        selected_option: studentAnswer,
        correct_option: correctAnswer,
        is_correct: isCorrect,
        marks_obtained: isCorrect ? marks : 0,
        marks_total: marks
      })
    }

    const totalQuestions = examQuestions.length
    const unansweredCount = totalQuestions - correctCount - wrongCount
    const percentage = exam.total_marks > 0 ? (totalScore / exam.total_marks) * 100 : 0
    const passed = exam.passing_score ? totalScore >= exam.passing_score : percentage >= 50

    // Prepare submission data
    const submissionData = {
      exam_id,
      student_id,
      score: totalScore,
      total_marks: exam.total_marks,
      correct_count: correctCount,
      wrong_count: wrongCount,
      unanswered_count: unansweredCount,
      percentage: parseFloat(percentage.toFixed(2)),
      passed,
      time_taken: time_taken || 0,
      security_violations: security_violations || {},
      submitted_at: new Date().toISOString()
    }

    // Insert submission
    const { data: submission, error: submitError } = await supabase
      .from('submissions')
      .insert(submissionData)
      .select()
      .single()

    if (submitError) {
      console.error('Submission error:', submitError)
      return new Response(
        JSON.stringify({ error: 'فشل في حفظ التسليم' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert detailed answers
    const detailedWithSubmission = detailedAnswers.map(da => ({
      ...da,
      submission_id: submission.id
    }))

    const { error: detailsError } = await supabase
      .from('student_answers_detailed')
      .insert(detailedWithSubmission)

    if (detailsError) {
      console.error('Detailed answers error:', detailsError)
      // Don't fail the whole submission for this
    }

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: student_id,
      action: 'EXAM_SUBMITTED',
      details: JSON.stringify({
        exam_id,
        score: totalScore,
        percentage,
        passed
      }),
      created_at: new Date().toISOString()
    })

    // Send notification to student
    await supabase.from('notifications').insert({
      user_id: student_id,
      title: 'تم تسليم الامتحان',
      message: `لقد حصلت على ${totalScore} من ${exam.total_marks} (${percentage.toFixed(1)}%)`,
      type: 'exam_result',
      is_read: false,
      created_at: new Date().toISOString()
    })

    // Return result (without correct answers!)
    const result = {
      success: true,
      submission_id: submission.id,
      score: totalScore,
      total_marks: exam.total_marks,
      percentage: parseFloat(percentage.toFixed(2)),
      passed,
      correct_count: correctCount,
      wrong_count: wrongCount,
      unanswered_count: unansweredCount,
      time_taken: time_taken || 0
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
