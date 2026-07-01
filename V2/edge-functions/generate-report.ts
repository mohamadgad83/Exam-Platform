// supabase/functions/generate-report/index.ts
// توليد تقارير PDF و Excel للامتحانات والنتائج

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

    const { report_type, format, exam_id, class_id, student_id, start_date, end_date, filters } = await req.json();

    if (!report_type || !format) {
      return new Response(
        JSON.stringify({ error: 'report_type and format are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let reportData: any = {};
    let filename = '';

    switch (report_type) {
      case 'exam_results':
        reportData = await generateExamResultsReport(supabase, exam_id, filters);
        filename = `exam-results-${exam_id}-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'student_progress':
        reportData = await generateStudentProgressReport(supabase, student_id, start_date, end_date);
        filename = `student-progress-${student_id}-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'class_performance':
        reportData = await generateClassPerformanceReport(supabase, class_id, start_date, end_date);
        filename = `class-performance-${class_id}-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'cheating_report':
        reportData = await generateCheatingReport(supabase, exam_id, start_date, end_date);
        filename = `cheating-report-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'question_analysis':
        reportData = await generateQuestionAnalysisReport(supabase, exam_id);
        filename = `question-analysis-${exam_id}-${new Date().toISOString().split('T')[0]}`;
        break;
      case 'certificate_report':
        reportData = await generateCertificateReport(supabase, start_date, end_date);
        filename = `certificates-${new Date().toISOString().split('T')[0]}`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid report type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    let output: string;
    let contentType: string;

    if (format === 'json') {
      output = JSON.stringify(reportData, null, 2);
      contentType = 'application/json';
      filename += '.json';
    } else if (format === 'csv') {
      output = convertToCSV(reportData);
      contentType = 'text/csv; charset=utf-8';
      filename += '.csv';
    } else if (format === 'html') {
      output = generateHTMLReport(reportData, report_type);
      contentType = 'text/html; charset=utf-8';
      filename += '.html';
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid format. Use: json, csv, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // حفظ التقرير في قاعدة البيانات
    await supabase.from('generated_reports').insert({
      report_type,
      format,
      exam_id: exam_id || null,
      class_id: class_id || null,
      student_id: student_id || null,
      generated_by: student_id || null, // يجب تمرير user_id من الـ JWT
      filename,
      data: reportData,
      created_at: new Date().toISOString(),
    });

    return new Response(output, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// تقرير نتائج الامتحان
async function generateExamResultsReport(supabase: any, examId: string, filters?: any) {
  const { data: exam } = await supabase
    .from('exams')
    .select('id, title, description, duration, passing_score, total_questions, created_at')
    .eq('id', examId)
    .single();

  const { data: results } = await supabase
    .from('results')
    .select(`
      id, score, total_score, percentage, grade, passed, time_taken, submitted_at,
      student:profiles!results_student_id_fkey(full_name, email, student_id)
    `)
    .eq('exam_id', examId)
    .order('percentage', { ascending: false });

  const { data: questions } = await supabase
    .from('questions')
    .select('id, text, question_type, points, correct_answer')
    .eq('exam_id', examId);

  const stats = {
    total_students: results?.length || 0,
    passed_count: results?.filter((r: any) => r.passed).length || 0,
    failed_count: results?.filter((r: any) => !r.passed).length || 0,
    pass_rate: results?.length ? Math.round((results.filter((r: any) => r.passed).length / results.length) * 100) : 0,
    average_score: results?.length ? Math.round(results.reduce((sum: number, r: any) => sum + r.percentage, 0) / results.length) : 0,
    highest_score: results?.length ? Math.max(...results.map((r: any) => r.percentage)) : 0,
    lowest_score: results?.length ? Math.min(...results.map((r: any) => r.percentage)) : 0,
    average_time: results?.length ? Math.round(results.reduce((sum: number, r: any) => sum + r.time_taken, 0) / results.length) : 0,
  };

  return {
    report_title: `نتائج امتحان: ${exam?.title || 'غير معروف'}`,
    generated_at: new Date().toISOString(),
    exam_info: exam,
    statistics: stats,
    results: results || [],
    questions: questions || [],
  };
}

// تقرير تقدم الطالب
async function generateStudentProgressReport(supabase: any, studentId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('results')
    .select(`
      id, score, total_score, percentage, grade, passed, time_taken, submitted_at,
      exam:exams!results_exam_id_fkey(title, subject, passing_score)
    `)
    .eq('student_id', studentId);

  if (startDate) query = query.gte('submitted_at', startDate);
  if (endDate) query = query.lte('submitted_at', endDate);

  const { data: results } = await query.order('submitted_at', { ascending: false });

  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, email, student_id, class_id')
    .eq('id', studentId)
    .single();

  const totalExams = results?.length || 0;
  const passedExams = results?.filter((r: any) => r.passed).length || 0;
  const averagePercentage = totalExams > 0
    ? Math.round(results.reduce((sum: number, r: any) => sum + r.percentage, 0) / totalExams)
    : 0;

  // تقدم عبر الوقت
  const progressOverTime = results?.map((r: any, index: number) => ({
    exam: r.exam?.title,
    date: r.submitted_at,
    score: r.percentage,
    cumulative_average: totalExams > 0
      ? Math.round(results.slice(0, index + 1).reduce((s: number, x: any) => s + x.percentage, 0) / (index + 1))
      : 0,
  }));

  return {
    report_title: `تقرير تقدم الطالب: ${student?.full_name || 'غير معروف'}`,
    generated_at: new Date().toISOString(),
    student_info: student,
    summary: {
      total_exams: totalExams,
      passed_exams: passedExams,
      failed_exams: totalExams - passedExams,
      pass_rate: totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0,
      average_percentage: averagePercentage,
      best_score: totalExams > 0 ? Math.max(...results.map((r: any) => r.percentage)) : 0,
      worst_score: totalExams > 0 ? Math.min(...results.map((r: any) => r.percentage)) : 0,
    },
    results: results || [],
    progress_over_time: progressOverTime || [],
  };
}

// تقرير أداء الفصل
async function generateClassPerformanceReport(supabase: any, classId: string, startDate?: string, endDate?: string) {
  const { data: students } = await supabase
    .from('profiles')
    .select('id, full_name, email, student_id')
    .eq('class_id', classId)
    .eq('role', 'student');

  const { data: classInfo } = await supabase
    .from('classes')
    .select('name, grade_level, teacher_id')
    .eq('id', classId)
    .single();

  const studentIds = students?.map((s: any) => s.id) || [];

  let query = supabase
    .from('results')
    .select(`
      id, student_id, score, total_score, percentage, grade, passed, submitted_at,
      exam:exams!results_exam_id_fkey(title, subject)
    `)
    .in('student_id', studentIds);

  if (startDate) query = query.gte('submitted_at', startDate);
  if (endDate) query = query.lte('submitted_at', endDate);

  const { data: results } = await query;

  // إحصائيات لكل طالب
  const studentStats = students?.map((student: any) => {
    const studentResults = results?.filter((r: any) => r.student_id === student.id) || [];
    const avgScore = studentResults.length > 0
      ? Math.round(studentResults.reduce((s: number, r: any) => s + r.percentage, 0) / studentResults.length)
      : 0;
    const passedCount = studentResults.filter((r: any) => r.passed).length;

    return {
      student_id: student.id,
      full_name: student.full_name,
      email: student.email,
      total_exams: studentResults.length,
      average_score: avgScore,
      passed_exams: passedCount,
      failed_exams: studentResults.length - passedCount,
      pass_rate: studentResults.length > 0 ? Math.round((passedCount / studentResults.length) * 100) : 0,
    };
  });

  // ترتيب الطلاب
  const rankedStudents = studentStats?.sort((a: any, b: any) => b.average_score - a.average_score);

  return {
    report_title: `أداء الفصل: ${classInfo?.name || 'غير معروف'}`,
    generated_at: new Date().toISOString(),
    class_info: classInfo,
    total_students: students?.length || 0,
    students_with_results: results?.length || 0,
    class_average: rankedStudents?.length > 0
      ? Math.round(rankedStudents.reduce((s: number, st: any) => s + st.average_score, 0) / rankedStudents.length)
      : 0,
    top_performers: rankedStudents?.slice(0, 5) || [],
    struggling_students: rankedStudents?.filter((s: any) => s.pass_rate < 50) || [],
    all_students: rankedStudents || [],
  };
}

// تقرير الغش
async function generateCheatingReport(supabase: any, examId?: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('cheating_log')
    .select(`
      id, violation_type, severity, details, timestamp, ip_address,
      student:profiles!cheating_log_student_id_fkey(full_name, email, student_id),
      exam:exams!cheating_log_exam_id_fkey(title)
    `);

  if (examId) query = query.eq('exam_id', examId);
  if (startDate) query = query.gte('timestamp', startDate);
  if (endDate) query = query.lte('timestamp', endDate);

  const { data: violations } = await query.order('timestamp', { ascending: false });

  // إحصائيات حسب النوع
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  violations?.forEach((v: any) => {
    byType[v.violation_type] = (byType[v.violation_type] || 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
  });

  // الطلاب المتكررين
  const studentViolations: Record<string, any> = {};
  violations?.forEach((v: any) => {
    const sid = v.student?.student_id || v.student_id;
    if (!studentViolations[sid]) {
      studentViolations[sid] = {
        student_name: v.student?.full_name || 'Unknown',
        email: v.student?.email || 'Unknown',
        count: 0,
        violations: [],
      };
    }
    studentViolations[sid].count++;
    studentViolations[sid].violations.push({
      type: v.violation_type,
      severity: v.severity,
      date: v.timestamp,
    });
  });

  return {
    report_title: 'تقرير انتهاكات الأمان',
    generated_at: new Date().toISOString(),
    total_violations: violations?.length || 0,
    by_type: byType,
    by_severity: bySeverity,
    violations: violations || [],
    repeat_offenders: Object.values(studentViolations).filter((s: any) => s.count >= 3),
  };
}

// تحليل الأسئلة
async function generateQuestionAnalysisReport(supabase: any, examId: string) {
  const { data: questions } = await supabase
    .from('questions')
    .select('id, text, question_type, points, correct_answer')
    .eq('exam_id', examId);

  const { data: detailedAnswers } = await supabase
    .from('student_answers_detailed')
    .select('question_id, is_correct, points_earned, max_points')
    .in('question_id', questions?.map((q: any) => q.id) || []);

  const questionStats = questions?.map((q: any) => {
    const answers = detailedAnswers?.filter((a: any) => a.question_id === q.id) || [];
    const correctCount = answers.filter((a: any) => a.is_correct === true).length;
    const totalAnswers = answers.length;
    const correctRate = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
    const avgPoints = totalAnswers > 0
      ? Math.round((answers.reduce((s: number, a: any) => s + a.points_earned, 0) / totalAnswers) * 100) / 100
      : 0;

    return {
      question_id: q.id,
      question_text: q.text?.substring(0, 100) + '...',
      question_type: q.question_type,
      total_points: q.points,
      total_attempts: totalAnswers,
      correct_count: correctCount,
      incorrect_count: totalAnswers - correctCount,
      correct_rate: correctRate,
      average_points_earned: avgPoints,
      difficulty: correctRate > 70 ? 'easy' : correctRate > 40 ? 'medium' : 'hard',
    };
  });

  return {
    report_title: 'تحليل أداء الأسئلة',
    generated_at: new Date().toISOString(),
    exam_id: examId,
    total_questions: questions?.length || 0,
    question_stats: questionStats || [],
    hardest_questions: questionStats?.filter((q: any) => q.difficulty === 'hard').sort((a: any, b: any) => a.correct_rate - b.correct_rate) || [],
    easiest_questions: questionStats?.filter((q: any) => q.difficulty === 'easy').sort((a: any, b: any) => b.correct_rate - a.correct_rate) || [],
  };
}

// تقرير الشهادات
async function generateCertificateReport(supabase: any, startDate?: string, endDate?: string) {
  let query = supabase
    .from('certificates')
    .select(`
      id, issue_date, status, verification_code,
      student:profiles!certificates_student_id_fkey(full_name, email),
      exam:exams!certificates_exam_id_fkey(title)
    `);

  if (startDate) query = query.gte('issue_date', startDate);
  if (endDate) query = query.lte('issue_date', endDate);

  const { data: certificates } = await query.order('issue_date', { ascending: false });

  const byMonth: Record<string, number> = {};
  certificates?.forEach((c: any) => {
    const month = c.issue_date?.substring(0, 7) || 'unknown';
    byMonth[month] = (byMonth[month] || 0) + 1;
  });

  return {
    report_title: 'تقرير الشهادات المصدرة',
    generated_at: new Date().toISOString(),
    total_certificates: certificates?.length || 0,
    by_month: byMonth,
    certificates: certificates || [],
  };
}

// تحويل لـ CSV
function convertToCSV(data: any): string {
  if (!data || typeof data !== 'object') return '';

  // لو فيه results array
  if (data.results && Array.isArray(data.results)) {
    const items = data.results;
    if (items.length === 0) return '';

    const headers = Object.keys(items[0]);
    const rows = items.map((item: any) =>
      headers.map((h) => {
        const val = item[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val).replace(/"/g, '""');
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  // لو فيه all_students
  if (data.all_students && Array.isArray(data.all_students)) {
    const items = data.all_students;
    if (items.length === 0) return '';

    const headers = Object.keys(items[0]);
    const rows = items.map((item: any) =>
      headers.map((h) => {
        const val = item[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val).replace(/"/g, '""');
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  return JSON.stringify(data);
}

// توليد HTML
function generateHTMLReport(data: any, reportType: string): string {
  const title = data.report_title || 'Report';
  const generatedAt = data.generated_at || new Date().toISOString();

  let bodyContent = '';

  if (reportType === 'exam_results' && data.results) {
    bodyContent = `
      <h2>إحصائيات</h2>
      <div class="stats">
        <div class="stat-box"><h3>إجمالي الطلاب</h3><p>${data.statistics?.total_students || 0}</p></div>
        <div class="stat-box"><h3>الناجحين</h3><p>${data.statistics?.passed_count || 0}</p></div>
        <div class="stat-box"><h3>الراسبين</h3><p>${data.statistics?.failed_count || 0}</p></div>
        <div class="stat-box"><h3>نسبة النجاح</h3><p>${data.statistics?.pass_rate || 0}%</p></div>
        <div class="stat-box"><h3>المتوسط</h3><p>${data.statistics?.average_score || 0}%</p></div>
        <div class="stat-box"><h3>الأعلى</h3><p>${data.statistics?.highest_score || 0}%</p></div>
      </div>
      <h2>النتائج التفصيلية</h2>
      <table>
        <thead><tr><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>الحالة</th><th>الوقت</th></tr></thead>
        <tbody>
          ${data.results.map((r: any) => `
            <tr class="${r.passed ? 'passed' : 'failed'}">
              <td>${r.student?.full_name || 'Unknown'}</td>
              <td>${r.score}/${r.total_score}</td>
              <td>${r.percentage}%</td>
              <td>${r.grade}</td>
              <td>${r.passed ? '✅ ناجح' : '❌ راسب'}</td>
              <td>${formatTime(r.time_taken)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (reportType === 'class_performance' && data.all_students) {
    bodyContent = `
      <h2>ملخص الفصل</h2>
      <div class="stats">
        <div class="stat-box"><h3>إجمالي الطلاب</h3><p>${data.total_students || 0}</p></div>
        <div class="stat-box"><h3>متوسط الفصل</h3><p>${data.class_average || 0}%</p></div>
      </div>
      <h2>أداء الطلاب</h2>
      <table>
        <thead><tr><th>الترتيب</th><th>الطالب</th><th>الامتحانات</th><th>المتوسط</th><th>الناجح</th><th>الراسب</th><th>نسبة النجاح</th></tr></thead>
        <tbody>
          ${data.all_students.map((s: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td>${s.full_name}</td>
              <td>${s.total_exams}</td>
              <td>${s.average_score}%</td>
              <td>${s.passed_exams}</td>
              <td>${s.failed_exams}</td>
              <td>${s.pass_rate}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    bodyContent = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #1a237e; border-bottom: 3px solid #1a237e; padding-bottom: 15px; }
    h2 { color: #3949ab; margin-top: 30px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
    .stat-box h3 { margin: 0 0 10px; font-size: 14px; opacity: 0.9; }
    .stat-box p { margin: 0; font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0; }
    th { background: #1a237e; color: white; font-weight: 600; }
    tr:hover { background: #f5f5f5; }
    .passed { background: #e8f5e9 !important; }
    .failed { background: #ffebee !important; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; text-align: center; }
    @media print { body { margin: 0; background: white; } .container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p><strong>تاريخ التوليد:</strong> ${new Date(generatedAt).toLocaleString('ar-SA')}</p>
    ${bodyContent}
    <div class="footer">
      <p>تم إنشاء هذا التقرير بواسطة منصة الاختبارات</p>
    </div>
  </div>
</body>
</html>`;
}

function formatTime(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
