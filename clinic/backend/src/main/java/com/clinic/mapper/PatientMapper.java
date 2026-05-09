package com.clinic.mapper;

import com.clinic.dto.request.PatientCreateRequest;
import com.clinic.dto.request.PatientUpdateRequest;
import com.clinic.dto.response.PatientResponse;
import com.clinic.entity.Patient;
import com.clinic.entity.UserRole;
import org.springframework.stereotype.Component;

@Component
public class PatientMapper {

    public Patient toEntity(PatientCreateRequest request, String encodedPassword) {
        if (request == null) {
            return null;
        }

        return Patient.builder()
                .email(request.email())
                .password(encodedPassword)
                .fullName(request.fullName())
                .phone(request.phone())
                .role(UserRole.PATIENT)
                .dateOfBirth(request.dateOfBirth())
                .gender(request.gender())
                .medicalHistory(request.medicalHistory())
                .bloodType(request.bloodType())
                .allergies(request.allergies())
                .emergencyContactName(request.emergencyContactName())
                .emergencyContactPhone(request.emergencyContactPhone())
                .active(true)
                .build();
    }

    public void updateEntity(Patient patient, PatientUpdateRequest request) {
        if (patient == null || request == null) {
            return;
        }

        if (request.fullName() != null) {
            patient.setFullName(request.fullName());
        }
        if (request.phone() != null) {
            patient.setPhone(request.phone());
        }
        if (request.dateOfBirth() != null) {
            patient.setDateOfBirth(request.dateOfBirth());
        }
        if (request.gender() != null) {
            patient.setGender(request.gender());
        }
        if (request.medicalHistory() != null) {
            patient.setMedicalHistory(request.medicalHistory());
        }
        if (request.bloodType() != null) {
            patient.setBloodType(request.bloodType());
        }
        if (request.allergies() != null) {
            patient.setAllergies(request.allergies());
        }
        if (request.emergencyContactName() != null) {
            patient.setEmergencyContactName(request.emergencyContactName());
        }
        if (request.emergencyContactPhone() != null) {
            patient.setEmergencyContactPhone(request.emergencyContactPhone());
        }
        if (request.active() != null) {
            patient.setActive(request.active());
        }
    }

    public PatientResponse toResponse(Patient patient) {
        if (patient == null) {
            return null;
        }

        return new PatientResponse(
                patient.getId(),
                patient.getEmail(),
                patient.getFullName(),
                patient.getPhone(),
                patient.getRole(),
                patient.getDateOfBirth(),
                patient.getGender(),
                patient.getMedicalHistory(),
                patient.getBloodType(),
                patient.getAllergies(),
                patient.getEmergencyContactName(),
                patient.getEmergencyContactPhone(),
                patient.getActive(),
                patient.getCreatedAt(),
                patient.getUpdatedAt()
        );
    }
}
