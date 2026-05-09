package com.clinic.service.impl;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.AppointmentMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.service.AppointmentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.UUID;

@Service
@Transactional
@Slf4j
public class AppointmentServiceImpl implements AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentMapper appointmentMapper;

    public AppointmentServiceImpl(
            AppointmentRepository appointmentRepository,
            PatientRepository patientRepository,
            DoctorRepository doctorRepository,
            AppointmentMapper appointmentMapper
    ) {
        this.appointmentRepository = appointmentRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentMapper = appointmentMapper;
    }

    @Override
    public AppointmentResponse create(AppointmentCreateRequest request) {
        Patient patient = getPatient(request.patientId());
        Doctor doctor = getDoctor(request.doctorId());
        Appointment appointment = appointmentMapper.toEntity(request, patient, doctor);
        Appointment saved = appointmentRepository.save(appointment);
        log.info("Created appointment id={}", saved.getId());
        return appointmentMapper.toResponse(saved);
    }

    @Override
    public AppointmentResponse update(UUID id, AppointmentUpdateRequest request) {
        Appointment appointment = getEntityById(id);
        Patient patient = request.patientId() != null ? getPatient(request.patientId()) : null;
        Doctor doctor = request.doctorId() != null ? getDoctor(request.doctorId()) : null;
        appointmentMapper.updateEntity(appointment, request, patient, doctor);
        return appointmentMapper.toResponse(appointmentRepository.save(appointment));
    }

    @Override
    @Transactional(readOnly = true)
    public AppointmentResponse getById(UUID id) {
        return appointmentMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentResponse> getAll(Pageable pageable) {
        return appointmentRepository.findAll(pageable).map(appointmentMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AppointmentResponse> search(AppointmentSearchRequest request, Pageable pageable) {
        Specification<Appointment> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();
            if (request.patientId() != null) {
                predicates.add(cb.equal(root.get("patient").get("id"), request.patientId()));
            }
            if (request.doctorId() != null) {
                predicates.add(cb.equal(root.get("doctor").get("id"), request.doctorId()));
            }
            if (request.status() != null) {
                predicates.add(cb.equal(root.get("status"), request.status()));
            }
            if (request.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("appointmentDate"), request.from()));
            }
            if (request.to() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("appointmentDate"), request.to()));
            }
            if (request.keyword() != null && !request.keyword().isBlank()) {
                String keyword = "%" + request.keyword().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("reasonForVisit")), keyword),
                        cb.like(cb.lower(root.get("notes")), keyword)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return appointmentRepository.findAll(specification, pageable).map(appointmentMapper::toResponse);
    }

    @Override
    public AppointmentResponse cancel(UUID id, String cancellationReason) {
        Appointment appointment = getEntityById(id);
        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(cancellationReason);
        appointment.setCancellationDate(LocalDateTime.now());
        appointment.setCancelledBy("SYSTEM");
        return appointmentMapper.toResponse(appointmentRepository.save(appointment));
    }

    @Override
    public void delete(UUID id) {
        appointmentRepository.delete(getEntityById(id));
    }

    private Appointment getEntityById(UUID id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found: " + id));
    }

    private Patient getPatient(UUID id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + id));
    }

    private Doctor getDoctor(UUID id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + id));
    }
}
