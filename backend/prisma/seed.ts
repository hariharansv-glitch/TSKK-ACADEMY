/**
 * TSKK Academy Platform — Database seed
 *
 * Idempotent: safe to run repeatedly. Uses `upsert` for every record so re-runs
 * do not create duplicates. Passwords are hashed with argon2id.
 *
 * Creates:
 *  - The full permission catalogue and role → permission mapping
 *  - The primary TSKK academy with a Chennai branch
 *  - A default subscription and academy settings
 *  - One user per role, with well-known email / password
 *  - Three fee plans (admission, monthly, quarterly)
 *  - A handful of Indian national holidays for the current year
 */

import { PrismaClient, UserRole, AcademyDiscipline, AcademyStatus, UserStatus, Gender, StudentStatus, BeltLevel, FeeType, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'ChangeMe#2026';
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET ?? 'change_me_qr_hmac_secret_min_32_chars_____';

// ─── Permission catalogue ────────────────────────────────────────────────────
const PERMISSIONS: Record<string, string> = {
  'platform.manage': 'Manage the entire SaaS platform',
  'platform.analytics.view': 'View platform-wide analytics',
  'academy.create': 'Create a new academy tenant',
  'academy.update': 'Update academy settings',
  'academy.delete': 'Delete or suspend an academy',
  'academy.view': 'View academy details',
  'branch.manage': 'Create / update / delete branches',
  'user.create': 'Create users within an academy',
  'user.update': 'Update users within an academy',
  'user.delete': 'Delete users within an academy',
  'user.view': 'View users within an academy',
  'student.create': 'Register new students',
  'student.update': 'Update student profile',
  'student.delete': 'Deactivate students',
  'student.view': 'View student profile',
  'student.export': 'Export student data',
  'parent.manage': 'Manage parent records',
  'instructor.manage': 'Manage instructors',
  'instructor.viewSalary': 'View instructor salary information',
  'attendance.mark': 'Mark attendance',
  'attendance.view': 'View attendance',
  'attendance.export': 'Export attendance reports',
  'fee.create': 'Create fee invoices',
  'fee.update': 'Update fee invoices',
  'fee.delete': 'Delete / void fee invoices',
  'fee.view': 'View fee invoices',
  'payment.collect': 'Collect / record payments',
  'payment.refund': 'Refund payments',
  'payment.view': 'View payments',
  'belt.schedule': 'Schedule belt exams',
  'belt.grade': 'Grade belt exams',
  'belt.view': 'View belt exams',
  'belt.delete': 'Delete belt exams',
  'certificate.issue': 'Issue certificates',
  'certificate.revoke': 'Revoke certificates',
  'certificate.view': 'View certificates',
  'event.create': 'Create events',
  'event.update': 'Update events',
  'event.delete': 'Delete events',
  'event.view': 'View events',
  'event.register': 'Register for events',
  'video.create': 'Upload videos',
  'video.update': 'Update videos',
  'video.delete': 'Delete videos',
  'video.view': 'View videos',
  'document.create': 'Upload documents',
  'document.update': 'Update documents',
  'document.delete': 'Delete documents',
  'document.view': 'View documents',
  'assignment.create': 'Create assignments',
  'assignment.grade': 'Grade assignments',
  'assignment.submit': 'Submit assignments',
  'assignment.view': 'View assignments',
  'inventory.create': 'Create inventory items',
  'inventory.update': 'Update inventory items',
  'inventory.delete': 'Delete inventory items',
  'inventory.view': 'View inventory items',
  'announcement.create': 'Create announcements',
  'announcement.update': 'Update announcements',
  'announcement.delete': 'Delete announcements',
  'announcement.view': 'View announcements',
  'notification.send': 'Send notifications',
  'notification.view': 'View notifications',
  'batch.create': 'Create classes / batches',
  'batch.update': 'Update classes / batches',
  'batch.delete': 'Delete classes / batches',
  'batch.view': 'View classes / batches',
  'report.view': 'View reports',
  'settings.view': 'View academy settings',
  'settings.update': 'Update academy settings',
  'audit.view': 'View audit logs',
  'profile.self.view': 'View own profile',
  'profile.self.update': 'Update own profile',
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: Object.keys(PERMISSIONS),
  ACADEMY_ADMIN: [
    'academy.update', 'academy.view', 'branch.manage',
    'user.create', 'user.update', 'user.delete', 'user.view',
    'student.create', 'student.update', 'student.delete', 'student.view', 'student.export',
    'parent.manage', 'instructor.manage', 'instructor.viewSalary',
    'batch.create', 'batch.update', 'batch.delete', 'batch.view',
    'attendance.mark', 'attendance.view', 'attendance.export',
    'fee.create', 'fee.update', 'fee.delete', 'fee.view',
    'payment.collect', 'payment.refund', 'payment.view',
    'belt.schedule', 'belt.grade', 'belt.view', 'belt.delete',
    'certificate.issue', 'certificate.revoke', 'certificate.view',
    'event.create', 'event.update', 'event.delete', 'event.view', 'event.register',
    'video.create', 'video.update', 'video.delete', 'video.view',
    'document.create', 'document.update', 'document.delete', 'document.view',
    'assignment.create', 'assignment.grade', 'assignment.view',
    'inventory.create', 'inventory.update', 'inventory.delete', 'inventory.view',
    'announcement.create', 'announcement.update', 'announcement.delete', 'announcement.view',
    'notification.send', 'notification.view',
    'report.view', 'settings.view', 'settings.update', 'audit.view',
    'profile.self.view', 'profile.self.update',
  ],
  INSTRUCTOR: [
    'student.view',
    'batch.view', 'batch.update',
    'attendance.mark', 'attendance.view',
    'belt.schedule', 'belt.grade', 'belt.view',
    'certificate.view',
    'event.view', 'event.create', 'event.update',
    'video.create', 'video.update', 'video.view',
    'document.create', 'document.update', 'document.view',
    'assignment.create', 'assignment.grade', 'assignment.view',
    'announcement.view', 'announcement.create',
    'notification.view',
    'report.view',
    'profile.self.view', 'profile.self.update',
  ],
  RECEPTIONIST: [
    'student.create', 'student.update', 'student.view',
    'parent.manage', 'batch.view', 'batch.update',
    'fee.create', 'fee.view', 'payment.collect', 'payment.view',
    'event.view', 'event.register',
    'attendance.mark', 'attendance.view',
    'announcement.view', 'announcement.create',
    'notification.view',
    'profile.self.view', 'profile.self.update',
  ],
  ACCOUNTANT: [
    'fee.create', 'fee.update', 'fee.view',
    'payment.collect', 'payment.refund', 'payment.view',
    'report.view', 'student.view',
    'notification.view',
    'profile.self.view', 'profile.self.update',
  ],
  PARENT: [
    'attendance.view', 'fee.view', 'payment.view', 'certificate.view',
    'video.view', 'document.view', 'event.view', 'event.register',
    'announcement.view', 'notification.view',
    'profile.self.view', 'profile.self.update',
  ],
  STUDENT: [
    'attendance.view', 'certificate.view',
    'video.view', 'document.view',
    'assignment.view', 'assignment.submit',
    'event.view', 'event.register',
    'announcement.view', 'notification.view',
    'profile.self.view', 'profile.self.update',
  ],
};

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

function signQr(payload: string): string {
  return crypto.createHmac('sha256', QR_HMAC_SECRET).update(payload).digest('hex');
}

async function seedPermissions() {
  console.log('→ Seeding permissions & role mappings');
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  }
  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS) as [UserRole, string[]][]) {
    for (const permissionKey of keys) {
      await prisma.rolePermission.upsert({
        where: { role_permissionKey: { role, permissionKey } },
        create: { role, permissionKey },
        update: {},
      });
    }
  }
}

