import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  Beaker,
  BedDouble,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LucideIcon,
  Package,
  PillBottle,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
  UserRound,
  UserRoundSearch,
  Users,
  Wallet,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@/features/auth/permissions';

export interface NavChild {
  label: string;
  href: string;
  permission?: Permission;
  badgeKey?: string;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
  permission?: Permission;
  badgeKey?: string;
}

export const NAVIGATION_CONFIG: Record<string, NavGroup[]> = {
  SUPER_ADMIN: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/admin',
    },
    {
      label: 'Users & Staff',
      icon: Users,
      children: [
        { label: 'All Users', href: '/admin/users', permission: PERMISSIONS.USER_MANAGE },
        { label: 'Doctors', href: '/admin/doctors', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Nurses', href: '/admin/nurses', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Pharmacists', href: '/admin/pharmacists', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Cashiers', href: '/admin/cashiers', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Receptionists', href: '/admin/receptionists', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Lab Technicians', href: '/admin/lab-technicians', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Patients', href: '/admin/patients', permission: PERMISSIONS.PATIENT_DIRECTORY_READ },
      ],
    },
    {
      label: 'Organization',
      icon: Building2,
      children: [
        { label: 'Branches', href: '/admin/branches', permission: PERMISSIONS.BRANCH_MANAGE },
        { label: 'Departments', href: '/admin/departments', permission: PERMISSIONS.DEPARTMENT_MANAGE },
        { label: 'Wards & Rooms', href: '/admin/wards', permission: PERMISSIONS.WARD_MANAGE },
        { label: 'Doctor Availability', href: '/admin/doctor-availability', permission: PERMISSIONS.STAFF_MANAGE },
      ],
    },
    {
      label: 'Operations',
      icon: Activity,
      children: [
        { label: 'Appointments', href: '/admin/appointments', permission: PERMISSIONS.APPOINTMENT_MANAGE },
        { label: 'Laboratory', href: '/admin/laboratory', permission: PERMISSIONS.LAB_ORDER_READ },
        { label: 'Pharmacy', href: '/admin/pharmacy', permission: PERMISSIONS.REPORT_READ },
      ],
    },
    {
      label: 'Finance',
      icon: BadgeDollarSign,
      children: [
        { label: 'Invoices', href: '/admin/billing', permission: PERMISSIONS.INVOICE_READ },
        { label: 'Payments', href: '/admin/payments', permission: PERMISSIONS.INVOICE_READ },
        { label: 'Refunds & Approvals', href: '/admin/refunds', permission: PERMISSIONS.REFUND_APPROVE, badgeKey: 'pendingRefunds' },
      ],
    },
    {
      label: 'Reports',
      icon: FileText,
      children: [
        { label: 'Patient Volume', href: '/admin/reports/patient-volume', permission: PERMISSIONS.REPORT_READ },
        { label: 'Appointments', href: '/admin/reports/appointments', permission: PERMISSIONS.REPORT_READ },
        { label: 'Revenue', href: '/admin/reports/revenue', permission: PERMISSIONS.REPORT_READ },
        { label: 'Lab Turnaround', href: '/admin/reports/lab-turnaround', permission: PERMISSIONS.REPORT_READ },
        { label: 'Pharmacy Stock', href: '/admin/reports/pharmacy-stock', permission: PERMISSIONS.REPORT_READ },
      ],
    },
    {
      label: 'Access Control',
      icon: ShieldCheck,
      children: [
        { label: 'Roles & Permissions', href: '/admin/roles', permission: PERMISSIONS.ROLE_MANAGE },
        { label: 'Approvals', href: '/admin/approvals', permission: PERMISSIONS.ROLE_MANAGE, badgeKey: 'pendingApprovals' },
      ],
    },
    {
      label: 'Audit Logs',
      icon: ScrollText,
      href: '/admin/audit-log',
      permission: PERMISSIONS.AUDIT_READ,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/admin/settings',
      permission: PERMISSIONS.SETTINGS_MANAGE,
    },
  ],

  HOSPITAL_ADMIN: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/hospital',
    },
    {
      label: 'Organization',
      icon: Building2,
      children: [
        { label: 'Departments', href: '/hospital/departments', permission: PERMISSIONS.DEPARTMENT_MANAGE },
        { label: 'Staff', href: '/hospital/staff', permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Wards & Rooms', href: '/hospital/wards', permission: PERMISSIONS.WARD_MANAGE },
      ],
    },
    {
      label: 'Reports',
      icon: FileText,
      href: '/hospital/reports',
      permission: PERMISSIONS.REPORT_READ,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/hospital/settings',
    },
  ],

  DOCTOR: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/doctor',
    },
    {
      label: 'Patients',
      icon: Users,
      children: [
        { label: 'My Patients', href: '/doctor/patients' },
        { label: 'Records', href: '/doctor/records/new' },
      ],
    },
    {
      label: 'Appointments',
      icon: CalendarDays,
      children: [
        { label: 'Appointments', href: '/doctor/appointments' },
        { label: 'Schedule', href: '/doctor/schedule' },
        { label: 'Availability', href: '/doctor/availability' },
      ],
    },
    {
      label: 'Orders',
      icon: ClipboardList,
      children: [
        { label: 'Prescriptions', href: '/doctor/prescriptions/new' },
        { label: 'Laboratory', href: '/doctor/laboratory' },
      ],
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/doctor/settings',
    },
  ],

  NURSE: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/nurse',
    },
    {
      label: 'Patients',
      icon: Users,
      children: [
        { label: 'My Patients', href: '/nurse/patients' },
        { label: 'Vitals', href: '/nurse/vitals', permission: PERMISSIONS.VITAL_WRITE },
      ],
    },
    {
      label: 'Medications',
      icon: PillBottle,
      href: '/nurse/medications',
      permission: PERMISSIONS.MEDICATION_ADMINISTER,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/nurse/settings',
    },
  ],

  RECEPTIONIST: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/reception',
    },
    {
      label: 'Patients',
      icon: Users,
      children: [
        { label: 'Register Patient', href: '/reception/register', permission: PERMISSIONS.PATIENT_REGISTER },
        { label: 'Assign to Doctor', href: '/reception/assign', permission: PERMISSIONS.PATIENT_ASSIGN },
      ],
    },
    {
      label: 'Appointments',
      icon: CalendarDays,
      href: '/reception/appointments',
      permission: PERMISSIONS.APPOINTMENT_MANAGE,
    },
    {
      label: 'Queue',
      icon: ClipboardList,
      href: '/reception/queue',
      permission: PERMISSIONS.QUEUE_MANAGE,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/reception/settings',
    },
  ],

  LAB_TECHNICIAN: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/laboratory',
    },
    {
      label: 'Orders',
      icon: FlaskConical,
      children: [
        { label: 'Incoming Orders', href: '/laboratory/orders', badgeKey: 'pendingOrders' },
        { label: 'Results', href: '/laboratory/results' },
      ],
    },
    {
      label: 'Profile',
      icon: User,
      href: '/laboratory/profile',
    },
  ],

  PHARMACIST: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/pharmacist',
    },
    {
      label: 'Prescriptions/Orders',
      icon: PillBottle,
      href: '/pharmacist/prescriptions',
      badgeKey: 'pendingPrescriptions',
    },
    {
      label: 'Inventory',
      icon: Package,
      children: [
        { label: 'Stock', href: '/pharmacist/inventory' },
        { label: 'Batches & Expiry', href: '/pharmacist/batches', badgeKey: 'expiringBatches' },
      ],
    },
    {
      label: 'Profile',
      icon: User,
      href: '/pharmacist/profile',
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/pharmacist/settings',
    },
  ],

  CASHIER: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/cashier',
    },
    {
      label: 'Billing',
      icon: BadgeDollarSign,
      children: [
        { label: 'Invoices', href: '/cashier/invoices' },
        { label: 'Payments', href: '/cashier/payments' },
        { label: 'Refunds', href: '/cashier/refunds', badgeKey: 'pendingRefunds' },
      ],
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/cashier/settings',
    },
  ],

  PATIENT: [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/patient',
    },
    {
      label: 'Appointments',
      icon: CalendarDays,
      children: [
        { label: 'My Appointments', href: '/patient/appointments' },
        { label: 'Book Appointment', href: '/patient/appointments/book' },
      ],
    },
    {
      label: 'Records',
      icon: FileText,
      href: '/patient/records',
    },
    {
      label: 'Prescriptions',
      icon: PillBottle,
      href: '/patient/prescriptions',
    },
    {
      label: 'Notifications',
      icon: Bell,
      href: '/patient/notifications',
      badgeKey: 'unreadNotifications',
    },
    {
      label: 'Profile',
      icon: User,
      href: '/patient/profile',
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/patient/settings',
    },
  ],
};

// Map legacy aliases
NAVIGATION_CONFIG.ADMIN = NAVIGATION_CONFIG.SUPER_ADMIN;
NAVIGATION_CONFIG.LABORATORY = NAVIGATION_CONFIG.LAB_TECHNICIAN;

export function getNavigationForRole(role?: string | null): NavGroup[] {
  if (!role) return [];
  const normalized = role.toUpperCase();
  return NAVIGATION_CONFIG[normalized] || [];
}
