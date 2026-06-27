package com.clinic.mapper;

import com.clinic.dto.request.UpdateUserRequest;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserSummaryResponse toSummaryResponse(User user) {
        if (user == null) {
            return null;
        }
        return new UserSummaryResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.getActive()
        );
    }

    public void updateEntity(User user, UpdateUserRequest request) {
        if (user == null || request == null) {
            return;
        }
        if (request.fullName() != null) {
            user.setFullName(request.fullName());
        }
        if (request.email() != null) {
            user.setEmail(request.email());
        }
        if (request.phone() != null) {
            user.setPhone(request.phone());
        }
        if (request.active() != null) {
            user.setActive(request.active());
        }
    }
}
