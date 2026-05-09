# clinic - Entity Relationships & JPA Configuration

## 📐 Entity Class Hierarchy

```
BaseEntity (Abstract, @MappedSuperclass)
├── id: UUID (Primary Key)
├── createdAt: LocalDateTime
└── updatedAt: LocalDateTime

    ↓

User (Abstract, @Entity)
├── Inheritance Strategy: SINGLE_TABLE
├── Discriminator Column: user_type
│
├─── Patient (Concrete Entity)
│    └── Patient-specific fields (dateOfBirth, gender, allergies, etc.)
│
├─── Doctor (Concrete Entity)
│    └── Doctor-specific fields (specialization, license_number, etc.)
│
└─── Admin (Concrete Entity via user_type = 'ADMIN')
     └── Uses base User fields only

    ↓

    Appointment (@Entity)
    ├── patient_id: @ManyToOne → Patient
    ├── doctor_id: @ManyToOne → Doctor
    └── medicalRecords: @OneToMany ← MedicalRecord

    ↓

    MedicalRecord (@Entity)
    ├── patient_id: @ManyToOne → Patient
    ├── doctor_id: @ManyToOne → Doctor
    └── appointment_id: @ManyToOne → Appointment (optional)
```

---

## 🔗 Entity Relationships in Detail

### 1. Patient ↔ Appointment (1:N)

**Relationship Type**: OneToMany / ManyToOne

**JPA Annotations**:

```java
// In Patient.java
@OneToMany(
    mappedBy = "patient",
    cascade = CascadeType.ALL,
    orphanRemoval = true,
    fetch = FetchType.LAZY
)
private List<Appointment> appointments = new ArrayList<>();

// In Appointment.java
@ManyToOne(fetch = FetchType.EAGER, optional = false)
@JoinColumn(name = "patient_id", nullable = false)
private Patient patient;
```

**Behavior**:

- One patient can have multiple appointments
- Appointments are removed if patient is deleted (CASCADE)
- Orphaned appointments are removed (orphanRemoval)
- Fetching appointments is lazy (on demand)
- Patient is eagerly loaded with appointment

**Database**:

- Foreign Key: `appointments.patient_id → users.id`
- Index: `idx_patient_id`
- Constraint: ON DELETE CASCADE

---

### 2. Doctor ↔ Appointment (1:N)

**Relationship Type**: OneToMany / ManyToOne

**JPA Annotations**:

```java
// In Doctor.java
@OneToMany(
    mappedBy = "doctor",
    cascade = CascadeType.ALL,
    orphanRemoval = true,
    fetch = FetchType.LAZY
)
private List<Appointment> appointments = new ArrayList<>();

// In Appointment.java
@ManyToOne(fetch = FetchType.EAGER, optional = false)
@JoinColumn(name = "doctor_id", nullable = false)
private Doctor doctor;
```

**Behavior**:

- One doctor can have multiple appointments
- Appointments are removed if doctor is deleted (CASCADE)
- Orphaned appointments are removed (orphanRemoval)
- Doctor is eagerly loaded with appointment

**Database**:

