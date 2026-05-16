export const APP_NAME = 'clinic';
export const APP_TAGLINE = 'Healthcare clinic management suite';

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  PATIENT: 'Patient',
  PHARMACIST: 'Pharmacist'
} as const;

export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  PATIENT: 'patient',
  PHARMACIST: 'pharmacist',
  LABORATORY: 'laboratory'
} as const;
export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  adminDashboard: '/admin',
  adminUsers: '/admin/users',
  adminDoctors: '/admin/doctors',
  adminPatients: '/admin/patients',
  adminPharmacy: '/admin/pharmacy',
  adminAppointments: '/admin/appointments',
  adminInviteUser: '/admin/users/invite',
  adminAddDoctor: '/admin/doctors/new',
  adminImportPatients: '/admin/patients/import',
  adminCreateAppointment: '/admin/appointments/new',
  doctorDashboard: '/doctor',
  patientDashboard: '/patient',
  pharmacistDashboard: '/pharmacist/dashboard'
} as const;

export const LAB_TEST_TYPES = [
  'CBC',
  'Blood Glucose',
  'Urinalysis',
  'Liver Function',
  'Kidney Function',
  'Thyroid Panel',
  'Lipid Panel',
  'HbA1c',
  'Culture & Sensitivity',
  'Pregnancy Test',
  'COVID-19 PCR',
  'Malaria Test',
  'Hepatitis Panel',
  'Electrolytes',
  'Coagulation Panel'
] as const;

export const LAB_ORDER_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export const LAB_URGENCY = ['routine', 'urgent', 'critical'] as const;
export const LAB_RESULT_STATUS = ['draft', 'final'] as const;
export default {
  APP_NAME,
  APP_TAGLINE,
  ROLE_LABELS,
  ROUTES
};
