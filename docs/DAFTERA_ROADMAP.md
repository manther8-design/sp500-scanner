# خارطة التحول نحو نظام ERP سحابي بمستوى دفترة

## المعمارية المعتمدة حالياً

| الطبقة | الاختيار الحالي | ملاحظة المواصفات |
|--------|------------------|-------------------|
| Frontend | Next.js 15 App Router + TypeScript + Tailwind | مطابق |
| UI | IBM Plex Sans Arabic · Lucide · Cmd+K · Sidebar قابل للطي | Shadcn primitives تدريجياً |
| Backend | Next.js Route Handlers (مودولار داخل `src/lib`) | يمكن فصل NestJS لاحقاً دون إعادة بناء الواجهة |
| DB | SQLite للتطوير المحلي · PostgreSQL عبر Docker | جاهز للـ SaaS |
| AI | مساعد قراءة فقط على بيانات حية + هيكل Tools | ربط OpenAI/Claude Function Calling كمرحلة لاحقة |
| Multi-tenant | `companyId` على كل الجداول + JWT/RBAC | RLS PostgreSQL كطبقة إضافية في الإنتاج |

## ما أُنجز في هذه الدفعة

1. **محرك محاسبي**: قيد مزدوج + ترحيل فاتورة مبيعات (ذمم/مبيعات/ضريبة) + COGS
2. **ZATCA TLV QR**: توليد payload Base64 وQR للمرحلة الأولى
3. **مخازن**: أصناف، حركات، متوسط مرجح WAC
4. **POS Local-First**: IndexedDB للمبيعات دون إنترنت + مزامنة
5. **رواتب نسبية**: `(أساسي / أيام الشهر) × أيام الاستحقاق` حسب `hireDate/startDate`
6. **UI**: شريط علوي ذكي، بحث Ctrl+K، قائمة قابلة للطي، `tabular-nums`
7. **Docker Compose**: Postgres + تطبيق

## المراحل التالية المقترحة

- Phase-2 ZATCA (توقيع تشفيري XML)
- OCR فواتير المشتريات (Vision API)
- Agentic AI Function Calling (إصدار فاتورة / استعلام رصيد بأدوات حقيقية)
- Predictive cash-flow model
- PostgreSQL Row-Level Security
- GitHub Actions CI + نسخ احتياطي مشفّر