async function seedSuperAdmin() {
  console.log('→ Seeding super admin');
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  return prisma.user.upsert({
    where: { email: 'superadmin@tskk.in' },
    create: {
      email: 'superadmin@tskk.in',
      passwordHash,
      firstName: 'Platform',
      lastName: 'Administrator',
      displayName: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, status: UserStatus.ACTIVE, emailVerified: true },
  });
}

async function seedAcademy() {
  console.log('→ Seeding primary academy: Tamilar Silamba Kalai Koodam');
  const trialEndsAt = new Date();
  trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 5);

  const academy = await prisma.academy.upsert({
    where: { slug: 'tskk' },
    create: {
      slug: 'tskk',
      name: 'Tamilar Silamba Kalai Koodam',
      discipline: AcademyDiscipline.SILAMBAM,
      status: AcademyStatus.ACTIVE,
      primaryColor: '#B91C1C',
      contactEmail: 'contact@tskk.in',
      contactPhone: '+919000000000',
      addressLine1: 'Silambam House',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      postalCode: '600001',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      foundedYear: 2010,
      trialEndsAt,
    },
    update: {},
  });

  await prisma.branch.upsert({
    where: { academyId_code: { academyId: academy.id, code: 'CHN-01' } },
    create: {
      academyId: academy.id,
      code: 'CHN-01',
      name: 'Chennai — Head Office',
      addressLine1: 'Silambam House, 1st Cross Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      postalCode: '600001',
      phone: '+914412345678',
      email: 'chennai@tskk.in',
      isPrimary: true,
      isActive: true,
    },
    update: {},
  });

  await prisma.subscription.upsert({
    where: { academyId: academy.id },
    create: {
      academyId: academy.id,
      plan: SubscriptionPlan.PROFESSIONAL,
      status: SubscriptionStatus.ACTIVE,
      seatLimit: 500,
      currentPeriodEnd: trialEndsAt,
      pricePaise: 999900,
    },
    update: {},
  });

  await prisma.academySetting.upsert({
    where: { academyId: academy.id },
    create: {
      academyId: academy.id,
      workingHoursJson: {
        MONDAY:    { open: '06:00', close: '21:00' },
        TUESDAY:   { open: '06:00', close: '21:00' },
        WEDNESDAY: { open: '06:00', close: '21:00' },
        THURSDAY:  { open: '06:00', close: '21:00' },
        FRIDAY:    { open: '06:00', close: '21:00' },
        SATURDAY:  { open: '06:00', close: '20:00' },
        SUNDAY:    { open: '07:00', close: '13:00' },
      },
      autoLateFeeEnabled: true,
      autoReceiptEnabled: true,
      autoAttendanceReminderEnabled: true,
      autoFeeReminderEnabled: true,
      birthdayWishesEnabled: true,
      defaultTaxPercent: 0,
      invoicePrefix: 'INV',
      receiptPrefix: 'RCT',
      certificatePrefix: 'CERT',
      studentCodePrefix: 'TSKK',
      employeeCodePrefix: 'EMP',
      qrCheckInWindowMinutes: 30,
      attendanceLateAfterMinutes: 10,
      smsEnabled: false,
      whatsappEnabled: false,
      emailEnabled: true,
      pushEnabled: true,
    },
    update: {},
  });

  return academy;
}

