-- Add indexes used by pageable filters, counts, and soft-delete-aware lookups.

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_users_user_type_active ON users(user_type, active);
CREATE INDEX IF NOT EXISTS idx_users_full_name_lower ON users(LOWER(full_name));

CREATE INDEX IF NOT EXISTS idx_appointments_status_date ON appointments(status, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date ON appointments(patient_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_medical_records_patient_record_date ON medical_records(patient_id, record_date);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_record_date ON medical_records(doctor_id, record_date);
CREATE INDEX IF NOT EXISTS idx_medical_records_follow_up_date ON medical_records(follow_up_date) WHERE follow_up_required = TRUE;

CREATE INDEX IF NOT EXISTS idx_lab_orders_status_created_at ON lab_orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_status ON lab_orders(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor_status ON lab_orders(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_urgency ON lab_orders(urgency);

CREATE INDEX IF NOT EXISTS idx_lab_results_status_created_at ON lab_results(status, created_at);
CREATE INDEX IF NOT EXISTS idx_lab_results_technician_status ON lab_results(lab_technician_id, status);

CREATE INDEX IF NOT EXISTS idx_lab_notifications_user_read_created ON lab_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_notifications_order_result ON lab_notifications(lab_order_id, lab_result_id);

CREATE INDEX IF NOT EXISTS idx_laboratories_status_name ON laboratories(status, name);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor_day ON doctor_availability(doctor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_lab_day ON doctor_availability(laboratory_id, day_of_week);
