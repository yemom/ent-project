package com.clinic.service;

import com.clinic.dto.request.ChangeRoleRequest;
import com.clinic.dto.request.ChangeStatusRequest;
import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.request.UpdateUserRequest;
import com.clinic.dto.response.CreateUserResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.RoleChangeRequestResponse;
import com.clinic.dto.response.UserResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.RoleChangeRequest;
import com.clinic.entity.UserRole;
import org.springframework.data.domain.Pageable;

import java.util.Set;

public interface AdminService {

    PageResponse<UserSummaryResponse> listUsers(Pageable pageable);

    /**
     * Provisions an account. The caller cannot assign a privileged role to
     * themselves, and privileged roles are always created as PENDING requests.
     */
    UserSummaryResponse createUser(CreateUserRequest request);

    UserSummaryResponse updateUser(String id, UpdateUserRequest request);

    void deleteUser(String id);

    // ------------------------------------------------------------------
    // Full account lifecycle.
    //
    // These back the Super Admin screens. They are separate from the three
    // methods above rather than replacing them, because the older trio is
    // already called from other flows and returns a lighter projection.
    // ------------------------------------------------------------------

    /**
     * Filtered, paginated directory used by the admin table and the per-role pages.
     *
     * <p>Every filter is optional and combined server-side, so the returned page
     * genuinely matches the request instead of being filtered after pagination.
     */
    PageResponse<UserResponse> searchUsers(UserRole role, Boolean active, String branchId,
                                           String search, Pageable pageable);

    PageResponse<UserResponse> searchUsers(UserRole role, Boolean active, String branchId,
                                           String department, String search, Pageable pageable);

    /** One account with its role-specific profile. Never includes a password hash. */
    UserResponse getUser(String id);

    /**
     * Creates an account for any role, with that role's profile fields.
     *
     * <p>When no password is supplied one is generated and returned exactly once in
     * {@link CreateUserResponse#generatedPassword()}; either way the account is
     * flagged {@code mustChangePassword} so a temporary credential cannot become a
     * permanent one.
     */
    CreateUserResponse createAccount(CreateUserRequest request);

    /** Updates profile fields. Never changes the role — that has its own endpoint. */
    UserResponse updateProfile(String id, UpdateUserRequest request);

    /**
     * Changes an account's role.
     *
     * <p>Refuses to demote oneself and refuses to demote the last active Super
     * Admin, either of which would leave the deployment without an administrator.
     */
    UserResponse changeRole(String id, ChangeRoleRequest request);

    /**
     * Activates or deactivates an account. Deactivation requires a reason and is
     * refused for one's own account.
     */
    UserResponse changeStatus(String id, ChangeStatusRequest request);

    /** Soft delete. Refused for oneself and for the last active Super Admin. */
    void softDeleteAccount(String id);

    /** Requests a role change; nothing is applied until a second admin approves. */
    RoleChangeRequestResponse requestRoleChange(String targetUserId, UserRole requestedRole, String reason);

    RoleChangeRequestResponse approveRoleChange(String requestId, String decisionReason);

    RoleChangeRequestResponse rejectRoleChange(String requestId, String decisionReason);

    PageResponse<RoleChangeRequestResponse> listRoleChangeRequests(RoleChangeRequest.Status status, Pageable pageable);

    Set<String> permissionsFor(UserRole role);
}