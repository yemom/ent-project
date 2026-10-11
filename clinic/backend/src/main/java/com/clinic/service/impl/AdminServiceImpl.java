package com.clinic.service.impl;

import com.clinic.dto.request.ChangeRoleRequest;
import com.clinic.dto.request.ChangeStatusRequest;
import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.request.UpdateUserRequest;
import com.clinic.dto.response.CreateUserResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.RoleChangeRequestResponse;
import com.clinic.dto.response.UserResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.*;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ConflictException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.RoleChangeRequestRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CurrentUser;
import com.clinic.security.RolePermissions;
import com.clinic.security.UserRoles;
import com.clinic.service.AdminService;
import com.clinic.service.AuditLogService;
import com.clinic.validation.PasswordPolicy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
@Slf4j
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final RoleChangeRequestRepository roleChangeRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final CurrentUser currentUser;
    private final AuditLogService auditLogService;

    public AdminServiceImpl(
            UserRepository userRepository,
            RoleChangeRequestRepository roleChangeRequestRepository,
            PasswordEncoder passwordEncoder,
            UserMapper userMapper,
            CurrentUser currentUser,
            AuditLogService auditLogService
    ) {
        this.userRepository = userRepository;
        this.roleChangeRequestRepository = roleChangeRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
        this.currentUser = currentUser;
        this.auditLogService = auditLogService;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserSummaryResponse> listUsers(Pageable pageable) {
        return PageResponse.of(userRepository.findAll(pageable).map(userMapper::toSummaryResponse));
    }

    @Override
    public UserSummaryResponse createUser(CreateUserRequest request) {
        log.debug("Creating user with email={} role={}", request.email(), request.role());

        if (userRepository.existsByEmail(request.email())) {
            throw new BadRequestException("Email already exists");
        }

        // Privilege-escalation guard.
        //
        // A privileged role may only be handed out by an existing SUPER_ADMIN.
        // Banning it outright was wrong: it made HOSPITAL_ADMIN impossible to
        // provision, so the role could only ever be reached by editing the database
        // by hand. Everyone else is still refused, which is what actually prevents
        // self-escalation — this endpoint already requires `user:manage`, which only
        // SUPER_ADMIN holds.
        if (UserRoles.isPrivileged(request.role()) && !currentUser.is(UserRole.SUPER_ADMIN)) {
            throw new BadRequestException(
                    "Only a Super Admin can create an account with a privileged role "
                            + "(SUPER_ADMIN or HOSPITAL_ADMIN)");
        }

        if (UserRoles.isPrivileged(request.role())) {
            // Distinct audit action: provisioning another admin is the highest-value
            // action in the system and should be greppable in the trail.
            auditLogService.record(AuditAction.ROLE_CHANGED, "USER", request.email(),
                    "Created account " + request.email() + " with privileged role "
                            + request.role());
        }

        User savedUser = userRepository.save(buildUser(request));
        log.info("Created user id={} role={}", savedUser.getId(), savedUser.getRole());
        auditLogService.record(AuditAction.USER_CREATED, "USER", savedUser.getId(),
                "Created account with role " + savedUser.getRole());
        return userMapper.toSummaryResponse(savedUser);
    }

    @Override
    public UserSummaryResponse updateUser(String id, UpdateUserRequest request) {
        User user = getEntityById(id);

        if (request.email() != null && userRepository.existsByEmailAndIdNot(request.email(), id)) {
            throw new BadRequestException("Email already exists");
        }

        userMapper.updateEntity(user, request);
        User savedUser = userRepository.save(user);
        log.info("Updated user id={}", savedUser.getId());
        auditLogService.record(AuditAction.USER_UPDATED, "USER", savedUser.getId(), "Updated account");
        return userMapper.toSummaryResponse(savedUser);
    }

    /**
     * Legacy entry point kept because {@code DELETE /admin/users/{id}} is already
     * wired to it. Delegates to the lifecycle implementation so there is exactly one
     * delete path in the system — and so this endpoint cannot become a hard delete.
     */
    @Override
    public void deleteUser(String id) {
        softDeleteAccount(id);
    }

    // ==================================================================
    // Full account lifecycle
    // ==================================================================

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> searchUsers(UserRole role, Boolean active, String branchId,
                                                  String search, Pageable pageable) {
        return searchUsers(role, active, branchId, null, search, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> searchUsers(UserRole role, Boolean active, String branchId,
                                                  String department, String search, Pageable pageable) {
        String needle = search == null || search.isBlank()
                ? null
                : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";

        Page<User> page = userRepository.search(
                role,
                active,
                branchId == null || branchId.isBlank() ? null : branchId,
                department == null || department.isBlank() ? null : department.trim().toLowerCase(Locale.ROOT),
                needle,
                pageable);

        return PageResponse.of(page.map(UserResponse::listView));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUser(String id) {
        return UserResponse.detail(getEntityById(id));
    }

    @Override
    public CreateUserResponse createAccount(CreateUserRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        // 409 rather than 400: the request was well-formed, it conflicts with
        // existing state, and the UI maps it to the email field.
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("An account already exists for " + email);
        }

        // ADMIN and LABORATORY are legacy aliases. Storing the alias instead of the
        // real value would create a second, invisibly different role that no
        // permission query matches.
        UserRole role = request.role().canonical();

        validateRoleFields(role, request.specialization(), request.licenseNumber(),
                request.dateOfBirth(), request.employeeNumber());

        // A generated password is the default so no default credential exists in
        // source; a supplied one still has to satisfy the policy.
        boolean generated = request.password() == null || request.password().isBlank();
        String rawPassword = generated ? generatePassword() : request.password();

        if (!PasswordPolicy.isValid(rawPassword)) {
            throw new BadRequestException("Password does not meet the policy: " + PasswordPolicy.MESSAGE);
        }

        User user = buildUserForRole(role);
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setPhone(trimToNull(request.phone()));
        user.setBranchId(trimToNull(request.branchId()));
        user.setDepartment(trimToNull(request.department()));
        user.setWard(trimToNull(request.ward()));
        user.setRole(role);
        user.setPassword(passwordEncoder.encode(rawPassword));
        // Both supplied and generated credentials are temporary: an administrator
        // handing out an account should not hand out a permanent credential.
        user.setMustChangePassword(true);

        applyRoleProfile(user, request);

        User saved = userRepository.save(user);
        log.info("Created account id={} role={}", saved.getId(), saved.getRole());

        auditLogService.record(AuditAction.USER_CREATED, "USER", saved.getId(),
                "Created " + saved.getRole() + " account for " + saved.getEmail()
                        + " (temporary password " + (generated ? "generated" : "supplied") + ")");

        UserResponse response = UserResponse.detail(saved);
        return generated
                ? CreateUserResponse.withGeneratedPassword(response, rawPassword)
                : CreateUserResponse.of(response);
    }

    @Override
    public UserResponse updateProfile(String id, UpdateUserRequest request) {
        User user = getEntityById(id);

        if (request.email() != null && !request.email().isBlank()) {
            String email = request.email().trim().toLowerCase(Locale.ROOT);
            if (!email.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(email)) {
                throw new ConflictException("An account already exists for " + email);
            }
            user.setEmail(email);
        }
        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
        }
        if (request.phone() != null) {
            user.setPhone(trimToNull(request.phone()));
        }
        if (request.branchId() != null) {
            user.setBranchId(trimToNull(request.branchId()));
        }
        if (request.department() != null) {
            user.setDepartment(trimToNull(request.department()));
        }
        if (request.ward() != null) {
            user.setWard(trimToNull(request.ward()));
        }

        applyProfilePatch(user, request);

        User saved = userRepository.save(user);
        auditLogService.record(AuditAction.USER_UPDATED, "USER", saved.getId(),
                "Updated profile of " + saved.getEmail());
        return UserResponse.detail(saved);
    }

    @Override
    public UserResponse changeRole(String id, ChangeRoleRequest request) {
        User user = getEntityById(id);
        UserRole target = request.role().canonical();

        if (user.getRole() == target) {
            throw new BadRequestException("This account already holds the role " + target);
        }

        // Demoting yourself would immediately remove your own administrative access
        // mid-session; the UI hides the control, and the service refuses it so a
        // direct API call cannot do it either.
        if (id.equals(currentUser.userId())) {
            throw new BadRequestException("You cannot change your own role");
        }

        // Removing the final Super Admin would leave nobody able to administer the
        // deployment — the failure mode this whole check exists to prevent.
        if (user.getRole() == UserRole.SUPER_ADMIN && target != UserRole.SUPER_ADMIN) {
            assertNotLastSuperAdmin(id, "demote");
        }

        UserRole previous = user.getRole();
        user.setRole(target);
        userRepository.save(user);

        log.info("Changed role for {}: {} -> {}", id, previous, target);
        auditLogService.record(AuditAction.ROLE_CHANGED, "USER", id,
                "Role changed from " + previous + " to " + target
                        + (request.reason() == null || request.reason().isBlank()
                        ? "" : " — " + request.reason()));
        return UserResponse.detail(user);
    }

    @Override
    public UserResponse changeStatus(String id, ChangeStatusRequest request) {
        User user = getEntityById(id);
        boolean active = Boolean.TRUE.equals(request.active());

        if (id.equals(currentUser.userId()) && !active) {
            throw new BadRequestException("You cannot deactivate your own account");
        }

        if (!active) {
            if (request.reason() == null || request.reason().isBlank()) {
                // A deactivation nobody can explain is indistinguishable from a bug.
                throw new BadRequestException("A reason is required to deactivate an account");
            }
            if (user.getRole() == UserRole.SUPER_ADMIN) {
                assertNotLastSuperAdmin(id, "deactivate");
            }
            user.deactivate(request.reason().trim());
        } else {
            user.activate();
        }

        User saved = userRepository.save(user);
        log.info("{} account id={}", active ? "Activated" : "Deactivated", id);
        auditLogService.record(
                active ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
                "USER", id,
                active ? "Reactivated account " + saved.getEmail()
                        : "Deactivated account " + saved.getEmail()
                        + " — " + request.reason());
        return UserResponse.detail(saved);
    }

    @Override
    @Transactional
    public void softDeleteAccount(String id) {
        if (id.equals(currentUser.userId())) {
            throw new BadRequestException("You cannot delete your own account");
        }

        User user = getEntityById(id);
        if (user.getRole() == UserRole.SUPER_ADMIN) {
            assertNotLastSuperAdmin(id, "delete");
        }

        // The flag is set explicitly rather than by calling userRepository.delete().
        //
        // The entity declares @SQLDelete for this, but it is not honoured here:
        // Hibernate emits a literal `delete from users where id=?`, which would
        // destroy the row that appointments, medical records, invoices and audit
        // entries all point at. Verified directly against the database rather than
        // assumed. markDeleted() + save() also keeps the deletion and its audit row
        // in one transaction, which a repository delete would not.
        //
        // @SQLRestriction("deleted = false") then hides the row from every query.
        user.markDeleted();
        userRepository.save(user);

        log.info("Soft deleted account id={} role={}", id, user.getRole());
        auditLogService.record(AuditAction.USER_DELETED, "USER", id,
                "Soft deleted " + user.getEmail() + " (was " + user.getRole() + ")");
    }

    /**
     * Refuses an operation that would remove the last usable Super Admin.
     *
     * <p>Guards on the live count rather than a flag: if one Super Admin is already
     * inactive, deleting the second one would still leave zero, and a check on
     * "is this the only admin row" would miss that.
     */
    private void assertNotLastSuperAdmin(String id, String operation) {
        long remaining = userRepository.countByRoleAndActiveTrue(UserRole.SUPER_ADMIN)
                - (Boolean.TRUE.equals(getEntityById(id).getActive()) ? 1 : 0);

        if (remaining <= 0) {
            throw new BadRequestException(
                    "Cannot " + operation + " the last active Super Admin; the deployment "
                            + "would be left without an administrator");
        }
    }

    /**
     * Requires the profile fields a role cannot function without.
     *
     * <p>Validated here because only now is the role known — bean validation on the
     * request cannot tell whether a missing specialization matters.
     */
    private void validateRoleFields(UserRole role, String specialization, String licenseNumber,
                                    java.time.LocalDate dateOfBirth, String employeeNumber) {
        switch (role) {
            case DOCTOR -> {
                require(specialization, "Specialization is required for a doctor");
                require(licenseNumber, "License number is required for a doctor");
            }
            case PATIENT -> {
                if (dateOfBirth == null) {
                    throw new BadRequestException("Date of birth is required for a patient");
                }
                if (dateOfBirth.isAfter(java.time.LocalDate.now())) {
                    throw new BadRequestException("Date of birth cannot be in the future");
                }
            }
            case PHARMACIST -> require(employeeNumber, "Employee number is required for a pharmacist");
            default -> { /* no additional profile required */ }
        }
    }

    private void require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
    }

    /**
     * Builds the right single-table subclass for a role.
     *
     * <p>Selecting the subclass here is what makes the discriminator
     * ({@code user_type}) correct, and it is why roles without a dedicated entity
     * — nurse, receptionist, cashier, hospital admin — are stored as {@link AdminUser}.
     */
    private User buildUserForRole(UserRole role) {
        return switch (role) {
            case DOCTOR -> Doctor.builder().build();
            case PATIENT -> Patient.builder().build();
            case PHARMACIST -> Pharmacist.builder().build();
            case LAB_TECHNICIAN -> LaboratoryStaff.builder().build();
            // Remaining roles share the AdminUser row type; canonical() has already
            // folded the ADMIN and LABORATORY aliases onto their real values.
            default -> AdminUser.builder().build();
        };
    }

    private void applyRoleProfile(User user, CreateUserRequest request) {
        if (user instanceof Doctor doctor) {
            doctor.setSpecialization(request.specialization().trim());
            doctor.setLicenseNumber(request.licenseNumber().trim());
            doctor.setYearsOfExperience(request.yearsOfExperience());
            doctor.setQualifications(trimToNull(request.qualifications()));
            doctor.setConsultationFee(request.consultationFee());
            doctor.setBio(trimToNull(request.bio()));
            doctor.setAvailable(request.available() == null || request.available());
        } else if (user instanceof Patient patient) {
            patient.setDateOfBirth(request.dateOfBirth());
            patient.setGender(request.gender());
            patient.setAddress(trimToNull(request.address()));
            patient.setBloodType(trimToNull(request.bloodType()));
            patient.setMedicalHistory(trimToNull(request.medicalHistory()));
            patient.setAllergies(trimToNull(request.allergies()));
            patient.setEmergencyContactName(trimToNull(request.emergencyContactName()));
            patient.setEmergencyContactPhone(trimToNull(request.emergencyContactPhone()));
            patient.setRegistrationNumber(trimToNull(request.registrationNumber()));
        } else if (user instanceof Pharmacist pharmacist) {
            pharmacist.setEmployeeNumber(request.employeeNumber().trim());
            pharmacist.setPharmacyLocation(trimToNull(request.pharmacyLocation()));
        }
    }

    /** Only applies fields that were actually sent, so a partial edit is safe. */
    private void applyProfilePatch(User user, UpdateUserRequest request) {
        if (user instanceof Doctor doctor) {
            setIfPresent(request.specialization(), doctor::setSpecialization);
            setIfPresent(request.licenseNumber(), doctor::setLicenseNumber);
            if (request.yearsOfExperience() != null) doctor.setYearsOfExperience(request.yearsOfExperience());
            if (request.consultationFee() != null) doctor.setConsultationFee(request.consultationFee());
            if (request.available() != null) doctor.setAvailable(request.available());
            if (request.qualifications() != null) doctor.setQualifications(trimToNull(request.qualifications()));
            if (request.bio() != null) doctor.setBio(trimToNull(request.bio()));
        } else if (user instanceof Patient patient) {
            if (request.dateOfBirth() != null) patient.setDateOfBirth(request.dateOfBirth());
            if (request.gender() != null) patient.setGender(request.gender());
            if (request.bloodType() != null) patient.setBloodType(trimToNull(request.bloodType()));
            if (request.medicalHistory() != null) patient.setMedicalHistory(trimToNull(request.medicalHistory()));
            if (request.allergies() != null) patient.setAllergies(trimToNull(request.allergies()));
            if (request.emergencyContactName() != null) {
                patient.setEmergencyContactName(trimToNull(request.emergencyContactName()));
            }
            if (request.emergencyContactPhone() != null) {
                patient.setEmergencyContactPhone(trimToNull(request.emergencyContactPhone()));
            }
            if (request.registrationNumber() != null) {
                patient.setRegistrationNumber(trimToNull(request.registrationNumber()));
            }
        } else if (user instanceof Pharmacist pharmacist) {
            setIfPresent(request.employeeNumber(), pharmacist::setEmployeeNumber);
            if (request.pharmacyLocation() != null) {
                pharmacist.setPharmacyLocation(trimToNull(request.pharmacyLocation()));
            }
        }

        // Address is shared by any role that has one, so it is set outside the
        // branches above.
        if (request.address() != null && user instanceof Patient patient) {
            patient.setAddress(trimToNull(request.address()));
        }
    }

    private void setIfPresent(String value, java.util.function.Consumer<String> setter) {
        if (value != null) {
            setter.accept(value.isBlank() ? null : value.trim());
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * A strong random password for accounts created without one.
     *
     * <p>24 characters from {@link SecureRandom} covering the classes the policy
     * requires, shuffled. Never derived from anything predictable.
     */
    private String generatePassword() {
        final String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        final String lower = "abcdefghijkmnopqrstuvwxyz";
        final String digits = "23456789";
        final String symbols = "!@#$%^&*-_=+";
        final String all = upper + lower + digits + symbols;

        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder password = new StringBuilder(24);
        password.append(upper.charAt(random.nextInt(upper.length())));
        password.append(lower.charAt(random.nextInt(lower.length())));
        password.append(digits.charAt(random.nextInt(digits.length())));
        password.append(symbols.charAt(random.nextInt(symbols.length())));
        while (password.length() < 24) {
            password.append(all.charAt(random.nextInt(all.length())));
        }

        char[] chars = password.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }

    // ---------------- Role changes (dual approval) ----------------

    @Override
    public RoleChangeRequestResponse requestRoleChange(String targetUserId, UserRole requestedRole, String reason) {
        User target = getEntityById(targetUserId);

        // Privilege escalation guard: no self-service role changes at all.
        if (targetUserId.equals(currentUser.userId())) {
            throw new BadRequestException("You cannot request a role change for your own account");
        }
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("A reason is required for a role change");
        }
        if (target.getRole() == requestedRole) {
            throw new BadRequestException("User already holds role " + requestedRole);
        }
        if (roleChangeRequestRepository.existsByTargetUserIdAndRequestedRoleAndStatus(
                targetUserId, requestedRole, RoleChangeRequest.Status.PENDING)) {
            throw new BadRequestException("A pending request for this role already exists");
        }

        RoleChangeRequest request = RoleChangeRequest.builder()
                .id(UUID.randomUUID().toString())
                .targetUserId(targetUserId)
                .targetUserEmail(target.getEmail())
                .currentRole(target.getRole())
                .requestedRole(requestedRole)
                .status(RoleChangeRequest.Status.PENDING)
                .requestedById(currentUser.userId())
                .requestedByEmail(currentUser.require().getUsername())
                .reason(reason)
                .requestedAt(LocalDateTime.now())
                .build();

        roleChangeRequestRepository.save(request);
        auditLogService.record(AuditAction.ROLE_CHANGE_REQUESTED, "USER", targetUserId,
                "Requested role change to " + requestedRole);
        log.info("Role change requested for user {} -> {} by {}", targetUserId, requestedRole, currentUser.userId());
        return RoleChangeRequestResponse.from(request);
    }

    @Override
    public RoleChangeRequestResponse approveRoleChange(String requestId, String decisionReason) {
        RoleChangeRequest request = getPendingRequest(requestId);
        requireDistinctApprover(request);

        User target = getEntityById(request.getTargetUserId());
        target.setRole(request.getRequestedRole());
        userRepository.save(target);

        request.setStatus(RoleChangeRequest.Status.APPROVED);
        request.setApprovedById(currentUser.userId());
        request.setApprovedByEmail(currentUser.require().getUsername());
        request.setDecisionReason(decisionReason);
        request.setDecidedAt(LocalDateTime.now());
        roleChangeRequestRepository.save(request);

        auditLogService.record(AuditAction.ROLE_CHANGED, "USER", request.getTargetUserId(),
                "Role changed to " + request.getRequestedRole() + " by dual approval");
        auditLogService.record(AuditAction.ROLE_CHANGE_APPROVED, "ROLE_CHANGE_REQUEST", requestId,
                "Approved role change");
        log.info("Role change {} approved by {}", requestId, currentUser.userId());
        return RoleChangeRequestResponse.from(request);
    }

    @Override
    public RoleChangeRequestResponse rejectRoleChange(String requestId, String decisionReason) {
        RoleChangeRequest request = getPendingRequest(requestId);
        requireDistinctApprover(request);

        request.setStatus(RoleChangeRequest.Status.REJECTED);
        request.setApprovedById(currentUser.userId());
        request.setApprovedByEmail(currentUser.require().getUsername());
        request.setDecisionReason(decisionReason);
        request.setDecidedAt(LocalDateTime.now());
        roleChangeRequestRepository.save(request);

        auditLogService.record(AuditAction.ROLE_CHANGE_APPROVED, "ROLE_CHANGE_REQUEST", requestId,
                "Rejected role change");
        return RoleChangeRequestResponse.from(request);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RoleChangeRequestResponse> listRoleChangeRequests(RoleChangeRequest.Status status,
                                                                         Pageable pageable) {
        Page<RoleChangeRequest> page = status != null
                ? roleChangeRequestRepository.findByStatusOrderByRequestedAtDesc(status, pageable)
                : roleChangeRequestRepository.findAllByOrderByRequestedAtDesc(pageable);
        return PageResponse.of(page.map(RoleChangeRequestResponse::from));
    }

    @Override
    public Set<String> permissionsFor(UserRole role) {
        return RolePermissions.forRole(role);
    }

    // ---------------- helpers ----------------

    private RoleChangeRequest getPendingRequest(String requestId) {
        RoleChangeRequest request = roleChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Role change request not found: " + requestId));
        if (request.getStatus() != RoleChangeRequest.Status.PENDING) {
            throw new BadRequestException("This request has already been decided");
        }
        return request;
    }

    /** Separation of duties: the approver must not be the requester. */
    private void requireDistinctApprover(RoleChangeRequest request) {
        if (request.getRequestedById() != null
                && request.getRequestedById().equals(currentUser.userId())) {
            throw new BadRequestException(
                    "A role change must be approved by a different privileged user");
        }
    }

    /**
     * Builds the concrete user entity. Roles without their own entity class reuse
     * {@link AdminUser}, whose {@code user_type = 'ADMIN'} discriminator already
     * exists in the schema.
     */
    private User buildUser(CreateUserRequest request) {
        String encodedPassword = passwordEncoder.encode(request.password());

        return switch (request.role()) {
            case DOCTOR -> Doctor.builder()
                    .email(request.email())
                    .password(encodedPassword)
                    .fullName(request.fullName())
                    .phone(request.phone())
                    .role(UserRole.DOCTOR)
                    .active(true)
                    .specialization("General")
                    .licenseNumber("LIC-" + System.currentTimeMillis())
                    .build();
            case PATIENT -> Patient.builder()
                    .email(request.email())
                    .password(encodedPassword)
                    .fullName(request.fullName())
                    .phone(request.phone())
                    .role(UserRole.PATIENT)
                    .active(true)
                    .build();
            case PHARMACIST -> Pharmacist.builder()
                    .email(request.email())
                    .password(encodedPassword)
                    .fullName(request.fullName())
                    .phone(request.phone())
                    .role(UserRole.PHARMACIST)
                    .active(true)
                    .employeeNumber("PH-" + System.currentTimeMillis())
                    .build();
            case LAB_TECHNICIAN, LABORATORY -> LaboratoryStaff.builder()
                    .email(request.email())
                    .password(encodedPassword)
                    .fullName(request.fullName())
                    .phone(request.phone())
                    .role(UserRole.LAB_TECHNICIAN)
                    .active(true)
                    .build();
            case HOSPITAL_ADMIN, NURSE, RECEPTIONIST, CASHIER, SUPER_ADMIN, ADMIN -> AdminUser.builder()
                    .email(request.email())
                    .password(encodedPassword)
                    .fullName(request.fullName())
                    .phone(request.phone())
                    .role(request.role() == UserRole.SUPER_ADMIN ? UserRole.SUPER_ADMIN : request.role())
                    .active(true)
                    .build();
        };
    }

    private User getEntityById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}