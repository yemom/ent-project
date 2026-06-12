# clinic Database Schema Design

##  Overview

Production-ready database schema for clinic - Clinic Appointment & Medical Records Management System. Built on PostgreSQL 15+ with normalized relational design, proper indexing, and referential integrity.

---

##  Architecture & Design Patterns

### Inheritance Strategy: Single Table Inheritance (STI)

The User entity hierarchy uses **Single Table Inheritance** implemented through a discriminator column:

```
USERS table (single table inheritance)
├── PATIENT (user_type = 'PATIENT')
├── DOCTOR (user_type = 'DOCTOR')
└── ADMIN (user_type = 'ADMIN')
```

**Advantages:**

- Single SELECT for polymorphic queries
- Efficient joins for relationships
- No need for complex UNION queries
- Easier to add new user types

**Trade-off:**

- Some columns may be NULL for certain user types (acceptable for this domain)

---

##  Entity-Relationship Diagram

```
┌─────────────┐
│    USERS    │ (Single Table Inheritance)
├─────────────┤
│ id (PK)     │
│ user_type   │ ◄── Discriminator
│ email       │
│ password    │
│ full_name   │
│ role        │
│ phone       │
│ active      │
│             │
│ [Patient-specific fields]
│ [Doctor-specific fields]
│             │
│ created_at  │
│ updated_at  │
└─────────────┘
      ▲   ▲
      │   │
      │   └──────────────────┐
      │                      │
  1:N │                      │ 1:N
      │                      │
      │                  ┌──────────────────┐
      │                  │   APPOINTMENTS   │
      │                  ├──────────────────┤
      └─────────────────►│ id (PK)          │
                         │ patient_id (FK)  │
                         │ doctor_id (FK)   │◄────────┐
                         │ appointment_date │         │
                         │ duration         │         │
                         │ status           │         │ 1:N
                         │ created_at       │         │
                         │ updated_at       │         │
                         └──────────────────┘         │
                                │                     │
                                │ 1:N                 │
                                │                     │
                         ┌──────────────────┐         │
                         │ MEDICAL_RECORDS  │         │
                         ├──────────────────┤         │
                         │ id (PK)          │         │
                         │ patient_id (FK)  │◄────┐   │
                         │ doctor_id (FK)   │     │   │
                         │ appointment_id(FK)├─────┼───┘
                         │ diagnosis        │     │
                         │ treatment        │     │
                         │ prescription     │     │
                         │ test_results     │     │
                         │ vital_signs      │     │
                         │ follow_up_req    │     │
                         │ created_at       │     │
                         │ updated_at       │     │
                         └──────────────────┘     │
                                                  │
                         Can be created without   │
                         appointment (standalone) │
```

---

##  Table Specifications

### 1. USERS Table

**Purpose**: Central repository for all user types (Patient, Doctor, Admin)

**Inheritance Strategy**: Single Table Inheritance (Discriminator column: `user_type`)

#### Columns:

| Column                    | Type           | Constraints                          | Description                                 |
| ------------------------- | -------------- | ------------------------------------ | ------------------------------------------- |
| `id`                      | UUID           | PK, Default: gen_random_uuid()       | Primary key                                 |
| `user_type`               | VARCHAR(20)    | NOT NULL                             | Discriminator: 'PATIENT', 'DOCTOR', 'ADMIN' |
| `email`                   | VARCHAR(100)   | NOT NULL, UNIQUE, Indexed            | User email address                          |
| `password`                | VARCHAR(255)   | NOT NULL                             | Hashed password (BCrypt)                    |
| `full_name`               | VARCHAR(100)   | NOT NULL                             | User's full name                            |
| `phone`                   | VARCHAR(20)    | Indexed, Nullable                    | Phone number                                |
| `role`                    | user_role ENUM | NOT NULL                             | 'ADMIN', 'DOCTOR', 'PATIENT'                |
| `active`                  | BOOLEAN        | NOT NULL, Default: TRUE              | Account active status                       |
| **Patient-specific**      |
| `date_of_birth`           | DATE           | Nullable                             | Patient's DOB                               |
| `gender`                  | gender ENUM    | Nullable                             | 'MALE', 'FEMALE', 'OTHER'                   |
| `medical_history`         | TEXT           | Nullable                             | Patient's medical history                   |
| `blood_type`              | VARCHAR(5)     | Nullable                             | Blood type (e.g., 'O+')                     |
| `allergies`               | TEXT           | Nullable                             | Known allergies                             |
| `emergency_contact_name`  | VARCHAR(100)   | Nullable                             | Emergency contact name                      |
| `emergency_contact_phone` | VARCHAR(20)    | Nullable                             | Emergency contact phone                     |
| **Doctor-specific**       |
| `specialization`          | VARCHAR(100)   | Nullable                             | Medical specialization                      |
| `license_number`          | VARCHAR(50)    | UNIQUE, Nullable, Indexed            | Medical license number                      |
| `years_of_experience`     | INTEGER        | Nullable                             | Years in practice                           |
| `qualifications`          | TEXT           | Nullable                             | Academic qualifications                     |
| `consultation_fee`        | DECIMAL(10,2)  | Nullable                             | Fee per consultation                        |
| `bio`                     | TEXT           | Nullable                             | Doctor biography                            |
| `available`               | BOOLEAN        | Default: TRUE                        | Doctor availability status                  |
| **Audit**                 |
| `created_at`              | TIMESTAMP      | NOT NULL, Default: CURRENT_TIMESTAMP | Record creation time                        |
| `updated_at`              | TIMESTAMP      | NOT NULL, Default: CURRENT_TIMESTAMP | Last update time                            |

