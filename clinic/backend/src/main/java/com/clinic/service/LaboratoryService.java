package com.clinic.service;

import com.clinic.dto.request.LaboratoryCreateRequest;
import com.clinic.dto.response.LaboratoryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LaboratoryService {

    LaboratoryResponse create(LaboratoryCreateRequest request);

    LaboratoryResponse update(String id, LaboratoryCreateRequest request);

    LaboratoryResponse getById(String id);

    Page<LaboratoryResponse> getAll(Pageable pageable);

    Page<LaboratoryResponse> search(String name, String status, Pageable pageable);

    void delete(String id);
}
