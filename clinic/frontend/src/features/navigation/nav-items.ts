import {
  Activity,
  BadgeDollarSign,
  Beaker,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Package,
  PillBottle,
  Settings,
  ShieldCheck,
  ScrollText,
  Stethoscope,
  UserRound,
  UserRoundSearch,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@/features/auth/permissions';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the link only renders when the signed-in role holds the permission. */
  permission?: Permission;
};

/**
 * A titled group of navigation links.
 *
 * <p>The flat list this replaced was 23 rows for Super Admin, which gave no hint
 * where one area ended and the next began. Grouping by area matches how the work is
 * actually done — staff, then money, then oversight — and makes the sidebar
 * scannable without a search box.
 */
export type NavGroup = {
  title: string;
  items: readonly NavItem[];
};

/**
 * Navigation per role, grouped by area and filtered at render time by the permission
 * list. Keeping this declarative means adding a role never requires touching AppShell.
 */
export const NAV_GROUPS_BY_ROLE: Record<string, readonly NavGroup[]> = {
  ADMIN: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
    },
    {
      title: 'People',
      items: [
        { label: 'Users', href: '/admin/users', icon: Users, permission: PERMISSIONS.USER_MANAGE },
        { label: 'Roles', href: '/admin/roles', icon: ShieldCheck, permission: PERMISSIONS.ROLE_MANAGE },
        { label: 'Doctors', href: '/admin/doctors', icon: Stethoscope, permission: PERMISSIONS.STAFF_MANAGE },
        {
          label: 'Patients',
          href: '/admin/patients',
          icon: UserRound,
          permission: PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        {
          label: 'Doctor Availability',
          href: '/admin/doctor-availability',
          icon: Clock,
          permission: PERMISSIONS.STAFF_MANAGE,
        },
        {
          label: 'Laboratories',
          href: '/admin/laboratories',
          icon: Beaker,
          permission: PERMISSIONS.STAFF_MANAGE,
        },
        {
          label: 'Appointments',
          href: '/admin/appointments',
          icon: CalendarDays,
          permission: PERMISSIONS.APPOINTMENT_MANAGE,
        },
        { label: 'Pharmacy', href: '/admin/pharmacy', icon: PillBottle, permission: PERMISSIONS.REPORT_READ },
        {
          label: 'Pharmacy Inventory',
          href: '/pharmacist/inventory',
          icon: Package,
          permission: PERMISSIONS.INVENTORY_MANAGE,
        },
      ],
    },
    {
      title: 'Oversight',
      items: [
        { label: 'Analytics', href: '/admin/analytics', icon: Activity, permission: PERMISSIONS.REPORT_READ },
        { label: 'Audit Log', href: '/admin/audit-log', icon: ScrollText, permission: PERMISSIONS.AUDIT_READ },
        { label: 'Settings', href: '/admin/settings', icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
      ],
    },
  ],
  HOSPITAL_ADMIN: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/hospital', icon: LayoutDashboard }],
    },
    {
      title: 'Hospital',
      items: [
        {
          label: 'Departments',
          href: '/hospital/departments',
          icon: Stethoscope,
          permission: PERMISSIONS.DEPARTMENT_MANAGE,
        },
        { label: 'Staff', href: '/hospital/staff', icon: Users, permission: PERMISSIONS.STAFF_MANAGE },
        { label: 'Wards & Rooms', href: '/hospital/wards', icon: ClipboardList, permission: PERMISSIONS.WARD_MANAGE },
        { label: 'Front Desk', href: '/reception', icon: CalendarDays, permission: PERMISSIONS.QUEUE_MANAGE },
      ],
    },
    {
      title: 'Oversight',
      items: [{ label: 'Reports', href: '/hospital/reports', icon: FileText, permission: PERMISSIONS.REPORT_READ }],
    },
  ],
  DOCTOR: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/doctor', icon: LayoutDashboard }],
    },
    {
      title: 'Clinical',
      items: [
        { label: 'My Patients', href: '/doctor/patients', icon: UserRoundSearch },
        { label: 'Appointments', href: '/doctor/appointments', icon: CalendarDays },
        { label: 'Records', href: '/doctor/records/new', icon: ClipboardList },
        { label: 'Lab Investigations', href: '/doctor/laboratory', icon: Beaker },
        { label: 'Lab Statistics', href: '/doctor/laboratory/statistics', icon: FileText },
        { label: 'Prescriptions', href: '/doctor/prescriptions/new', icon: PillBottle },
      ],
    },
    {
      title: 'Practice',
      items: [
        { label: 'Availability', href: '/doctor/availability', icon: Activity },
        { label: 'Schedule', href: '/doctor/schedule', icon: CalendarDays },
        { label: 'Settings', href: '/doctor/settings', icon: Settings },
      ],
    },
  ],
  NURSE: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/nurse', icon: LayoutDashboard }],
    },
    {
      title: 'Ward',
      items: [
        { label: 'My Patients', href: '/nurse/patients', icon: UserRoundSearch },
        { label: 'Vitals', href: '/nurse/vitals', icon: ClipboardList, permission: PERMISSIONS.VITAL_WRITE },
        {
          label: 'Medication Administration',
          href: '/nurse/medications',
          icon: PillBottle,
          permission: PERMISSIONS.MEDICATION_ADMINISTER,
        },
      ],
    },
  ],
  RECEPTIONIST: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/reception', icon: LayoutDashboard }],
    },
    {
      title: 'Front Desk',
      items: [
        {
          label: 'Register Patient',
          href: '/reception/register',
          icon: UserRound,
          permission: PERMISSIONS.PATIENT_REGISTER,
        },
        {
          label: 'Appointments',
          href: '/reception/appointments',
          icon: CalendarDays,
          permission: PERMISSIONS.APPOINTMENT_MANAGE,
        },
        { label: 'Queue', href: '/reception/queue', icon: ClipboardList, permission: PERMISSIONS.QUEUE_MANAGE },
        {
          label: 'Assign Doctor',
          href: '/reception/assign',
          icon: UserRoundSearch,
          permission: PERMISSIONS.PATIENT_ASSIGN,
        },
      ],
    },
  ],
  LAB_TECHNICIAN: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/laboratory', icon: LayoutDashboard }],
    },
    {
      title: 'Laboratory',
      items: [
        { label: 'Orders', href: '/laboratory/orders', icon: ClipboardList },
        { label: 'Results', href: '/laboratory/results', icon: FileText },
        { label: 'Profile', href: '/laboratory/profile', icon: UserRound },
      ],
    },
  ],
  PHARMACIST: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/pharmacist/dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Pharmacy',
      items: [
        { label: 'Verify & Dispense', href: '/pharmacist/orders', icon: PillBottle },
        {
          label: 'Inventory',
          href: '/pharmacist/inventory',
          icon: Package,
          permission: PERMISSIONS.INVENTORY_MANAGE,
        },
        {
          label: 'Batches & Expiry',
          href: '/pharmacist/batches',
          icon: Clock,
          permission: PERMISSIONS.BATCH_MANAGE,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', href: '/pharmacist/profile', icon: UserRound },
        { label: 'Settings', href: '/pharmacist/settings', icon: Settings },
      ],
    },
  ],
  CASHIER: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/cashier', icon: LayoutDashboard }],
    },
    {
      title: 'Finance',
      items: [
        { label: 'Invoices', href: '/cashier/invoices', icon: Wallet, permission: PERMISSIONS.INVOICE_READ },
        {
          label: 'Payments',
          href: '/cashier/payments',
          icon: BadgeDollarSign,
          permission: PERMISSIONS.PAYMENT_CREATE,
        },
        { label: 'Refunds', href: '/cashier/refunds', icon: Wallet, permission: PERMISSIONS.REFUND_CREATE },
      ],
    },
  ],
  PATIENT: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', href: '/patient', icon: LayoutDashboard }],
    },
    {
      title: 'My Health',
      items: [
        { label: 'Book Appointment', href: '/patient/book-appointment', icon: CalendarDays },
        { label: 'Appointment History', href: '/patient/appointments', icon: ClipboardList },
        { label: 'Medical Records', href: '/patient/records', icon: FileText },
        { label: 'Prescriptions', href: '/patient/prescriptions', icon: PillBottle },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', href: '/patient/profile', icon: UserRound },
        { label: 'Settings', href: '/patient/settings', icon: Settings },
      ],
    },
  ],
};