#### Indexes:

- `idx_email` - Email lookup (unique constraint)
- `idx_phone` - Phone number search
- `idx_user_type` - Filter by user type
- `idx_role` - Filter by role
- `idx_license_number` - Doctor license lookup
- `idx_active` - Filter by active status

#### Constraints:

- PK: `id`
- UNIQUE: `email`, `license_number`
- CHECK: `user_type IN ('PATIENT', 'DOCTOR', 'ADMIN')`
- CHECK: `active IN (TRUE, FALSE)`
- ENUM: `role`, `gender`

---

### 2. APPOINTMENTS Table

**Purpose**: Track scheduled appointments between patients and doctors

#### Columns:

| Column                | Type                    | Constraints                             | Description                         |
| --------------------- | ----------------------- | --------------------------------------- | ----------------------------------- |
| `id`                  | UUID                    | PK                                      | Primary key                         |
| `patient_id`          | UUID                    | FK, NOT NULL, Indexed                   | Reference to Patient (Users table)  |
| `doctor_id`           | UUID                    | FK, NOT NULL, Indexed                   | Reference to Doctor (Users table)   |
| `appointment_date`    | TIMESTAMP               | NOT NULL, Indexed                       | When the appointment is scheduled   |
| `duration`            | INTEGER                 | NOT NULL, CHECK > 0                     | Duration in minutes                 |
| `status`              | appointment_status ENUM | NOT NULL, Default: 'SCHEDULED', Indexed | Appointment status                  |
| `reason_for_visit`    | VARCHAR(500)            | Nullable                                | Reason for the appointment          |
| `notes`               | TEXT                    | Nullable                                | Appointment notes                   |
| `reminder_sent`       | BOOLEAN                 | NOT NULL, Default: FALSE                | Reminder notification sent flag     |
| `reminder_sent_at`    | TIMESTAMP               | Nullable                                | When reminder was sent              |
| `cancelled_by`        | VARCHAR(50)             | Nullable                                | Who cancelled (user_id or username) |
| `cancellation_reason` | TEXT                    | Nullable                                | Why it was cancelled                |
| `cancellation_date`   | TIMESTAMP               | Nullable                                | When it was cancelled               |
| `created_at`          | TIMESTAMP               | NOT NULL                                | Record creation time                |
| `updated_at`          | TIMESTAMP               | NOT NULL                                | Last update time                    |

#### Indexes:

- `idx_patient_id` - Find appointments by patient
- `idx_doctor_id` - Find appointments by doctor
- `idx_appointment_date` - Find appointments by date
- `idx_status` - Filter by status
- `idx_appointment_patient_doctor` - Composite for patient-doctor pairs
- `idx_appointment_date_status` - Composite for date-status queries

#### Foreign Keys:

- `patient_id` → `users.id` (ON DELETE CASCADE) - Patient record deletion removes appointments
- `doctor_id` → `users.id` (ON DELETE RESTRICT) - Doctor can't be deleted if has appointments

#### Appointment Status Values:

- `SCHEDULED` - Appointment is scheduled
- `CONFIRMED` - Appointment confirmed by doctor
- `COMPLETED` - Appointment completed
- `CANCELLED` - Appointment was cancelled
- `NO_SHOW` - Patient didn't show up

---

### 3. MEDICAL_RECORDS Table

**Purpose**: Store patient medical records, diagnoses, treatments, and prescriptions

#### Columns:

