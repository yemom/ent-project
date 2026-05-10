export const APP_NAME = 'clinic';
export const APP_TAGLINE = 'Healthcare clinic management suite';

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  PATIENT: 'Patient',
  PHARMACIST: 'Pharmacist'
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

export default {
  APP_NAME,
  APP_TAGLINE,
  ROLE_LABELS,
  ROUTES
};
