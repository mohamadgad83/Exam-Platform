// supabase/functions/security-log/index.ts
// ============================================
// Edge Function: Log Security Violations
// ============================================
//
// WHY THIS IS NEEDED:
// - Security violations must be logged server-side (can't trust client)
// - Prevents students from deleting/modifying their own violation logs
// - Provides tamper-proof audit trail
//
// HOW TO DEPLOY:
// 1. supabase functions deploy security-log
// 2. Set secrets: supabase secrets set SERVICE_ROLE_KEY=xxx

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      exam_id, 
      student_id, 
      violations, 
      ip_address,
      user_agent,
      screen_resolution,
      timestamp 
    } = await req.json()

    // Validate
    if (!exam_id || !student_id || !violations) {
      return new Response(
        JSON.stringify({ error: 'بيانات ناقصة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Insert security log
    const { data, error } = await supabase
      .from('cheating_log')
      .insert({
        exam_id,
        student_id,
        violations: JSON.stringify(violations),
        ip_address: ip_address || req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: user_agent || req.headers.get('user-agent') || 'unknown',
        screen_resolution: screen_resolution || 'unknown',
        server_timestamp: new Date().toISOString(),
        client_timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Security log error:', error)
      return new Response(
        JSON.stringify({ error: 'فشل في تسجيل الانتهاك' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If violations exceed threshold, flag the submission
    const violationCount = Array.isArray(violations) ? violations.length : 0
    if (violationCount >= 3) {
      // Update or create flagged status
      await supabase
        .from('submissions')
        .update({ 
          flagged_for_review: true,
          flag_reason: 'Multiple security violations detected'
        })
        .eq('exam_id', exam_id)
        .eq('student_id', student_id)
    }

    // Notify teacher/admin if severe violation
    const severeViolations = ['DEVTOOLS', 'FULLSCREEN_EXIT', 'TAB_SWITCH_LIMIT']
    const hasSevere = violations.some((v: any) => 
      severeViolations.includes(v.type)
    )

    if (hasSevere) {
      // Get exam teacher
      const { data: exam } = await supabase
        .from('exams')
        .select('teacher_id, title')
        .eq('id', exam_id)
        .single()

      if (exam) {
        await supabase.from('notifications').insert({
          user_id: exam.teacher_id,
          title: '⚠️ انتهاك أمني في الامتحان',
          message: `تم رصد انتهاك أمني في امتحان "${exam.title}"`,
          type: 'security_alert',
          is_read: false,
          created_at: new Date().toISOString()
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Security log error:', err)
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