| Column                | Type        | Constraints              | Description                                                             |
| --------------------- | ----------- | ------------------------ | ----------------------------------------------------------------------- |
| `id`                  | UUID        | PK                       | Primary key                                                             |
| `patient_id`          | UUID        | FK, NOT NULL, Indexed    | Reference to Patient                                                    |
| `doctor_id`           | UUID        | FK, Nullable, Indexed    | Reference to Doctor who created record                                  |
| `appointment_id`      | UUID        | FK, Nullable, Indexed    | Associated appointment (optional)                                       |
| `diagnosis`           | TEXT        | Nullable                 | Medical diagnosis                                                       |
| `treatment`           | TEXT        | Nullable                 | Treatment plan                                                          |
| `prescription`        | TEXT        | Nullable                 | Prescribed medications                                                  |
| `test_results`        | TEXT        | Nullable                 | Laboratory test results                                                 |
| `vital_signs`         | TEXT        | Nullable                 | Vital signs (BP, HR, Temp, etc.)                                        |
| `follow_up_required`  | BOOLEAN     | NOT NULL, Default: FALSE | Requires follow-up flag                                                 |
| `follow_up_date`      | DATE        | Nullable                 | Scheduled follow-up date                                                |
| `notes`               | TEXT        | Nullable                 | Additional notes                                                        |
| `record_date`         | DATE        | NOT NULL, Indexed        | When the record was created                                             |
| `medical_record_type` | VARCHAR(50) | Nullable                 | Type: CONSULTATION, SURGERY, LAB_TEST, VACCINATION, PRESCRIPTION, NOTES |
| `is_confidential`     | BOOLEAN     | NOT NULL, Default: FALSE | Confidential flag                                                       |
| `created_at`          | TIMESTAMP   | NOT NULL                 | Record creation time                                                    |
| `updated_at`          | TIMESTAMP   | NOT NULL                 | Last update time                                                        |

#### Indexes:

- `idx_patient_id_mr` - Find records by patient
- `idx_doctor_id_mr` - Find records by doctor
- `idx_appointment_id_mr` - Find records by appointment
- `idx_record_date` - Find records by date
- `idx_patient_record_date` - Composite for patient history
- `idx_confidential` - Filter confidential records

#### Foreign Keys:

- `patient_id` → `users.id` (ON DELETE CASCADE) - Patient deletion removes all records
- `doctor_id` → `users.id` (ON DELETE SET NULL) - Doctor deletion nullifies doctor reference
- `appointment_id` → `appointments.id` (ON DELETE SET NULL) - Appointment deletion nullifies reference

---

##  Relationships Summary

| From        | To            | Type | Cascade    | Fetch | Description                          |
| ----------- | ------------- | ---- | ---------- | ----- | ------------------------------------ |
| Patient     | Appointment   | 1:N  | ALL/Remove | LAZY  | One patient has many appointments    |
| Doctor      | Appointment   | 1:N  | ALL/Remove | LAZY  | One doctor has many appointments     |
| Patient     | MedicalRecord | 1:N  | ALL/Remove | LAZY  | One patient has many medical records |
| Doctor      | MedicalRecord | 1:N  | None       | LAZY  | One doctor created many records      |
| Appointment | MedicalRecord | 1:N  | ALL/Remove | LAZY  | One appointment may have records     |

---

##  Constraints & Validation

### Data Integrity

- **Referential Integrity**: Foreign key constraints enforce relationships
- **Uniqueness**: email, license_number are unique
- **Domain Validation**: Enum types for role, gender, status
- **Check Constraints**: duration > 0, valid enum values

### Business Logic (Database Triggers)

#### `validate_appointment()` Trigger

Validates appointments before insert/update:

- Appointment date must be future for SCHEDULED status
- Patient must exist and be PATIENT type
- Doctor must exist and be DOCTOR type
- Both patient and doctor must be active

#### `validate_medical_record()` Trigger

Validates medical records before insert/update:

- Patient must exist and be PATIENT type
- Doctor must exist and be DOCTOR type (if provided)
- Record date cannot be in future
- Follow-up date must be future if follow-up required

#### `update_updated_at_column()` Trigger

Automatically updates `updated_at` timestamp on record modifications

---

##  Views (for convenience queries)

### 1. `patients` View

Filtered view of all patient users

```sql
SELECT * FROM users WHERE user_type = 'PATIENT'
```

### 2. `doctors` View

Filtered view of all doctor users

```sql
SELECT * FROM users WHERE user_type = 'DOCTOR'
```

### 3. `appointment_summaries` View

Comprehensive appointment information with patient and doctor details

```sql
SELECT
    a.id, a.appointment_date, a.duration, a.status,
    p.full_name AS patient_name, p.email AS patient_email,
    d.full_name AS doctor_name, d.specialization,
    a.created_at, a.updated_at
FROM appointments a
JOIN users p ON a.patient_id = p.id
JOIN users d ON a.doctor_id = d.id
```

### 4. `doctor_appointment_stats` (Materialized View)

Statistics about each doctor's appointments

