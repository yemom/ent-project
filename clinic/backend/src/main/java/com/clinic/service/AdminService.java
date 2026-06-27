package com.clinic.service;

import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.request.UpdateUserRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.UserSummaryResponse;
import org.springframework.data.domain.Pageable;

public interface AdminService {
    PageResponse<UserSummaryResponse> listUsers(Pageable pageable);

    UserSummaryResponse createUser(CreateUserRequest request);

    UserSummaryResponse updateUser(String id, UpdateUserRequest request);

    void deleteUser(String id);
}
