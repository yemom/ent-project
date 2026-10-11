package com.clinic.service;

import com.clinic.dto.request.BranchRequest;
import com.clinic.dto.response.BranchResponse;
import com.clinic.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

public interface BranchService {

    BranchResponse create(BranchRequest request);

    BranchResponse update(String id, BranchRequest request);

    BranchResponse getById(String id);

    PageResponse<BranchResponse> getAll(Pageable pageable);

    PageResponse<BranchResponse> search(String q, Pageable pageable);

    void delete(String id);
}
