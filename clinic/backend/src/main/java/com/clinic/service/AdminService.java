package com.clinic.service;

import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.response.UserSummaryResponse;

public interface AdminService {
    UserSummaryResponse createUser(CreateUserRequest request);
}
