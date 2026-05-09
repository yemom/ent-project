package com.clinic.service.impl;

import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.Doctor;
import com.clinic.entity.MedicalRecord;
import com.clinic.entity.Patient;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.MedicalRecordMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.MedicalRecordRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.service.MedicalRecordService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.UUID;

@Service
@Transactional
@Slf4j
public class MedicalRecordServiceImpl implements MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordMapper medicalRecordMapper;

    public MedicalRecordServiceImpl(
            MedicalRecordRepository medicalRecordRepository,
            PatientRepository patientRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            MedicalRecordMapper medicalRecordMapper
    ) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.medicalRecordMapper = medicalRecordMapper;
    }

    @Override
    public MedicalRecordResponse create(MedicalRecordCreateRequest request) {
        Patient patient = getPatient(request.patientId());
        Doctor doctor = request.doctorId() != null ? getDoctor(request.doctorId()) : null;
        Appointment appointment = request.appointmentId() != null ? getAppointment(request.appointmentId()) : null;
        MedicalRecord record = medicalRecordMapper.toEntity(request, patient, doctor, appointment);
        MedicalRecord saved = medicalRecordRepository.save(record);
        log.info("Created medical record id={}", saved.getId());
        return medicalRecordMapper.toResponse(saved);
    }

    @Override
    public MedicalRecordResponse update(UUID id, MedicalRecordUpdateRequest request) {
        MedicalRecord record = getEntityById(id);
        Patient patient = request.patientId() != null ? getPatient(request.patientId()) : null;
        Doctor doctor = request.doctorId() != null ? getDoctor(request.doctorId()) : null;
        Appointment appointment = request.appointmentId() != null ? getAppointment(request.appointmentId()) : null;
        medicalRecordMapper.updateEntity(record, request, patient, doctor, appointment);
        return medicalRecordMapper.toResponse(medicalRecordRepository.save(record));
    }

    @Override
    @Transactional(readOnly = true)
    public MedicalRecordResponse getById(UUID id) {
        return medicalRecordMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MedicalRecordResponse> getAll(Pageable pageable) {
        return medicalRecordRepository.findAll(pageable).map(medicalRecordMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MedicalRecordResponse> search(MedicalRecordSearchRequest request, Pageable pageable) {
        Specification<MedicalRecord> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();
            if (request.patientId() != null) {
                predicates.add(cb.equal(root.get("patient").get("id"), request.patientId()));
            }
            if (request.doctorId() != null) {
                predicates.add(cb.equal(root.get("doctor").get("id"), request.doctorId()));
            }
            if (request.appointmentId() != null) {
                predicates.add(cb.equal(root.get("appointment").get("id"), request.appointmentId()));
            }
            if (request.fromDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("recordDate"), request.fromDate()));
            }
            if (request.toDate() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("recordDate"), request.toDate()));
            }
            if (request.confidential() != null) {
                predicates.add(cb.equal(root.get("isConfidential"), request.confidential()));
            }
            if (request.keyword() != null && !request.keyword().isBlank()) {
                String keyword = "%" + request.keyword().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("diagnosis")), keyword),
                        cb.like(cb.lower(root.get("treatment")), keyword),
                        cb.like(cb.lower(root.get("prescription")), keyword),
                        cb.like(cb.lower(root.get("notes")), keyword)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return medicalRecordRepository.findAll(specification, pageable).map(medicalRecordMapper::toResponse);
    }

    @Override
    public void delete(UUID id) {
        medicalRecordRepository.delete(getEntityById(id));
    }

    private MedicalRecord getEntityById(UUID id) {
        return medicalRecordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medical record not found: " + id));
    }

    private Patient getPatient(UUID id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + id));
    }

    private Doctor getDoctor(UUID id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + id));
    }

    private Appointment getAppointment(UUID id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found: " + id));
    }
}
