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

    /**
     * Copies profile fields onto an entity.
     *
     * <p>Deliberately does not touch {@code active}. Account status is a
     * consequential, audited action that requires a recorded reason, so it goes
     * through the dedicated status endpoint. Letting a routine profile save flip it
     * would bypass both the audit trail and the self-protection rules.
     */
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
    }
}