async function seedAcademyUsers(academyId: string) {
  console.log('→ Seeding academy staff & sample students');
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const staff: Array<{ email: string; role: UserRole; firstName: string; lastName: string; phone?: string }> = [
    { email: 'admin@tskk.in',      role: UserRole.ACADEMY_ADMIN, firstName: 'Ravi',   lastName: 'Kumar',    phone: '+919000000001' },
    { email: 'instructor@tskk.in', role: UserRole.INSTRUCTOR,    firstName: 'Karthik', lastName: 'Iyer',    phone: '+919000000002' },
    { email: 'reception@tskk.in',  role: UserRole.RECEPTIONIST,  firstName: 'Deepa',   lastName: 'Sundar',  phone: '+919000000003' },
    { email: 'accounts@tskk.in',   role: UserRole.ACCOUNTANT,    firstName: 'Meena',   lastName: 'Rajan',   phone: '+919000000004' },
    { email: 'parent@tskk.in',     role: UserRole.PARENT,        firstName: 'Suresh',  lastName: 'Mohan',   phone: '+919000000005' },
    { email: 'student@tskk.in',    role: UserRole.STUDENT,       firstName: 'Arjun',   lastName: 'Mohan',   phone: '+919000000006' },
  ];

  const users: Record<string, string> = {};
  for (const s of staff) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      create: {
        academyId,
        email: s.email,
        phone: s.phone,
        passwordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        displayName: `${s.firstName} ${s.lastName}`,
        role: s.role,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      update: { academyId, status: UserStatus.ACTIVE, emailVerified: true },
    });
    users[s.role] = u.id;
  }

  const instructor = await prisma.instructor.upsert({
    where: { academyId_employeeCode: { academyId, employeeCode: 'EMP-0001' } },
    create: {
      academyId,
      userId: users[UserRole.INSTRUCTOR],
      employeeCode: 'EMP-0001',
      firstName: 'Karthik',
      lastName: 'Iyer',
      email: 'instructor@tskk.in',
      phone: '+919000000002',
      currentBelt: BeltLevel.BLACK_3,
      yearsExperience: 12,
      qualifications: 'Master Instructor — Silambam',
      specializations: 'Traditional silambam, kuthu varisai',
      joinedAt: new Date('2015-01-01'),
      salaryPaise: 3500000,
      isActive: true,
    },
    update: {},
  });

  const parent = await prisma.parent.upsert({
    where: { id: `seed-parent-${academyId}` },
    create: {
      id: `seed-parent-${academyId}`,
      academyId,
      userId: users[UserRole.PARENT],
      firstName: 'Suresh',
      lastName: 'Mohan',
      email: 'parent@tskk.in',
      phone: '+919000000005',
      occupation: 'Software Engineer',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600001',
    },
    update: {},
  });

  const studentCode = 'TSKK-0001';
  const qrPayload = `TSKK|${academyId}|${studentCode}`;
  const student = await prisma.student.upsert({
    where: { academyId_studentCode: { academyId, studentCode } },
    create: {
      academyId,
      userId: users[UserRole.STUDENT],
      studentCode,
      firstName: 'Arjun',
      lastName: 'Mohan',
      dateOfBirth: new Date('2012-05-14'),
      gender: Gender.MALE,
      bloodGroup: 'O+',
      qrCode: qrPayload,
      qrSignature: signQr(qrPayload),
      admissionDate: new Date('2022-06-01'),
      status: StudentStatus.ACTIVE,
      currentBelt: BeltLevel.GREEN,
      currentBeltSince: new Date('2024-06-01'),
      email: 'student@tskk.in',
      phone: '+919000000006',
      addressLine1: '12 Silambam Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      postalCode: '600001',
      schoolName: 'St. Xavier High School',
      schoolClass: '8',
      guardianName: 'Suresh Mohan',
      guardianPhone: '+919000000005',
      guardianEmail: 'parent@tskk.in',
      emergencyContactName: 'Priya Mohan',
      emergencyContactPhone: '+919000000007',
      emergencyContactRelation: 'Mother',
      heightCm: 148,
      weightKg: 42,
    },
    update: {},
  });

  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    create: { parentId: parent.id, studentId: student.id, relationship: 'Father', isPrimary: true, canPickup: true },
    update: {},
  });

  return { instructor, parent, student };
}