/** Legacy role kept so existing accounts and routes keep working. */
NAV_GROUPS_BY_ROLE.LABORATORY = NAV_GROUPS_BY_ROLE.LAB_TECHNICIAN;

/**
 * Super Admin navigation.
 *
 * <p>A single index into every module the hospital runs, so the administrator has one
 * place to work from instead of guessing which area owns which data. Each entry is
 * gated on the permission its page needs, so a link is never rendered for a page the
 * API would refuse.
 */
NAV_GROUPS_BY_ROLE.SUPER_ADMIN = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'All Users', href: '/admin/users', icon: Users, permission: PERMISSIONS.USER_MANAGE },
      { label: 'Roles & Permissions', href: '/admin/roles', icon: ShieldCheck, permission: PERMISSIONS.ROLE_MANAGE },
    ],
  },
  {
    title: 'Clinical Staff',
    items: [
      { label: 'Doctors', href: '/admin/doctors', icon: Stethoscope, permission: PERMISSIONS.STAFF_MANAGE },
      { label: 'Nurses', href: '/admin/nurses', icon: HeartPulse, permission: PERMISSIONS.STAFF_MANAGE },
      { label: 'Receptionists', href: '/admin/receptionists', icon: UserRound, permission: PERMISSIONS.STAFF_MANAGE },
      { label: 'Pharmacists', href: '/admin/pharmacists', icon: PillBottle, permission: PERMISSIONS.STAFF_MANAGE },
      { label: 'Laboratory', href: '/admin/laboratory', icon: Beaker, permission: PERMISSIONS.STAFF_MANAGE },
      { label: 'Cashiers', href: '/admin/cashiers', icon: BadgeDollarSign, permission: PERMISSIONS.STAFF_MANAGE },
    ],
  },
  {
    title: 'Patients & Care',
    items: [
      { label: 'Patients', href: '/admin/patients', icon: UserRoundSearch, permission: PERMISSIONS.PATIENT_DIRECTORY_READ },
      {
        label: 'Appointments',
        href: '/admin/appointments',
        icon: CalendarDays,
        permission: PERMISSIONS.APPOINTMENT_MANAGE,
      },
      // Medical records are clinical: SUPER_ADMIN is intentionally not granted
      // `diagnosis:write`, so this page renders a "restricted" notice rather than data.
      {
        label: 'Medical Records',
        href: '/admin/records',
        icon: FileText,
        permission: PERMISSIONS.PATIENT_DEMOGRAPHICS_READ,
      },
      { label: 'Prescriptions', href: '/admin/prescriptions', icon: ClipboardList, permission: PERMISSIONS.REPORT_READ },
      { label: 'Departments', href: '/admin/departments', icon: Building2, permission: PERMISSIONS.REPORT_READ },
      { label: 'Wards & Rooms', href: '/admin/wards', icon: BedDouble, permission: PERMISSIONS.REPORT_READ },
    ],
  },
  {
    title: 'Pharmacy',
    items: [
      { label: 'Dispensing', href: '/admin/pharmacy', icon: PillBottle, permission: PERMISSIONS.REPORT_READ },
      {
        label: 'Inventory',
        href: '/admin/pharmacy/inventory',
        icon: Package,
        permission: PERMISSIONS.REPORT_READ,
      },
      { label: 'Batches & Expiry', href: '/admin/pharmacy/batches', icon: Clock, permission: PERMISSIONS.REPORT_READ },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Billing', href: '/admin/billing', icon: Wallet, permission: PERMISSIONS.INVOICE_READ },
      { label: 'Payments', href: '/admin/payments', icon: BadgeDollarSign, permission: PERMISSIONS.INVOICE_READ },
    ],
  },
  {
    title: 'Oversight',
    items: [
      {
        label: 'Reports & Analytics',
        href: '/admin/analytics',
        icon: Activity,
        permission: PERMISSIONS.REPORT_READ,
      },
      { label: 'Audit Logs', href: '/admin/audit-log', icon: ScrollText, permission: PERMISSIONS.AUDIT_READ },
      { label: 'Settings', href: '/admin/settings', icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
];

/**
 * Flattens the groups into one list, dropping empty groups.
 *
 * <p>Kept so callers that genuinely want a flat list (tests, breadcrumbs) do not
 * have to reimplement the grouping rules — including the requirement that a group
 * with no permitted links must disappear entirely rather than render as a bare
 * heading.
 */
/**
 * Flat list of every link for a role, ignoring permissions.
 *
 * <p>For callers that need a plain list and do their own filtering. Rendering should
 * use {@link navGroupsForRole}, which applies permissions and drops empty groups.
 */
export function visibleNavForRole(role?: string | null): readonly NavItem[] {
  if (!role) return [];
  return (NAV_GROUPS_BY_ROLE[role] ?? []).flatMap((group) => group.items);
}

/**
 * The groups to render, with permission filtering applied.
 *
 * <p>A group whose links are all filtered out is removed: leaving an empty "Finance"
 * heading over nothing reads as a broken screen.
 */
export function navGroupsForRole(
  role: string | null | undefined,
  hasPermission: (permission: Permission) => boolean
): NavGroup[] {
  if (!role) return [];

  return (NAV_GROUPS_BY_ROLE[role] ?? [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}
