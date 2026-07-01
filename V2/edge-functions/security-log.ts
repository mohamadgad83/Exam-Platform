// supabase/functions/security-log/index.ts
// تسجيل انتهاكات الأمان والغش

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

    const body = await req.json();
    const { student_id, exam_id, violation_type, details, severity, session_id, ip_address, user_agent } = body;

    // التحقق من الحقول المطلوبة
    if (!student_id || !exam_id || !violation_type) {
      return new Response(
        JSON.stringify({ error: 'student_id, exam_id, and violation_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // أنواع الانتهاكات المسموحة
    const validViolations = [
      'tab_switch',
      'window_blur',
      'right_click',
      'copy_paste',
      'screenshot_detected',
      'multiple_faces',
      'no_face',
      'looking_away',
      'phone_detected',
      'late_submission',
      'time_manipulation',
      'unauthorized_access',
      'multiple_logins',
      'vpn_detected',
      'suspicious_activity',
      'keyboard_shortcut',
      'dev_tools_opened',
      'fullscreen_exit',
      'mouse_leave',
      'rapid_clicking',
    ];

    if (!validViolations.includes(violation_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid violation type', valid_types: validViolations }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // تحديد مستوى الخطورة تلقائياً لو مش محدد
    let finalSeverity = severity;
    if (!finalSeverity) {
      const severityMap: Record<string, string> = {
        tab_switch: 'medium',
        window_blur: 'low',
        right_click: 'low',
        copy_paste: 'medium',
        screenshot_detected: 'high',
        multiple_faces: 'high',
        no_face: 'medium',
        looking_away: 'medium',
        phone_detected: 'high',
        late_submission: 'medium',
        time_manipulation: 'high',
        unauthorized_access: 'critical',
        multiple_logins: 'high',
        vpn_detected: 'medium',
        suspicious_activity: 'high',
        keyboard_shortcut: 'low',
        dev_tools_opened: 'medium',
        fullscreen_exit: 'low',
        mouse_leave: 'low',
        rapid_clicking: 'low',
      };
      finalSeverity = severityMap[violation_type] || 'medium';
    }

    // جلب عدد الانتهاكات السابقة
    const { data: previousViolations, error: countError } = await supabase
      .from('cheating_log')
      .select('id')
      .eq('student_id', student_id)
      .eq('exam_id', exam_id)
      .eq('violation_type', violation_type);

    const violationCount = previousViolations?.length || 0;

    // تسجيل الانتهاك
    const { data: logEntry, error: insertError } = await supabase
      .from('cheating_log')
      .insert({
        student_id,
        exam_id,
        session_id: session_id || null,
        violation_type,
        details: details || {},
        severity: finalSeverity,
        violation_count: violationCount + 1,
        ip_address: ip_address || req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: user_agent || req.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // التحقق من الحاجة لتحذير أو إنهاء الامتحان
    const { data: allViolations } = await supabase
      .from('cheating_log')
      .select('severity')
      .eq('student_id', student_id)
      .eq('exam_id', exam_id);

    let actionRequired = 'none';
    let warningMessage = '';

    // حساب نقاط الخطورة
    const severityPoints: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 5 };
    let totalPoints = 0;
    allViolations?.forEach((v) => {
      totalPoints += severityPoints[v.severity] || 1;
    });

    if (totalPoints >= 10) {
      actionRequired = 'terminate';
      warningMessage = 'تم إنهاء الامتحان بسبب انتهاكات متكررة للأمان.';

      // إنهاء الجلسة
      if (session_id) {
        await supabase
          .from('exam_sessions')
          .update({ status: 'terminated', termination_reason: 'security_violations' })
          .eq('id', session_id);
      }

      // تعليق الطالب
      await supabase
        .from('profiles')
        .update({ status: 'suspended', suspension_reason: 'Exam security violations' })
        .eq('id', student_id);

    } else if (totalPoints >= 6) {
      actionRequired = 'warn';
      warningMessage = 'تحذير أخير: أي انتهاك إضافي سيؤدي لإنهاء الامتحان.';
    } else if (totalPoints >= 3) {
      actionRequired = 'warn';
      warningMessage = 'تم رصد سلوك مشبوه. يرجى الالتزام بقواعد الامتحان.';
    }

    // إرسال إشعار للمشرف
    if (finalSeverity === 'high' || finalSeverity === 'critical') {
      await supabase.from('notifications').insert({
        user_id: student_id,
        type: 'security_alert',
        title: 'تنبيه أمان',
        message: `تم رصد انتهاك أمان: ${violation_type}`,
        data: { exam_id, violation_type, severity: finalSeverity },
        read: false,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logEntry.id,
        violation_count: violationCount + 1,
        total_severity_points: totalPoints,
        action_required: actionRequired,
        warning_message: warningMessage,
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
