package com.clinic.service.impl;

import com.clinic.dto.request.DoctorAvailabilityCreateRequest;
import com.clinic.dto.response.DoctorAvailabilityResponse;
import com.clinic.entity.DoctorAvailability;
import com.clinic.entity.Doctor;
import com.clinic.entity.Laboratory;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.DoctorAvailabilityMapper;
import com.clinic.repository.DoctorAvailabilityRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.LaboratoryRepository;
import com.clinic.service.DoctorAvailabilityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.clinic.config.CacheNames.DOCTOR_AVAILABILITY;

@Service
@Transactional
@Slf4j
public class DoctorAvailabilityServiceImpl implements DoctorAvailabilityService {

    private final DoctorAvailabilityRepository availabilityRepository;
    private final DoctorRepository doctorRepository;
    private final LaboratoryRepository laboratoryRepository;
    private final DoctorAvailabilityMapper availabilityMapper;

    public DoctorAvailabilityServiceImpl(
            DoctorAvailabilityRepository availabilityRepository,
            DoctorRepository doctorRepository,
            LaboratoryRepository laboratoryRepository,
            DoctorAvailabilityMapper availabilityMapper
    ) {
        this.availabilityRepository = availabilityRepository;
        this.doctorRepository = doctorRepository;
        this.laboratoryRepository = laboratoryRepository;
        this.availabilityMapper = availabilityMapper;
    }

    @Override
    @CacheEvict(cacheNames = DOCTOR_AVAILABILITY, allEntries = true)
    public DoctorAvailabilityResponse create(DoctorAvailabilityCreateRequest request) {
        Doctor doctor = doctorRepository.findById(request.doctorId())
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found with id: " + request.doctorId()));
        
        Laboratory laboratory = laboratoryRepository.findById(request.laboratoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Laboratory not found with id: " + request.laboratoryId()));

        DoctorAvailability availability = availabilityMapper.toEntity(request, doctor, laboratory);
        DoctorAvailability saved = availabilityRepository.save(availability);
        log.info("Created doctor availability id={}", saved.getId());
        return availabilityMapper.toResponse(saved);
    }

    @Override
    @CacheEvict(cacheNames = DOCTOR_AVAILABILITY, allEntries = true)
    public DoctorAvailabilityResponse update(String id, DoctorAvailabilityCreateRequest request) {
        DoctorAvailability availability = getEntityById(id);
        availabilityMapper.updateEntity(availability, request);
        return availabilityMapper.toResponse(availabilityRepository.save(availability));
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = DOCTOR_AVAILABILITY, key = "'id:' + #id")
    public DoctorAvailabilityResponse getById(String id) {
        return availabilityMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DoctorAvailabilityResponse> getAll(Pageable pageable) {
        return availabilityRepository.findAll(pageable).map(availabilityMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DoctorAvailabilityResponse> getByDoctorId(String doctorId, Pageable pageable) {
        return availabilityRepository.findByDoctorId(doctorId, pageable).map(availabilityMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DoctorAvailabilityResponse> getByLaboratoryId(String laboratoryId, Pageable pageable) {
        return availabilityRepository.findByLaboratoryId(laboratoryId, pageable).map(availabilityMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DoctorAvailabilityResponse> getByDayOfWeek(String dayOfWeek, Pageable pageable) {
        return availabilityRepository.findByDayOfWeek(dayOfWeek, pageable).map(availabilityMapper::toResponse);
    }

    @Override
    @CacheEvict(cacheNames = DOCTOR_AVAILABILITY, allEntries = true)
    public void delete(String id) {
        DoctorAvailability availability = getEntityById(id);
        availabilityRepository.delete(availability);
        log.info("Deleted doctor availability id={}", id);
    }

    private DoctorAvailability getEntityById(String id) {
        return availabilityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor availability not found with id: " + id));
    }
}
