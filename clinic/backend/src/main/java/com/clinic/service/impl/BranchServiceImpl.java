package com.clinic.service.impl;

import com.clinic.dto.request.BranchRequest;
import com.clinic.dto.response.BranchResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.Branch;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.BranchMapper;
import com.clinic.repository.BranchRepository;
import com.clinic.service.BranchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@Slf4j
public class BranchServiceImpl implements BranchService {

    private final BranchRepository branchRepository;
    private final BranchMapper branchMapper;

    public BranchServiceImpl(BranchRepository branchRepository, BranchMapper branchMapper) {
        this.branchRepository = branchRepository;
        this.branchMapper = branchMapper;
    }

    @Override
    public BranchResponse create(BranchRequest request) {
        if (branchRepository.existsByCode(request.code())) {
            throw new BadRequestException("Branch with code " + request.code() + " already exists");
        }
        Branch branch = branchMapper.toEntity(request);
        Branch saved = branchRepository.save(branch);
        log.info("Created branch id={}, code={}", saved.getId(), saved.getCode());
        return branchMapper.toResponse(saved);
    }

    @Override
    public BranchResponse update(String id, BranchRequest request) {
        Branch branch = getEntityById(id);
        if (!branch.getCode().equalsIgnoreCase(request.code()) && branchRepository.existsByCode(request.code())) {
            throw new BadRequestException("Branch with code " + request.code() + " already exists");
        }
        branchMapper.updateEntity(branch, request);
        Branch saved = branchRepository.save(branch);
        log.info("Updated branch id={}, code={}", saved.getId(), saved.getCode());
        return branchMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public BranchResponse getById(String id) {
        return branchMapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<BranchResponse> getAll(Pageable pageable) {
        Page<Branch> page = branchRepository.findAll(pageable);
        return PageResponse.of(page.map(branchMapper::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<BranchResponse> search(String q, Pageable pageable) {
        if (q == null || q.isBlank()) {
            return getAll(pageable);
        }
        Page<Branch> page = branchRepository.search(q.trim(), pageable);
        return PageResponse.of(page.map(branchMapper::toResponse));
    }

    @Override
    public void delete(String id) {
        Branch branch = getEntityById(id);
        branchRepository.delete(branch);
        log.info("Deleted branch id={}", id);
    }

    private Branch getEntityById(String id) {
        return branchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with id: " + id));
    }
}
