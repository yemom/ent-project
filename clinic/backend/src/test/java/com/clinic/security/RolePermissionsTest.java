package com.clinic.security;

import com.clinic.entity.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The permission matrix is the single source of truth for both backend
 * method-security and the frontend navigation. These tests pin the role rules so
 * a future edit cannot quietly widen someone's access.
 */
class RolePermissionsTest {

    @Test
    void superAdminHasNoClinicalPermissions() {
        var permissions = RolePermissions.forRole(UserRole.SUPER_ADMIN);

        assertTrue(permissions.contains(Permissions.USER_MANAGE));
        assertTrue(permissions.contains(Permissions.ROLE_MANAGE));
        assertTrue(permissions.contains(Permissions.AUDIT_READ));
        // Settings, branches, users, roles, audit — and nothing clinical.
        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.LAB_RESULT_WRITE));
        assertFalse(permissions.contains(Permissions.PATIENT_DEMOGRAPHICS_READ));
    }

    /**
     * The patient <em>directory</em> is deliberately a different permission from
     * demographics read.
     *
     * <p>An administrator needs to see who is registered, but must not acquire the
     * clinical permission that also opens medical records. Pinning both halves means
     * a future edit cannot quietly widen either one.
     */
    @Test
    void superAdminReadsThePatientDirectoryWithoutClinicalDemographics() {
        var permissions = RolePermissions.forRole(UserRole.SUPER_ADMIN);

        assertTrue(permissions.contains(Permissions.PATIENT_DIRECTORY_READ),
                "the Super Admin dashboard lists registered patients");
        assertFalse(permissions.contains(Permissions.PATIENT_DEMOGRAPHICS_READ),
                "directory access must not imply the clinical demographics permission");
        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE),
                "directory access must not open medical records");
    }

    @Test
    void onlyRolesWithClinicalDutyHoldDemographicsRead() {
        assertTrue(RolePermissions.has(UserRole.DOCTOR, Permissions.PATIENT_DEMOGRAPHICS_READ));
        assertTrue(RolePermissions.has(UserRole.NURSE, Permissions.PATIENT_DEMOGRAPHICS_READ));
        assertTrue(RolePermissions.has(UserRole.RECEPTIONIST, Permissions.PATIENT_DEMOGRAPHICS_READ));
        assertFalse(RolePermissions.has(UserRole.PATIENT, Permissions.PATIENT_DEMOGRAPHICS_READ),
                "a patient reads only their own record");
    }

    @Test
    void legacyAdminRoleBehavesLikeSuperAdmin() {
        assertEquals(RolePermissions.forRole(UserRole.SUPER_ADMIN), RolePermissions.forRole(UserRole.ADMIN));
    }

    @Test
    void legacyLaboratoryRoleBehavesLikeLabTechnician() {
        assertEquals(RolePermissions.forRole(UserRole.LAB_TECHNICIAN), RolePermissions.forRole(UserRole.LABORATORY));
    }

    @Test
    void hospitalAdminCannotTouchClinicalData() {
        var permissions = RolePermissions.forRole(UserRole.HOSPITAL_ADMIN);

        assertTrue(permissions.contains(Permissions.DEPARTMENT_MANAGE));
        assertTrue(permissions.contains(Permissions.STAFF_MANAGE));
        assertTrue(permissions.contains(Permissions.WARD_MANAGE));
        assertTrue(permissions.contains(Permissions.ROOM_MANAGE));
        assertTrue(permissions.contains(Permissions.REPORT_READ));

        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.TREATMENT_PLAN_WRITE));
        assertFalse(permissions.contains(Permissions.LAB_RESULT_WRITE));
    }

    @Test
    void doctorCanDiagnosePrescribeAndRequestLabs() {
        var permissions = RolePermissions.forRole(UserRole.DOCTOR);

        assertTrue(RolePermissions.has(UserRole.DOCTOR, Permissions.DIAGNOSIS_WRITE));
        assertTrue(RolePermissions.has(UserRole.DOCTOR, Permissions.PRESCRIPTION_WRITE));
        assertTrue(RolePermissions.has(UserRole.DOCTOR, Permissions.LAB_ORDER_CREATE));
        assertTrue(RolePermissions.has(UserRole.DOCTOR, Permissions.ADMISSION_WRITE));

        // A doctor does not administer meds or manage staff.
        assertFalse(RolePermissions.has(UserRole.DOCTOR, Permissions.MEDICATION_ADMINISTER));
        assertFalse(RolePermissions.has(UserRole.DOCTOR, Permissions.STAFF_MANAGE));
    }

    @Test
    void nurseCannotPrescribe() {
        var permissions = RolePermissions.forRole(UserRole.NURSE);

        assertTrue(permissions.contains(Permissions.VITAL_WRITE));
        assertTrue(permissions.contains(Permissions.MEDICATION_ADMINISTER));

        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.LAB_RESULT_WRITE));
    }

    @Test
    void receptionistHasNoClinicalAccess() {
        var permissions = RolePermissions.forRole(UserRole.RECEPTIONIST);

        assertTrue(permissions.contains(Permissions.PATIENT_REGISTER));
        assertTrue(permissions.contains(Permissions.PATIENT_ASSIGN));
        assertTrue(permissions.contains(Permissions.QUEUE_MANAGE));
        assertTrue(permissions.contains(Permissions.APPOINTMENT_MANAGE));

        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.LAB_RESULT_WRITE));
        assertFalse(permissions.contains(Permissions.VITAL_WRITE));
    }

    @Test
    void labTechnicianCannotDiagnoseOrPrescribe() {
        var permissions = RolePermissions.forRole(UserRole.LAB_TECHNICIAN);

        assertTrue(permissions.contains(Permissions.LAB_ORDER_READ));
        assertTrue(permissions.contains(Permissions.LAB_RESULT_WRITE));
        assertTrue(permissions.contains(Permissions.LAB_RESULT_VALIDATE));

        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.TREATMENT_PLAN_WRITE));
    }

    @Test
    void pharmacistVerifiesAndDispensesButDoesNotPrescribe() {
        var permissions = RolePermissions.forRole(UserRole.PHARMACIST);

        assertTrue(permissions.contains(Permissions.PRESCRIPTION_VERIFY));
        assertTrue(permissions.contains(Permissions.PRESCRIPTION_DISPENSE));
        assertTrue(permissions.contains(Permissions.INVENTORY_MANAGE));
        assertTrue(permissions.contains(Permissions.BATCH_MANAGE));

        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
    }

    @Test
    void cashierHasNoClinicalEdits() {
        var permissions = RolePermissions.forRole(UserRole.CASHIER);

        assertTrue(permissions.contains(Permissions.INVOICE_READ));
        assertTrue(permissions.contains(Permissions.PAYMENT_CREATE));
        assertTrue(permissions.contains(Permissions.RECEIPT_READ));
        assertTrue(permissions.contains(Permissions.REFUND_CREATE));
        // Approving another user's refund is a privileged action.
        assertFalse(permissions.contains(Permissions.REFUND_APPROVE));

        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.PRESCRIPTION_WRITE));
        assertFalse(permissions.contains(Permissions.VITAL_WRITE));
    }

    @Test
    void patientHoldsOnlySelfServicePermissions() {
        var permissions = RolePermissions.forRole(UserRole.PATIENT);

        assertTrue(permissions.contains(Permissions.APPOINTMENT_MANAGE));
        assertTrue(permissions.contains(Permissions.OWN_RECORD_READ));
        // Own-record read is scoped to the caller's own id by the service layer,
        // so it must not be expressed as blanket demographics access.
        assertFalse(permissions.contains(Permissions.PATIENT_DEMOGRAPHICS_READ));
        assertFalse(permissions.contains(Permissions.DIAGNOSIS_WRITE));
        assertFalse(permissions.contains(Permissions.PATIENT_REGISTER));
    }

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void authoritiesAlwaysIncludeTheRoleItself(UserRole role) {
        var authorities = RolePermissions.authoritiesFor(role);
        assertTrue(authorities.contains("ROLE_" + role.name()));
    }

    @Test
    void superAdminKeepsLegacyAdminAuthoritySoOldTokensWork() {
        var authorities = RolePermissions.authoritiesFor(UserRole.SUPER_ADMIN);
        assertTrue(authorities.contains("ROLE_ADMIN"));
    }

    @Test
    void labTechnicianKeepsLegacyLaboratoryAuthority() {
        var authorities = RolePermissions.authoritiesFor(UserRole.LAB_TECHNICIAN);
        assertTrue(authorities.contains("ROLE_LABORATORY"));
    }

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void everyRoleHasANonNullPermissionSet(UserRole role) {
        assertNotNull(RolePermissions.forRole(role));
    }
}