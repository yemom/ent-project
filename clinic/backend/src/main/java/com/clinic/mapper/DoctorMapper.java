package com.clinic.mapper;

import com.clinic.dto.request.DoctorCreateRequest;
import com.clinic.dto.request.DoctorUpdateRequest;
import com.clinic.dto.response.DoctorResponse;
import com.clinic.entity.Doctor;
import com.clinic.entity.UserRole;
import org.springframework.stereotype.Component;

@Component
public class DoctorMapper {

    public Doctor toEntity(DoctorCreateRequest request, String encodedPassword) {
        if (request == null) {
            return null;
        }

        return Doctor.builder()
                .email(request.email())
                .password(encodedPassword)
                .fullName(request.fullName())
                .phone(request.phone())
                .role(UserRole.DOCTOR)
                .specialization(request.specialization())
                .licenseNumber(request.licenseNumber())
                .yearsOfExperience(request.yearsOfExperience())
                .qualifications(request.qualifications())
                .consultationFee(request.consultationFee())
                .bio(request.bio())
                .active(true)
                .available(true)
                .build();
    }

    public void updateEntity(Doctor doctor, DoctorUpdateRequest request) {
        if (doctor == null || request == null) {
            return;
        }

        if (request.fullName() != null) {
            doctor.setFullName(request.fullName());
        }
        if (request.phone() != null) {
            doctor.setPhone(request.phone());
        }
        if (request.specialization() != null) {
            doctor.setSpecialization(request.specialization());
        }
        if (request.licenseNumber() != null) {
            doctor.setLicenseNumber(request.licenseNumber());
        }
        if (request.yearsOfExperience() != null) {
            doctor.setYearsOfExperience(request.yearsOfExperience());
        }
        if (request.qualifications() != null) {
            doctor.setQualifications(request.qualifications());
        }
        if (request.consultationFee() != null) {
            doctor.setConsultationFee(request.consultationFee());
        }
        if (request.bio() != null) {
            doctor.setBio(request.bio());
        }
        if (request.active() != null) {
            doctor.setActive(request.active());
        }
        if (request.available() != null) {
            doctor.setAvailable(request.available());
        }
    }

    public DoctorResponse toResponse(Doctor doctor) {
        if (doctor == null) {
            return null;
        }

        return new DoctorResponse(
                doctor.getId(),
                doctor.getEmail(),
                doctor.getFullName(),
                doctor.getPhone(),
                doctor.getRole(),
                doctor.getSpecialization(),
                doctor.getLicenseNumber(),
                doctor.getYearsOfExperience(),
                doctor.getQualifications(),
                doctor.getConsultationFee(),
                doctor.getBio(),
                doctor.getActive(),
                doctor.getAvailable(),
                doctor.getCreatedAt(),
                doctor.getUpdatedAt()
        );
    }
}
