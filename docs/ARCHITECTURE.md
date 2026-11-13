# Smart Financial ERP — Architecture & ERD

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Next.js Route Handlers (same app) |
| ORM | Prisma 6 |
| Database | SQLite (dev) → PostgreSQL-ready (`provider` switch) |
| Auth | JWT httpOnly cookie + RBAC permissions |
| Charts | Recharts |
| Locale | Arabic RTL first (`dir=rtl`) |

## Multi-Tenant Model

```
Organization
  └── Company (isolated ledger, HR, formulas)
        ├── Branch / Department / CostCenter
        ├── Users ↔ Roles ↔ Permissions
        └── All operational data scoped by companyId
```

Data of one company never leaks into another query path: every API uses `session.companyId`.

## Double-Entry Accounting

- `Account` hierarchical COA (ASSET / LIABILITY / EQUITY / REVENUE / EXPENSE)
- `JournalEntry` + `JournalLine` with debit/credit balance enforcement
- Types: MANUAL, AUTO, OPENING, ADJUSTMENT, CLOSING, REVERSAL, PAYROLL, EXPENSE, …
- Posted entries cannot be deleted — only reversed via balancing reverse entry
- Payroll approval posts automatic journals to salary / GOSI / payable accounts

## Smart Payroll Rules Engine

`FormulaDefinition` stores versioned DSL expressions per category:

- OVERTIME, ABSENCE, LATE, EOS, ALLOWANCE, INCENTIVE, GOSI, …

Rules:

1. Effective dating (`effectiveFrom` / `effectiveTo`)
2. On each payroll/EOS calculation, a `FormulaSnapshot` is stored
3. Changing a formula never recalculates approved historical payroll

Safe DSL (no JS eval): `+ - * / %`, comparisons, `IF`, `MIN`, `MAX`, `ROUND`, `ABS`.

## HR ↔ Accounting Integration

| Event | Accounting effect |
|-------|-------------------|
| Approve & post payroll | Dr Salary + GOSI expense / Cr Payables |
| Approve expense | Dr Expense account / Cr Bank |
| Post EOS settlement | Dr EOS expense / Cr EOS payable |
| Reverse journal | Balancing opposite entry |

Attendance → late/absence minutes → formula engine → payroll deductions.  
Approved overtime → formula engine → payroll earnings.  
Active loans → installment schedule → auto deduct on payroll post.

## Saudi Compliance Module (configurable)

`SaudiComplianceSettings` + `EosPolicy.rulesJson`:

- GOSI employee/employer rates
- VAT rate
- WPS flag
- Annual leave defaults
- OT factors
- EOS formulas by termination reason (resignation, contract end, termination…)

**Legal rules are data, not hard-coded immutable law.**

## Module Map

1. Auth & RBAC  
2. COA / Journals / Sales / Purchases / Expenses / Banking  
3. Employees / Contracts / Documents  
4. Formula Engine / Allowances / Deductions  
5. Attendance / Overtime  
6. Payroll / Incentives / Leaves / Loans  
7. Termination & EOS  
8. Analytics / Reports / AI Assistant (read-only over live data)  
9. Employee Portal  

## Security

- Password hashing (bcrypt)
- Session JWT
- AuditLog for sensitive actions
- No deletion of posted financial documents
- Attachment storage path reserved under `/uploads`

## ERD (core entities)

```
Organization 1─* Company 1─* Branch
Company 1─* Account (tree)
Company 1─* JournalEntry 1─* JournalLine *─1 Account
Company 1─* Employee 1─* AttendanceRecord
Employee 1─* EmployeeAllowance *─1 AllowanceType
Employee 1─* OvertimeRequest
Company 1─* FormulaDefinition 1─* FormulaSnapshot
Company 1─* PayrollRun 1─* PayrollItem *─1 Employee
Employee 1─* Termination
Company 1─* Role *─* Permission
User *─* Company / Role
```

## Run locally

```bash
npm install
cp .env.example .env   # if needed
npx prisma db push
npm run db:seed
npm run dev
```

Login: `admin@elite.sa` / `Admin@123`
