package com.clinic.service.impl;

import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.*;
import com.clinic.exception.BadRequestException;
import com.clinic.mapper.UserMapper;
import com.clinic.repository.UserRepository;
import com.clinic.service.AdminService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@Slf4j
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    public AdminServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            UserMapper userMapper
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
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

        User user;
        String encodedPassword = passwordEncoder.encode(request.password());

        switch (request.role()) {
            case DOCTOR:
                user = Doctor.builder()
                        .email(request.email())
                        .password(encodedPassword)
                        .fullName(request.fullName())
                        .phone(request.phone())
                        .role(UserRole.DOCTOR)
                        .active(true)
                        .specialization("General")
                        .licenseNumber("LIC-" + System.currentTimeMillis())
                        .build();
                break;
            case PATIENT:
                user = Patient.builder()
                        .email(request.email())
                        .password(encodedPassword)
                        .fullName(request.fullName())
                        .phone(request.phone())
                        .role(UserRole.PATIENT)
                        .active(true)
                        .build();
                break;
            case PHARMACIST:
                user = Pharmacist.builder()
                        .email(request.email())
                        .password(encodedPassword)
                        .fullName(request.fullName())
                        .phone(request.phone())
                        .role(UserRole.PHARMACIST)
                        .active(true)
                        .employeeNumber("PH-" + System.currentTimeMillis())
                        .build();
                break;
            case LABORATORY:
                user = LaboratoryStaff.builder()
                        .email(request.email())
                        .password(encodedPassword)
                        .fullName(request.fullName())
                        .phone(request.phone())
                        .role(UserRole.LABORATORY)
                        .active(true)
                        .build();
                break;
            case ADMIN:
                user = AdminUser.builder()
                        .email(request.email())
                        .password(encodedPassword)
                        .fullName(request.fullName())
                        .phone(request.phone())
                        .role(UserRole.ADMIN)
                        .active(true)
                        .build();
                break;
            default:
                throw new BadRequestException("Cannot create user with role: " + request.role());
        }

        User savedUser = userRepository.save(user);
        log.info("Created user id={} role={}", savedUser.getId(), savedUser.getRole());
        return userMapper.toSummaryResponse(savedUser);
    }
}
