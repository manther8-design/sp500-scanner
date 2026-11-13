import { NextRequest, NextResponse } from "next/server";
import { getSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const employees = await prisma.employee.findMany({
    where: { companyId: session.companyId },
    include: {
      branch: true,
      department: true,
      allowances: { include: { allowanceType: true } },
    },
    orderBy: { employeeNumber: "asc" },
  });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const emp = await prisma.employee.create({
    data: {
      companyId: session.companyId,
      branchId: body.branchId || null,
      departmentId: body.departmentId || null,
      employeeNumber: body.employeeNumber,
      fullName: body.fullName,
      nationality: body.nationality,
      idNumber: body.idNumber,
      phone: body.phone,
      email: body.email,
      jobTitle: body.jobTitle,
      hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      contractType: body.contractType || "UNLIMITED",
      contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : null,
      employmentStatus: body.employmentStatus || "ACTIVE",
      basicSalary: Number(body.basicSalary || 0),
      dailyHours: Number(body.dailyHours || 8),
      weeklyDays: Number(body.weeklyDays || 5),
    },
  });
  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: emp.id,
      changeType: "HIRE",
      newValue: emp.employmentStatus,
      effectiveDate: emp.startDate || new Date(),
      changedById: session.userId,
    },
  });
  await writeAudit({
    companyId: session.companyId,
    userId: session.userId,
    entityType: "Employee",
    entityId: emp.id,
    action: "CREATE",
    newValue: emp,
  });
  return NextResponse.json(emp, { status: 201 });
}
