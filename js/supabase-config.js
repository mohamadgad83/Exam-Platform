// ==================== دوال المصادقة المعدلة (Auth) ====================

async function loginUser(identifier, password) {
    const hashedPassword = await hashPassword(password);
    
    // محاولة البحث كـ (username للمعلم/الأدمن) أو (phone للطالب)
    let query = sb
        .from('users')
        .select('*')
        .eq('password_hash', hashedPassword);
    
    // إذا كان الإدخال يبدأ برقم -> بحث بالهاتف (طالب)
    if (/^\d+$/.test(identifier)) {
        query = query.eq('phone', identifier);
    } else {
        // وإلا بحث بالـ username (معلم أو أدمن)
        query = query.eq('username', identifier);
    }
    
    const { data, error } = await query.single();
    
    if (error || !data) {
        // محاولة بحث إضافية بالبريد الإلكتروني (للحفاظ على التوافق القديم)
        const { data: emailData } = await sb
            .from('users')
            .select('*')
            .eq('email', identifier)
            .eq('password_hash', hashedPassword)
            .single();
        
        if (emailData) {
            if (emailData.status !== 'active') {
                return { success: false, error: 'الحساب غير مفعل، يرجى الانتظار حتى موافقة الأدمن' };
            }
            return {
                success: true,
                user: {
                    id: emailData.id,
                    name: emailData.name,
                    role: emailData.role,
                    email: emailData.email,
                    phone: emailData.phone,
                    username: emailData.username,
                    class_id: emailData.class_id,
                    status: emailData.status
                }
            };
        }
        
        return { success: false, error: 'بيانات الدخول غير صحيحة' };
    }
    
    if (data.status !== 'active') {
        return { success: false, error: 'الحساب غير مفعل، يرجى الانتظار حتى موافقة الأدمن' };
    }
    
    return {
        success: true,
        user: {
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
            phone: data.phone,
            username: data.username,
            class_id: data.class_id,
            status: data.status
        }
    };
}

async function createUser(userData) {
    const hashedPassword = await hashPassword(userData.password);
    
    const insertData = {
        name: userData.name,
        phone: userData.phone,
        email: userData.email || null,
        password_hash: hashedPassword,
        role: userData.role,
        class_id: userData.class_id || null,
        status: 'active'
    };
    
    // إضافة username فقط للمعلمين والأدمن
    if (userData.role === 'teacher' || userData.role === 'admin') {
        if (!userData.username) {
            return { error: 'اسم المستخدم مطلوب للمعلمين والأدمن' };
        }
        insertData.username = userData.username;
    }
    
    const { data, error } = await sb
        .from('users')
        .insert(insertData)
        .select()
        .single();
    
    if (error) return null;
    
    // إذا كان المعلم، أضف تعييناته
    if (userData.role === 'teacher' && userData.assignments) {
        for (const assignment of userData.assignments) {
            await sb.from('teacher_assignments').insert({
                teacher_id: data.id,
                class_id: assignment.class_id,
                subject_id: assignment.subject_id
            });
        }
    }
    
    return data;
}
