package com.clinic.service.impl;

import com.clinic.dto.request.PatientCreateRequest;
import com.clinic.dto.request.PatientUpdateRequest;
import com.clinic.dto.response.PatientResponse;
import com.clinic.entity.Patient;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.PatientMapper;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.UserRepository;
import com.clinic.service.PatientService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;

@Service
@Transactional
@Slf4j
public class PatientServiceImpl implements PatientService {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final PatientMapper patientMapper;
    private final PasswordEncoder passwordEncoder;

    public PatientServiceImpl(
            PatientRepository patientRepository,
            UserRepository userRepository,
            PatientMapper patientMapper,
            PasswordEncoder passwordEncoder
    ) {
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.patientMapper = patientMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public PatientResponse create(PatientCreateRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }
        Patient patient = patientMapper.toEntity(request, passwordEncoder.encode(request.password()));
        Patient saved = patientRepository.save(patient);
        log.info("Created patient id={}", saved.getId());
        return patientMapper.toResponse(saved);
    }

    @Override
    public PatientResponse update(String id, PatientUpdateRequest request) {
        Patient patient = getEntityById(id);
        patientMapper.updateEntity(patient, request);
        return patientMapper.toResponse(patientRepository.save(patient));
    }

    @Override
    @Transactional(readOnly = true)
    public PatientResponse getById(String id) {
        return patientMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientResponse> getAll(Pageable pageable) {
        return patientRepository.findAll(pageable).map(patientMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PatientResponse> search(String fullName, String email, String phone, Boolean active, Pageable pageable) {
        Specification<Patient> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();
            if (fullName != null && !fullName.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("fullName")), "%" + fullName.toLowerCase() + "%"));
            }
            if (email != null && !email.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("email")), "%" + email.toLowerCase() + "%"));
            }
            if (phone != null && !phone.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("phone")), "%" + phone.toLowerCase() + "%"));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return patientRepository.findAll(specification, pageable).map(patientMapper::toResponse);
    }

    @Override
    public void delete(String id) {
        patientRepository.delete(getEntityById(id));
    }

    private Patient getEntityById(String id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + id));
    }
}
