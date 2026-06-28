# ✅ Checklist تنفيذ إصلاحات الأمان

## المرحلة 1: قاعدة البيانات (يوم واحد)

### 1.1. تفعيل RLS
- [ ] افتح Supabase Dashboard
- [ ] روح لـ SQL Editor
- [ ] افتح ملف `rls-policies.sql`
- [ ] انسخ والصق الكود كامل
- [ ] اضغط Run
- [ ] تأكد: `SELECT * FROM pg_policies WHERE schemaname = 'public';` يرجع نتائج

### 1.2. إضافة الجداول الجديدة
- [ ] افتح ملف `schema-updates.sql`
- [ ] انسخ والصق في SQL Editor
- [ ] اضغط Run
- [ ] تأكد الجداول اتعملت:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('cheating_log', 'student_answers_detailed', 'certificates');
  ```

### 1.3. إضافة الحقول الجديدة
- [ ] تأكد الحقول اتضافت:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'exams' AND column_name IN ('shuffle_questions', 'passing_score');
  ```

---

## المرحلة 2: Edge Functions (يوم واحد)

### 2.1. تثبيت Supabase CLI
```bash
npm install -g supabase
```

### 2.2. تسجيل الدخول
```bash
supabase login
```

### 2.3. ربط المشروع
```bash
supabase link --project-ref your-project-ref
```

### 2.4. نشر Edge Functions
```bash
# calculate-score
supabase functions deploy calculate-score

# security-log
supabase functions deploy security-log
```

### 2.5. إضافة Secrets
```bash
supabase secrets set SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
```

### 2.6. اختبار الـ Functions
```bash
curl -X POST https://your-project.supabase.co/functions/v1/calculate-score   -H "Authorization: Bearer YOUR_ANON_KEY"   -H "Content-Type: application/json"   -d '{"exam_id":1,"student_id":"test","answers":{}}'
```

---

## المرحلة 3: إصلاح الكود (يوم واحد)

### 3.1. استبدال supabase-client.js
- [ ] احفظ نسخة من الملف القديم
- [ ] انسخ `supabase-client-fixed.js`
- [ ] غيّر اسمه لـ `supabase-client.js`
- [ ] عدّل الـ URL والـ Key في أول الملف

### 3.2. تحديث كل الصفحات
- [ ] استخدم الـ `sanitizeInput()` في كل الفورم
- [ ] استبدل كل `alert()` بـ `showToast()`
- [ ] أضف Loading States على كل الأزرار
- [ ] استخدم الـ `try/catch` مع `sanitizeError()`

### 3.3. إضافة Security Headers
- [ ] لو عندك Nginx: انسخ `nginx.conf`
- [ ] لو عندك Apache: حوّل للـ .htaccess
- [ ] لو عندك Cloudflare: أضف في Transform Rules

---

## المرحلة 4: اختبار الأمان (يوم واحد)

### 4.1. اختبار RLS
```javascript
// في Console Browser
// حاول تقرأ بيانات مستخدم تاني (لازم يرجع فاضي)
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', 'user-id-tani');
console.log(data); // لازم [] أو null
```

### 4.2. اختبار XSS
```javascript
// حاول تدخل script tag في أي فورم
// لازم يظهر كنص مش كـ HTML
```

### 4.3. اختبار Rate Limiting
```bash
# حاول تعمل 10 طلبات في ثانية
for i in {1..10}; do
  curl https://your-domain.com/login.html
done
# لازم يحظرك مؤقتاً
```

### 4.4. اختبار Edge Functions
```bash
# حاول تبعت request بدون token
curl -X POST https://your-project.supabase.co/functions/v1/calculate-score
# لازم يرجع 401 Unauthorized
```

---

## المرحلة 5: المراقبة (مستمر)

### 5.1. تفعيل Logs
- [ ] Supabase Dashboard → Logs
- [ ] فعل "Realtime Logs"
- [ ] اضبط Alerts على الأخطاء

### 5.2. مراجعة دورية
- [ ] كل أسبوع: راجع `activity_log`
- [ ] كل شهر: راجع `cheating_log`
- [ ] كل شهر: تحقق من RLS policies

### 5.3. Backup
- [ ] فعل Automated Backups في Supabase
- [ ] اعمل export يدوي أسبوعي
- [ ] خزن Backup في مكان منفصل

---

## ⚠️ تحذيرات مهمة

1. **لا ترفع الملفات على GitHub** قبل ما تتأكد إن المفتاح مش ظاهر
2. **اختبر كل حاجة** في Development قبل Production
3. **خلي نسخة احتياطية** من قاعدة البيانات قبل أي تغيير
4. **سجل كل التغييرات** في ملف CHANGELOG

---

## 📞 للمساعدة

لو واجهتك أي مشكلة:
1. راجع Logs في Supabase Dashboard
2. افتح Issue في GitHub
3. تواصل مع فريق الأمان