- Foreign Key: `appointments.doctor_id → users.id`
- Index: `idx_doctor_id`
- Constraint: ON DELETE RESTRICT (doctor can't be deleted if has appointments)

---

### 3. Patient ↔ MedicalRecord (1:N)

**Relationship Type**: OneToMany / ManyToOne

**JPA Annotations**:

```java
// In Patient.java
@OneToMany(
    mappedBy = "patient",
    cascade = CascadeType.ALL,
    orphanRemoval = true,
    fetch = FetchType.LAZY
)
private List<MedicalRecord> medicalRecords = new ArrayList<>();

// In MedicalRecord.java
@ManyToOne(fetch = FetchType.EAGER, optional = false)
@JoinColumn(name = "patient_id", nullable = false)
private Patient patient;
```

**Behavior**:

- One patient can have multiple medical records
- Medical records are removed if patient is deleted (CASCADE)
- Orphaned records are removed (orphanRemoval)
- Patient is eagerly loaded with record

**Database**:

- Foreign Key: `medical_records.patient_id → users.id`
- Index: `idx_patient_id_mr`
- Constraint: ON DELETE CASCADE

---

### 4. Doctor ↔ MedicalRecord (1:N)

**Relationship Type**: OneToMany / ManyToOne

**JPA Annotations**:

```java
// In Doctor.java
@OneToMany(
    mappedBy = "doctor",
    cascade = CascadeType.ALL,
    orphanRemoval = false,  // Don't delete records if doctor deleted
    fetch = FetchType.LAZY
)
private List<MedicalRecord> medicalRecords = new ArrayList<>();

// In MedicalRecord.java
@ManyToOne(fetch = FetchType.EAGER, optional = true)
@JoinColumn(name = "doctor_id", nullable = true)
private Doctor doctor;
```

**Behavior**:

- One doctor can create/update multiple medical records
- Medical records are NOT removed if doctor is deleted (orphanRemoval = false)
- Doctor can be NULL (optional = true)
- Doctor is eagerly loaded with record

**Database**:

- Foreign Key: `medical_records.doctor_id → users.id`
- Index: `idx_doctor_id_mr`
- Constraint: ON DELETE SET NULL

---

### 5. Appointment ↔ MedicalRecord (1:N)

**Relationship Type**: OneToMany / ManyToOne

**JPA Annotations**:

```java
// In Appointment.java
@OneToMany(
    mappedBy = "appointment",
    cascade = CascadeType.ALL,
    orphanRemoval = true,
    fetch = FetchType.LAZY
)
private List<MedicalRecord> medicalRecords = new ArrayList<>();

// In MedicalRecord.java
@ManyToOne(fetch = FetchType.LAZY, optional = true)
@JoinColumn(name = "appointment_id", nullable = true)
private Appointment appointment;
```

**Behavior**:

- One appointment can have multiple medical records
- Medical records are removed if appointment is deleted (CASCADE)
- Appointment is optional (nullable)
- Appointment is lazily loaded (on demand)

**Database**:

- Foreign Key: `medical_records.appointment_id → appointments.id`
- Index: `idx_appointment_id_mr`
- Constraint: ON DELETE SET NULL

---

## 📊 JPA Inheritance Strategy

### Single Table Inheritance (STI)

**Implementation**:

```java
@Entity
@Table(name = "users")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "user_type", discriminatorType = DiscriminatorType.STRING)
public abstract class User extends BaseEntity { ... }

@Entity
@DiscriminatorValue("PATIENT")
public class Patient extends User { ... }

@Entity
@DiscriminatorValue("DOCTOR")
public class Doctor extends User { ... }
```

**Database Effect**:

- Single `users` table with all columns
- `user_type` column determines entity type: 'PATIENT', 'DOCTOR', 'ADMIN'
- NULL values for inapplicable columns (e.g., Patient records have NULL specialization)

**Queries**:

```java
// Find all patients
List<Patient> patients = patientRepository.findAll();
// SQL: SELECT * FROM users WHERE user_type = 'PATIENT'

// Find all doctors
List<Doctor> doctors = doctorRepository.findAll();
// SQL: SELECT * FROM users WHERE user_type = 'DOCTOR'

// Find user by id (returns correct subclass)
User user = userRepository.findById(id);
// SQL: SELECT * FROM users WHERE id = ?
// Hibernate automatically instantiates correct subclass based on user_type
```

**Advantages**:

- ✅ Efficient queries (no UNION, single table)
- ✅ Polymorphic queries simple
- ✅ Easy to query base type (all users)
- ✅ Good for small number of subtypes

**Trade-offs**:

- ⚠️ Some columns NULL (acceptable in healthcare domain)
- ⚠️ Large table (mitigated by proper indexing)

---

## 🔐 JPA Cascade & Orphan Removal

### Cascade Strategies Used

| Relationship                | Cascade | Orphan Removal | Reason                                 |
| --------------------------- | ------- | -------------- | -------------------------------------- |
| Patient → Appointment       | ALL     | true           | Appointments are dependent on patient  |
| Doctor → Appointment        | ALL     | true           | Appointments are dependent on doctor   |
| Patient → MedicalRecord     | ALL     | true           | Records are dependent on patient       |
| Doctor → MedicalRecord      | ALL     | false          | Records persist even if doctor deleted |
| Appointment → MedicalRecord | ALL     | true           | Records are dependent on appointment   |

### Cascade Types:

- `CascadeType.PERSIST` - Cascade persist operations
- `CascadeType.MERGE` - Cascade merge (update) operations
- `CascadeType.REMOVE` - Cascade delete operations
- `CascadeType.ALL` - Apply all cascade operations

### Orphan Removal:

- `orphanRemoval = true` - Delete entity if removed from collection
- `orphanRemoval = false` - Keep entity (FK set to NULL if nullable)

---

## 🔄 Fetch Strategies

### Eager Loading (FetchType.EAGER)

**Used For**:

- `Patient` in `Appointment` - Always needed together
- `Doctor` in `Appointment` - Always needed together
- `Patient` in `MedicalRecord` - Always needed together
- `Doctor` in `MedicalRecord` - Usually needed

**Benefit**: Avoid N+1 query problem  
**Cost**: Extra memory (load related entities upfront)

```java
@ManyToOne(fetch = FetchType.EAGER)
private Patient patient;
```

### Lazy Loading (FetchType.LAZY)

**Used For**:

- `appointments` collection in `Patient` - May not need all appointments
- `appointments` collection in `Doctor` - May not need all appointments
- `medicalRecords` collection in `Patient` - May not need all records
- `medicalRecords` collection in `Doctor` - Large collection
- `appointment` in `MedicalRecord` - Optional relationship

**Benefit**: Load only when needed  
**Cost**: Proxy objects, potential LazyInitializationException

```java
@OneToMany(fetch = FetchType.LAZY)
private List<Appointment> appointments;
```

---

## 📋 Entity Field Validation

### BaseEntity

- `id` - UUID, auto-generated
- `createdAt` - Auto-timestamp, non-updatable
- `updatedAt` - Auto-timestamp, auto-updated

### User

- `email` - @NotBlank, @Email, unique
- `password` - @NotBlank, length 255
- `fullName` - @NotBlank, length 100
- `phone` - length 20, optional
- `role` - @Enumerated, required (ADMIN, DOCTOR, PATIENT)
- `active` - Boolean, default TRUE

### Patient (extends User)

- `dateOfBirth` - LocalDate, optional
- `gender` - @Enumerated, optional
- `bloodType` - VARCHAR(5), optional
- `allergies` - TEXT, optional
- `emergencyContactName` - VARCHAR(100), optional
- `emergencyContactPhone` - VARCHAR(20), optional
- `medicalHistory` - TEXT, optional

### Doctor (extends User)

- `specialization` - @NotBlank, length 100
- `licenseNumber` - @NotBlank, unique, length 50
- `yearsOfExperience` - @Positive, optional
- `qualifications` - TEXT, optional
- `consultationFee` - DECIMAL(10,2), optional
- `available` - Boolean, default TRUE

### Appointment

- `patient` - @NotNull, @ManyToOne(optional=false)
- `doctor` - @NotNull, @ManyToOne(optional=false)
- `appointmentDate` - @NotNull, LocalDateTime
- `duration` - @Positive, minutes
- `status` - @Enumerated, default SCHEDULED
- `reasonForVisit` - VARCHAR(500), optional
- `notes` - TEXT, optional
- `reminderSent` - Boolean, default FALSE
- `cancellationReason` - TEXT, optional

### MedicalRecord

- `patient` - @NotNull, @ManyToOne(optional=false)
- `doctor` - @ManyToOne(optional=true)
- `appointment` - @ManyToOne(optional=true)
- `diagnosis` - TEXT, optional
- `treatment` - TEXT, optional
- `prescription` - TEXT, optional
- `testResults` - TEXT, optional
- `vitalSigns` - TEXT, optional
- `followUpRequired` - Boolean, default FALSE
- `followUpDate` - LocalDate, optional
- `recordDate` - LocalDate, required
- `medicalRecordType` - VARCHAR(50), optional
- `isConfidential` - Boolean, default FALSE

---

## 🎯 Entity Initialization & Construction

### Using Lombok @Builder

All entities use `@SuperBuilder` for parent classes and `@Builder` for concrete classes:

```java
// Creating a patient
Patient patient = Patient.builder()
    .email("john@example.com")
    .password(hashedPassword)
    .fullName("John Doe")
    .phone("+1234567890")
    .role(UserRole.PATIENT)
    .dateOfBirth(LocalDate.of(1990, 1, 15))
    .gender(Gender.MALE)
    .build();

// Creating an appointment
Appointment appointment = Appointment.builder()
    .patient(patient)
    .doctor(doctor)
    .appointmentDate(LocalDateTime.now().plusDays(1))
    .duration(30)
    .status(AppointmentStatus.SCHEDULED)
    .reasonForVisit("Regular checkup")
    .build();

// Creating a medical record
MedicalRecord record = MedicalRecord.builder()
    .patient(patient)
    .doctor(doctor)
    .appointment(appointment)
    .diagnosis("Hypertension")
    .treatment("Antihypertensive medication")
    .recordDate(LocalDate.now())
    .medicalRecordType("CONSULTATION")
    .build();
```

---

## 🔐 Transactional Boundaries

### Service Layer Best Practices

```java
@Service
@Transactional  // Default is read-write
public class AppointmentService {

    // Read-only transaction (optimized)
    @Transactional(readOnly = true)
    public List<Appointment> getPatientAppointments(UUID patientId) {
        return appointmentRepository.findByPatientId(patientId);
    }

    // Write transaction with cascade handling
    @Transactional  // Read-write
    public Appointment scheduleAppointment(AppointmentRequest request) {
        Patient patient = patientRepository.findById(request.getPatientId())
            .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        Doctor doctor = doctorRepository.findById(request.getDoctorId())
            .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        Appointment appointment = Appointment.builder()
            .patient(patient)
            .doctor(doctor)
            .appointmentDate(request.getAppointmentDate())
            .duration(request.getDuration())
            .status(AppointmentStatus.SCHEDULED)
            .build();

        return appointmentRepository.save(appointment);
        // Cascades handled automatically by Hibernate
    }

    // Deletion with cascade
    @Transactional
    public void cancelAppointment(UUID appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationDate(LocalDateTime.now());

        appointmentRepository.save(appointment);
        // Medical records with this appointment will be handled by cascade
    }
}
```

---

## 🗺️ Entity-to-DTO Mapping

### Mapping Strategy

```java
// Request DTOs (for POST/PUT)
PatientCreateRequest → Patient entity

// Response DTOs (for GET/POST responses)
Patient entity → PatientResponse DTO
Doctor entity → DoctorResponse DTO
Appointment entity → AppointmentResponse DTO
MedicalRecord entity → MedicalRecordResponse DTO

// Nested DTOs to prevent circular dependencies
AppointmentResponse includes:
  - patientId, patientName
  - doctorId, doctorName
  - appointmentDate, duration, status

MedicalRecordResponse includes:
  - patientId, patientName
  - doctorId, doctorName
  - appointmentId (optional)
  - diagnosis, treatment, prescription
```

**Rationale**: Never expose raw entities in API responses (security, flexibility, API versioning)

---

## 📊 Relationship Diagram (ASCII Art)

```
┌──────────────────────────────────────────┐
│            USERS (STI)                   │
├──────────────────────────────────────────┤
│ id (PK, UUID)                            │
│ user_type (PATIENT, DOCTOR, ADMIN)       │
│ email (UNIQUE)                           │
│ password (BCrypt hashed)                 │
│ full_name                                │
│ phone                                    │
│ role (ADMIN, DOCTOR, PATIENT)            │
│ active (default: TRUE)                   │
│                                          │
│ [Patient-specific columns]               │
│ [Doctor-specific columns]                │
│                                          │
│ created_at (auto)                        │
│ updated_at (auto)                        │
└──────────────────────────────────────────┘
         ▲              ▲
         │              │
    1:N  │              │  1:N
         │              │
    Patient         Doctor
         │              │
         │              │
         ├──────┬───────┤
                │
                ↓
      ┌─────────────────────┐
      │   APPOINTMENTS      │
      ├─────────────────────┤
      │ id (PK, UUID)       │
      │ patient_id (FK)     │
      │ doctor_id (FK)      │
      │ appointment_date    │
      │ duration (minutes)  │
      │ status              │
      │ reason_for_visit    │
      │ notes               │
      │ created_at          │
      │ updated_at          │
      └─────────────────────┘
              │
          1:N │
              │
              ↓
      ┌──────────────────────┐
      │  MEDICAL_RECORDS     │
      ├──────────────────────┤
      │ id (PK, UUID)        │
      │ patient_id (FK)      │
      │ doctor_id (FK)       │
      │ appointment_id (FK)  │
      │ diagnosis            │
      │ treatment            │
      │ prescription         │
      │ test_results         │
      │ vital_signs          │
      │ follow_up_required   │
      │ follow_up_date       │
      │ record_date          │
      │ created_at           │
      │ updated_at           │
      └──────────────────────┘
```

---

## ✅ Entity Best Practices Implemented

1. ✅ **Immutable IDs**: UUID primary keys, never updated
2. ✅ **Audit Trails**: createdAt, updatedAt on all entities
3. ✅ **Validation**: Bean validation annotations + DB constraints
4. ✅ **Relationships**: Properly configured with cascade & fetch strategies
5. ✅ **Inheritance**: Clean single-table inheritance for user types
6. ✅ **Collections**: Use ArrayList with lazy loading
7. ✅ **Equals/HashCode**: Lombok handles with exclusion of collections
8. ✅ **Serialization**: Proper @Data annotations for serialization
9. ✅ **Nullability**: Explicit nullable/not-null constraints
10. ✅ **Timestamps**: Auto-managed by Hibernate

---

**Document Version**: 1.0  
**Created**: May 6, 2026  
**Status**: Complete and Production Ready