async function seedFeePlans(academyId: string) {
  console.log('→ Seeding fee plans');
  const plans: Array<{ name: string; type: FeeType; amountPaise: number; billingCycleMonths: number; description: string }> = [
    { name: 'Admission Fee',      type: FeeType.ADMISSION, amountPaise: 200000, billingCycleMonths: 0,  description: 'One-time admission fee' },
    { name: 'Monthly Training',   type: FeeType.MONTHLY,   amountPaise: 150000, billingCycleMonths: 1,  description: 'Monthly tuition — twice weekly classes' },
    { name: 'Quarterly Training', type: FeeType.QUARTERLY, amountPaise: 420000, billingCycleMonths: 3,  description: 'Three months prepaid — 7 % discount' },
    { name: 'Yearly Training',    type: FeeType.YEARLY,    amountPaise: 1500000, billingCycleMonths: 12, description: 'Full year prepaid — 15 % discount' },
  ];
  for (const p of plans) {
    await prisma.feePlan.upsert({
      where: { id: `seed-plan-${academyId}-${p.type}` },
      create: {
        id: `seed-plan-${academyId}-${p.type}`,
        academyId,
        name: p.name,
        description: p.description,
        type: p.type,
        amountPaise: p.amountPaise,
        billingCycleMonths: p.billingCycleMonths,
        gracePeriodDays: 7,
        lateFeePaise: 10000,
      },
      update: {},
    });
  }
}

async function seedHolidays(academyId: string) {
  console.log('→ Seeding holidays for current year');
  const year = new Date().getFullYear();
  const holidays: Array<{ name: string; date: string; recurring: boolean }> = [
    { name: 'Republic Day',          date: `${year}-01-26`, recurring: true },
    { name: 'Independence Day',      date: `${year}-08-15`, recurring: true },
    { name: 'Gandhi Jayanti',        date: `${year}-10-02`, recurring: true },
    { name: 'Diwali',                date: `${year}-11-01`, recurring: false },
    { name: 'Christmas',             date: `${year}-12-25`, recurring: true },
    { name: 'Pongal',                date: `${year}-01-15`, recurring: true },
    { name: 'Tamil New Year',        date: `${year}-04-14`, recurring: true },
  ];
  for (const h of holidays) {
    const date = new Date(h.date);
    await prisma.holiday.upsert({
      where: { academyId_date_name: { academyId, date, name: h.name } },
      create: { academyId, name: h.name, date, isRecurring: h.recurring },
      update: {},
    });
  }
}

async function main() {
  console.log('🚀 TSKK seed starting');
  await seedPermissions();
  await seedSuperAdmin();
  const academy = await seedAcademy();
  await seedAcademyUsers(academy.id);
  await seedFeePlans(academy.id);
  await seedHolidays(academy.id);
  console.log('✅ Seed complete');
  console.log(`   Super Admin  : superadmin@tskk.in / ${DEFAULT_PASSWORD}`);
  console.log(`   Academy Admin: admin@tskk.in       / ${DEFAULT_PASSWORD}`);
  console.log(`   Instructor   : instructor@tskk.in  / ${DEFAULT_PASSWORD}`);
  console.log(`   Reception    : reception@tskk.in   / ${DEFAULT_PASSWORD}`);
  console.log(`   Accounts     : accounts@tskk.in    / ${DEFAULT_PASSWORD}`);
  console.log(`   Parent       : parent@tskk.in      / ${DEFAULT_PASSWORD}`);
  console.log(`   Student      : student@tskk.in     / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
