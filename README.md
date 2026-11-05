# RM PHONE — متجر إلكتروني

متجر عربي متجاوب للهاتف والكمبيوتر، مربوط بمشروع Supabase الحالي.

## التشغيل والنشر
ارفع جميع ملفات المشروع إلى GitHub، ثم اربط المستودع بخدمة Vercel أو Netlify.
- Build command: `npm run build`
- Output directory: `dist`

## لوحة الإدارة
اضغط «لوحة الإدارة» في المتجر، وسجّل الدخول بحساب Supabase Auth الذي UID دياله موجود في جدول `public.admins`.

## ملاحظات
- المفتاح الموجود في `src/supabase.js` هو Publishable public key فقط. لا تضع أبداً service_role أو Secret key في الواجهة.
- الصور تُرفع إلى bucket اسمه `products` وبحد أقصى 5MB.
- التوصيل مضبوط على 0 DH حالياً، ويجب تأكيده مع الزبون هاتفياً.
- لا توجد بوابة أداء إلكتروني في هذه النسخة.
