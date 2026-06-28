package com.clinic.service.impl;

import com.clinic.dto.request.DoctorCreateRequest;
import com.clinic.dto.request.DoctorUpdateRequest;
import com.clinic.dto.response.DoctorResponse;
import com.clinic.entity.Doctor;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.DoctorMapper;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.UserRepository;
import com.clinic.service.DoctorService;
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
public class DoctorServiceImpl implements DoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final DoctorMapper doctorMapper;
    private final PasswordEncoder passwordEncoder;

    public DoctorServiceImpl(
            DoctorRepository doctorRepository,
            UserRepository userRepository,
            DoctorMapper doctorMapper,
            PasswordEncoder passwordEncoder
    ) {
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
        this.doctorMapper = doctorMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public DoctorResponse create(DoctorCreateRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }
        if (doctorRepository.findByLicenseNumber(request.licenseNumber()).isPresent()) {
            throw new BadRequestException("A doctor with this license number already exists");
        }
        Doctor doctor = doctorMapper.toEntity(request, passwordEncoder.encode(request.password()));
        Doctor saved = doctorRepository.save(doctor);
        log.info("Created doctor id={}", saved.getId());
        return doctorMapper.toResponse(saved);
    }

    @Override
    public DoctorResponse update(String id, DoctorUpdateRequest request) {
        Doctor doctor = getEntityById(id);
        doctorMapper.updateEntity(doctor, request);
        return doctorMapper.toResponse(doctorRepository.save(doctor));
    }

    @Override
    @Transactional(readOnly = true)
    public DoctorResponse getById(String id) {
        return doctorMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DoctorResponse> getAll(Pageable pageable) {
        return doctorRepository.findAll(pageable).map(doctorMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DoctorResponse> search(String fullName, String email, String specialization, Boolean active, Boolean available, Pageable pageable) {
        Specification<Doctor> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();
            if (fullName != null && !fullName.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("fullName")), "%" + fullName.toLowerCase() + "%"));
            }
            if (email != null && !email.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("email")), "%" + email.toLowerCase() + "%"));
            }
            if (specialization != null && !specialization.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("specialization")), "%" + specialization.toLowerCase() + "%"));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (available != null) {
                predicates.add(cb.equal(root.get("available"), available));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return doctorRepository.findAll(specification, pageable).map(doctorMapper::toResponse);
    }

    @Override
    public void delete(String id) {
        doctorRepository.delete(getEntityById(id));
    }

    private Doctor getEntityById(String id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + id));
    }
}
