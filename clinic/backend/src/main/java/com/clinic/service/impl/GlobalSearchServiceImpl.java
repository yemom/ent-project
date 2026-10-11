package com.clinic.service.impl;

import com.clinic.dto.response.GlobalSearchResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.Department;
import com.clinic.entity.Doctor;
import com.clinic.entity.Invoice;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DepartmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.InvoiceRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CurrentUser;
import com.clinic.security.RolePermissions;
import com.clinic.service.GlobalSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Cross-entity search.
 *
 * <p>Scoped rather than filtered client-side: each section is only queried when
 * the caller holds the matching permission, and a PATIENT's search is pinned to
 * their own patient row. Searching as a patient therefore cannot enumerate the
 * user or doctor directory.
 */
@Service
@Transactional(readOnly = true)
@Slf4j
public class GlobalSearchServiceImpl implements GlobalSearchService {

    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final DepartmentRepository departmentRepository;
    private final CurrentUser currentUser;

    public GlobalSearchServiceImpl(UserRepository userRepository,
                                   PatientRepository patientRepository,
                                   DoctorRepository doctorRepository,
                                   AppointmentRepository appointmentRepository,
                                   InvoiceRepository invoiceRepository,
                                   DepartmentRepository departmentRepository,
                                   CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.invoiceRepository = invoiceRepository;
        this.departmentRepository = departmentRepository;
        this.currentUser = currentUser;
    }

