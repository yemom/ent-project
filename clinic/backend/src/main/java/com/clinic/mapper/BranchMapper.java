package com.clinic.mapper;

import com.clinic.dto.request.BranchRequest;
import com.clinic.dto.response.BranchResponse;
import com.clinic.entity.Branch;
import org.springframework.stereotype.Component;

@Component
public class BranchMapper {

    public Branch toEntity(BranchRequest request) {
        if (request == null) {
            return null;
        }
        return Branch.builder()
                .name(request.name())
                .code(request.code())
                .address(request.address())
                .phone(request.phone())
                .email(request.email())
                .type(request.type())
                .active(request.active() != null ? request.active() : true)
                .notes(request.notes())
                .build();
    }

    public BranchResponse toResponse(Branch branch) {
        if (branch == null) {
            return null;
        }
        return new BranchResponse(
                branch.getId(),
                branch.getName(),
                branch.getCode(),
                branch.getAddress(),
                branch.getPhone(),
                branch.getEmail(),
                branch.getType(),
                branch.getActive(),
                branch.getNotes(),
                branch.getCreatedAt(),
                branch.getUpdatedAt()
        );
    }

    public void updateEntity(Branch branch, BranchRequest request) {
        if (branch == null || request == null) {
            return;
        }
        if (request.name() != null) {
            branch.setName(request.name());
        }
        if (request.code() != null) {
            branch.setCode(request.code());
        }
        if (request.address() != null) {
            branch.setAddress(request.address());
        }
        if (request.phone() != null) {
            branch.setPhone(request.phone());
        }
        if (request.email() != null) {
            branch.setEmail(request.email());
        }
        if (request.type() != null) {
            branch.setType(request.type());
        }
        if (request.active() != null) {
            branch.setActive(request.active());
        }
        if (request.notes() != null) {
            branch.setNotes(request.notes());
        }
    }
}