- Total appointments
- Completed / Cancelled / Scheduled / No-show counts
- Average appointment duration
- Last appointment date

### 5. `patient_medical_summary` (Materialized View)

Summary of patient medical activity

- Total appointments
- Total medical records
- Last appointment date
- Pending follow-ups

---

##  Audit Trail

### audit_logs Table

**Purpose**: Track all changes to critical tables

| Column       | Type         | Description               |
| ------------ | ------------ | ------------------------- |
| `id`         | UUID         | Primary key               |
| `table_name` | VARCHAR(100) | Which table was changed   |
| `operation`  | VARCHAR(10)  | INSERT, UPDATE, or DELETE |
| `record_id`  | UUID         | Which record was affected |
| `old_values` | JSONB        | Previous values           |
| `new_values` | JSONB        | New values                |
| `changed_by` | UUID         | User who made change      |
| `changed_at` | TIMESTAMP    | When it was changed       |

**Note**: Audit logging triggers can be added on-demand

---

##  Performance Optimization

### Index Strategy

1. **Foreign Keys**: All FK columns indexed for JOINs
2. **Search Fields**: email, phone, specialization
3. **Filter Fields**: user_type, role, status, active
4. **Range Queries**: appointment_date, record_date, created_at
5. **Composite Indexes**: Common query patterns (patient_id, doctor_id, date_range)

### Query Optimization Tips

```sql
-- Efficient appointment lookup
SELECT * FROM appointments
WHERE patient_id = $1 AND appointment_date >= $2
ORDER BY appointment_date DESC;

-- Doctor statistics (use materialized view)
SELECT * FROM doctor_appointment_stats WHERE id = $1;

-- Patient history (use materialized view)
SELECT * FROM patient_medical_summary WHERE id = $1;

-- Appointment with doctor details
SELECT a.*, d.specialization, d.consultation_fee
FROM appointment_summaries a
WHERE a.patient_id = $1;
```

### Materialized View Refresh

```sql
REFRESH MATERIALIZED VIEW doctor_appointment_stats;
REFRESH MATERIALIZED VIEW patient_medical_summary;
```

Recommended refresh: After bulk operations or on schedule (e.g., hourly)

---

##  Scalability Considerations

### Current Design Handles:

-  Millions of users (UUID primary keys)
-  High appointment volume (indexed by patient/doctor/date)
-  Large medical records (TEXT columns with full-text search potential)
-  Complex queries (materialized views for aggregations)

### Future Enhancements:

- Table partitioning by date (appointments, medical_records by year)
- Read replicas for reporting queries
- Caching layer (Redis) for materialized views
- Archive tables for historical data
- Data warehousing for analytics

---

##  Sample Queries

### Find patient's upcoming appointments

```sql
SELECT * FROM appointment_summaries
WHERE patient_id = $1 AND appointment_date > CURRENT_TIMESTAMP
ORDER BY appointment_date ASC;
```

### Find doctor's schedule for a date range

```sql
SELECT * FROM appointments
WHERE doctor_id = $1
AND appointment_date BETWEEN $2 AND $3
ORDER BY appointment_date ASC;
```

### Get patient's medical history

```sql
SELECT * FROM medical_records
WHERE patient_id = $1
ORDER BY record_date DESC;
```

### Find doctors by specialization with appointments

```sql
SELECT DISTINCT d.*
FROM users d
JOIN appointments a ON d.id = a.doctor_id
WHERE d.specialization = $1
AND d.active = TRUE
ORDER BY d.full_name;
```

### Doctor's appointment statistics

```sql
SELECT * FROM doctor_appointment_stats
WHERE id = $1;
```

---

##  Flyway Migrations

### V1\_\_init_schema.sql

- Create all tables with relationships
- Create enums (PostgreSQL-specific)
- Add indexes
- Add views
- Insert default admin user

### V2\_\_add_constraints_and_triggers.sql

- Create validation triggers
- Create update timestamp triggers
- Create audit_logs table
- Create materialized views
- Create helper functions

---

##  Notes for Development

1. **UUID vs Auto-increment**: Using UUID for scalability and distributed systems
2. **Single Table Inheritance**: Simplifies queries, eliminates JOINs for polymorphism
3. **Soft Deletes**: Not used; rely on foreign key constraints
4. **Timestamps**: Auto-managed by triggers; prefer `updated_at` over checking specific columns
5. **Materialized Views**: Refresh periodically for accurate statistics
6. **Password Storage**: Application must hash passwords before INSERT (BCrypt)
7. **Timezone**: All timestamps in database (use application timezone handling)

---

**Schema Version**: 1.0  
**Created**: May 6, 2026  
**Database**: PostgreSQL 15+  
**Status**: Production Ready