    @Override
    public GlobalSearchResponse search(String query, int limit) {
        String needle = query == null ? "" : query.trim();
        if (needle.length() < 2) {
            return empty(needle);
        }

        int size = Math.max(1, Math.min(limit <= 0 ? 5 : limit, 25));
        String lower = needle.toLowerCase(Locale.ROOT);
        List<GlobalSearchResponse.Hit> hits = new ArrayList<>();

        UserRole role = currentUser.role();
        boolean isPatient = role == UserRole.PATIENT;

        // Each section is gated by its own capability rather than by "is this role
        // privileged", so granting one permission never silently widens search.
        boolean canReadReport = RolePermissions.has(role, com.clinic.security.Permissions.REPORT_READ);
        boolean canReadInvoice = RolePermissions.has(role, com.clinic.security.Permissions.INVOICE_READ)
                || isPatient;
        // The doctor directory is intentionally reachable by patients: booking an
        // appointment requires choosing a provider, and the directory exposes only
        // name and specialisation. The wider user directory below stays closed to them.
        boolean canFindDoctors = RolePermissions.has(role, com.clinic.security.Permissions.DIAGNOSIS_WRITE)
                || RolePermissions.has(role, com.clinic.security.Permissions.PATIENT_DEMOGRAPHICS_READ)
                || RolePermissions.has(role, com.clinic.security.Permissions.APPOINTMENT_MANAGE);

        List<GlobalSearchResponse.Hit> users = new ArrayList<>();
        List<GlobalSearchResponse.Hit> patients = new ArrayList<>();
        List<GlobalSearchResponse.Hit> doctors = new ArrayList<>();
        List<GlobalSearchResponse.Hit> appointments = new ArrayList<>();
        List<GlobalSearchResponse.Hit> invoices = new ArrayList<>();
        List<GlobalSearchResponse.Hit> departments = new ArrayList<>();

        // A patient's own record is always searchable; the directory is not.
        if (isPatient) {
            patientRepository.findById(currentUser.userId()).ifPresent(patient -> {
                if (matches(lower, patient.getFullName(), patient.getEmail(), patient.getRegistrationNumber())) {
                    patients.add(patientHit(patient));
                }
            });
            appointmentRepository
                    .findByPatientIdAndAppointmentDateAfterOrderByAppointmentDateAsc(
                            currentUser.userId(), java.time.LocalDateTime.now().minusYears(5),
                            PageRequest.of(0, size))
                    .stream()
                    .filter(appointment -> matches(lower, appointment.getStatus() != null ? appointment.getStatus().name() : null))
                    .forEach(appointment -> appointments.add(appointmentHit(appointment)));
        }

        if (canReadReport) {
            userRepository.findAll(PageRequest.of(0, 200)).stream()
                    .filter(User::getActive)
                    .filter(user -> matches(lower, user.getFullName(), user.getEmail()))
                    .limit(size)
                    .forEach(user -> users.add(new GlobalSearchResponse.Hit(
                            user.getId(), "USER", user.getFullName(),
                            user.getEmail() + " · " + user.getRole().name(), "/admin/users")));

            patientRepository.findAll(PageRequest.of(0, 200)).stream()
                    .filter(patient -> matches(lower, patient.getFullName(), patient.getEmail(), patient.getRegistrationNumber()))
                    .limit(size)
                    .forEach(patient -> patients.add(patientHit(patient)));
        }

        if (canFindDoctors) {
            doctorRepository.findAllByRoleIn(List.of(UserRole.DOCTOR)).stream()
                    .filter(doctor -> matches(lower, doctor.getFullName(), doctor.getEmail(), doctor.getLicenseNumber()))
                    .limit(size)
                    .forEach(doctor -> doctors.add(new GlobalSearchResponse.Hit(
                            doctor.getId(), "DOCTOR", doctor.getFullName(),
                            doctor.getSpecialization() != null ? doctor.getSpecialization() : "Doctor",
                            "/admin/doctors")));
        }

        if (canReadReport) {
            departmentRepository.findAllByActiveTrueOrderByNameAsc().stream()
                    .filter(department -> matches(lower, department.getName(), department.getCode(), department.getDescription()))
                    .limit(size)
                    .forEach(department -> departments.add(new GlobalSearchResponse.Hit(
                            department.getId(), "DEPARTMENT", department.getName(),
                            department.getCode(), "/hospital/departments")));
        }

        if (canReadInvoice) {
            PageRequest page = PageRequest.of(0, size);
            var page1 = isPatient
                    ? invoiceRepository.findByPatientId(currentUser.userId(), page)
                    : invoiceRepository.findAll(page);
            page1.stream()
                    .filter(invoice -> matches(lower, invoice.getInvoiceNumber(), invoice.getPatient() != null ? invoice.getPatient().getFullName() : null))
                    .forEach(invoice -> invoices.add(new GlobalSearchResponse.Hit(
                            invoice.getId(), "INVOICE", invoice.getInvoiceNumber(),
                            (invoice.getPatient() != null ? invoice.getPatient().getFullName() : "Patient")
                                    + " · " + invoice.getStatus().name()
                                    + " · " + invoice.getBalanceDue(),
                            "/cashier/invoices")));
        }

        hits.addAll(users);
        hits.addAll(patients);
        hits.addAll(doctors);
        hits.addAll(appointments);
        hits.addAll(invoices);
        hits.addAll(departments);

        return new GlobalSearchResponse(needle, hits.size(), users, patients, doctors,
                appointments, invoices, departments);
    }

    private GlobalSearchResponse.Hit patientHit(Patient patient) {
        return new GlobalSearchResponse.Hit(
                patient.getId(), "PATIENT", patient.getFullName(),
                patient.getRegistrationNumber() != null
                        ? patient.getRegistrationNumber()
                        : patient.getEmail(),
                "/admin/patients/" + patient.getId());
    }

    private GlobalSearchResponse.Hit appointmentHit(Appointment appointment) {
        String patient = appointment.getPatient() != null ? appointment.getPatient().getFullName() : "Patient";
        return new GlobalSearchResponse.Hit(
                appointment.getId(), "APPOINTMENT", patient,
                appointment.getStatus() != null ? appointment.getStatus().name() : "",
                "/admin/appointments");
    }

    /** Case-insensitive "contains" against any of the supplied candidates. */
    private boolean matches(String needle, String... candidates) {
        for (String candidate : candidates) {
            if (candidate != null && candidate.toLowerCase(Locale.ROOT).contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private GlobalSearchResponse empty(String query) {
        return new GlobalSearchResponse(query, 0, List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of());
    }
}