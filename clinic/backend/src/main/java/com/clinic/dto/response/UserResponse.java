package com.clinic.dto.response;

import com.clinic.entity.AdminUser;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.entity.Pharmacist;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A user account as the admin screens see it.
 *
 * <p>Two shapes on one record. {@code ListView} is what a table row needs; the
 * detail adds the role-specific profile. Splitting them keeps the list endpoint
 * from dragging every doctor's biography through the wire.
 *
 * <p>There is deliberately no password field. The hash is never mapped into a
 * response DTO, so it cannot leak through a new endpoint by accident — the
 * omission is structural rather than a rule someone has to remember.
 *
 * <p>For a patient this exposes demographics and account info only.
 * Diagnoses, prescriptions, medical records and lab results are reachable through
 * their own clinical endpoints, which Super Admin does not hold.
 */
public record UserResponse(
        String id,
        String email,
        String fullName,
        String phone,
        UserRole role,
        boolean active,
        String branchId,
        String department,
        String ward,
        boolean mustChangePassword,
        String deactivationReason,
        LocalDateTime deactivatedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Profile profile
) {

    /** Role-specific fields, or null for roles with no extra profile. */
    public record Profile(
            // Doctor / Clinician
            String specialization,
            String licenseNumber,
            Integer yearsOfExperience,
            String qualifications,
            java.math.BigDecimal consultationFee,
            String bio,
            Boolean available,
            String department,
            String ward,
            // Pharmacist
            String employeeNumber,
            String pharmacyLocation,
            // Patient demographics
            LocalDate dateOfBirth,
            String gender,
            String address,
            String bloodType,
            String medicalHistory,
            String allergies,
            String emergencyContactName,
            String emergencyContactPhone,
            String registrationNumber,
            LocalDateTime checkedInAt
    ) {
    }

    public static UserResponse from(User user) {
        return from(user, false);
    }

    /** Summary for list rows: no profile payload. */
    public static UserResponse listView(User user) {
        return from(user, false);
    }

    /** Full view for the detail endpoint. */
    public static UserResponse detail(User user) {
        return from(user, true);
    }

    private static UserResponse from(User user, boolean includeProfile) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getPhone(),
                user.getRole(),
                Boolean.TRUE.equals(user.getActive()),
                user.getBranchId(),
                user.getDepartment(),
                user.getWard(),
                Boolean.TRUE.equals(user.getMustChangePassword()),
                user.getDeactivationReason(),
                user.getDeactivatedAt(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                includeProfile ? profileOf(user) : null);
    }

    /**
     * Reads the single-table subclass directly rather than through a join, so a
     * detail response is one query instead of one per subclass.
     */
    private static Profile profileOf(User user) {
        if (user instanceof Doctor doctor) {
            return new Profile(
                    doctor.getSpecialization(),
                    doctor.getLicenseNumber(),
                    doctor.getYearsOfExperience(),
                    doctor.getQualifications(),
                    doctor.getConsultationFee(),
                    doctor.getBio(),
                    doctor.getAvailable(),
                    doctor.getDepartment(),
                    doctor.getWard(),
                    null, null,
                    null, null, null, null, null, null, null, null, null, null);
        }
        if (user instanceof Patient patient) {
            return new Profile(
                    null, null, null, null, null, null, null,
                    patient.getDepartment(),
                    patient.getWard(),
                    null, null,
                    patient.getDateOfBirth(),
                    patient.getGender() != null ? patient.getGender().name() : null,
                    patient.getAddress(),
                    patient.getBloodType(),
                    patient.getMedicalHistory(),
                    patient.getAllergies(),
                    patient.getEmergencyContactName(),
                    patient.getEmergencyContactPhone(),
                    patient.getRegistrationNumber(),
                    patient.getCheckedInAt());
        }
        if (user instanceof Pharmacist pharmacist) {
            return new Profile(
                    null,
                    pharmacist.getEmployeeNumber(),
                    null, null, null, null, null,
                    pharmacist.getDepartment(),
                    pharmacist.getWard(),
                    pharmacist.getEmployeeNumber(),
                    pharmacist.getPharmacyLocation(),
                    null, null, null, null, null, null, null, null, null, null);
        }
        if (user instanceof AdminUser adminUser) {
            return new Profile(
                    null, null, null, null, null, null, null,
                    adminUser.getDepartment(),
                    adminUser.getWard(),
                    null, null,
                    null, null, null, null, null, null, null, null, null, null);
        }
        return new Profile(
                null, null, null, null, null, null, null,
                user.getDepartment(),
                user.getWard(),
                null, null,
                null, null, null, null, null, null, null, null, null, null);
    }
}