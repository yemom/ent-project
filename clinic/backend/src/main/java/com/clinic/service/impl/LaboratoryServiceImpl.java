package com.clinic.service.impl;

import com.clinic.dto.request.LaboratoryCreateRequest;
import com.clinic.dto.response.LaboratoryResponse;
import com.clinic.entity.Laboratory;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.LaboratoryMapper;
import com.clinic.repository.LaboratoryRepository;
import com.clinic.service.LaboratoryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;

@Service
@Transactional
@Slf4j
public class LaboratoryServiceImpl implements LaboratoryService {

    private final LaboratoryRepository laboratoryRepository;
    private final LaboratoryMapper laboratoryMapper;

    public LaboratoryServiceImpl(
            LaboratoryRepository laboratoryRepository,
            LaboratoryMapper laboratoryMapper
    ) {
        this.laboratoryRepository = laboratoryRepository;
        this.laboratoryMapper = laboratoryMapper;
    }

    @Override
    public LaboratoryResponse create(LaboratoryCreateRequest request) {
        if (laboratoryRepository.existsByName(request.name())) {
            throw new BadRequestException("Laboratory with name " + request.name() + " already exists");
        }
        Laboratory laboratory = laboratoryMapper.toEntity(request);
        Laboratory saved = laboratoryRepository.save(laboratory);
        log.info("Created laboratory id={}", saved.getId());
        return laboratoryMapper.toResponse(saved);
    }

    @Override
    public LaboratoryResponse update(String id, LaboratoryCreateRequest request) {
        Laboratory laboratory = getEntityById(id);
        laboratoryMapper.updateEntity(laboratory, request);
        return laboratoryMapper.toResponse(laboratoryRepository.save(laboratory));
    }

    @Override
    @Transactional(readOnly = true)
    public LaboratoryResponse getById(String id) {
        return laboratoryMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LaboratoryResponse> getAll(Pageable pageable) {
        return laboratoryRepository.findAll(pageable).map(laboratoryMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LaboratoryResponse> search(String name, String status, Pageable pageable) {
        Specification<Laboratory> specification = (root, query, cb) -> {
            ArrayList<Predicate> predicates = new ArrayList<>();

            if (name != null && !name.isEmpty()) {
                predicates.add(cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%"));
            }

            if (status != null && !status.isEmpty()) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return laboratoryRepository.findAll(specification, pageable).map(laboratoryMapper::toResponse);
    }

    @Override
    public void delete(String id) {
        Laboratory laboratory = getEntityById(id);
        laboratoryRepository.delete(laboratory);
        log.info("Deleted laboratory id={}", id);
    }

    private Laboratory getEntityById(String id) {
        return laboratoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Laboratory not found with id: " + id));
    }
}
