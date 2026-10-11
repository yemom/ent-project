package com.clinic.security;

import com.clinic.entity.UserRole;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.clinic.security.Permissions.*;

/**
 * Central role → permission map. Both backend method security and the frontend
 * navigation/guard filters derive from this single definition.
 *
 * <p>Roles are read through {@link UserRole#canonical()} so the legacy
 * {@code ADMIN} and {@code LABORATORY} values behave exactly like
 * {@code SUPER_ADMIN} and {@code LAB_TECHNICIAN}.
 *
 * <p>Rules encoded here:
 * <ul>
 *   <li>SUPER_ADMIN: settings, branches, users, roles, audit — no clinical data.</li>
 *   <li>HOSPITAL_ADMIN: departments, staff, wards, rooms, reports — no diagnoses
 *       or prescriptions.</li>
 *   <li>DOCTOR: assigned patients, diagnoses, plans, prescriptions, lab requests,
 *       admissions.</li>
 *   <li>NURSE: assigned patients, vitals, medication administration — cannot prescribe.</li>
 *   <li>RECEPTIONIST: registration, appointments, queue — demographics only.</li>
 *   <li>LAB_TECHNICIAN: lab requests, specimens, results, validation — cannot
 *       diagnose or prescribe.</li>
 *   <li>PHARMACIST: verify/dispense prescriptions, inventory, batches, expiry.</li>
 *   <li>CASHIER: invoices, payments, receipts, refunds — no clinical edits.</li>
 *   <li>PATIENT: own data only.</li>
 * </ul>
 */
public final class RolePermissions {

    private static final Map<UserRole, Set<String>> MATRIX = buildMatrix();

    private RolePermissions() {
    }

    private static Map<UserRole, Set<String>> buildMatrix() {
        Map<UserRole, Set<String>> matrix = new java.util.EnumMap<>(UserRole.class);

        Set<String> superAdmin = ordered(
                SETTINGS_MANAGE,
                BRANCH_MANAGE,
                USER_MANAGE,
                ROLE_MANAGE,
                AUDIT_READ,
                REPORT_READ,
                // Administrative reads across the operational directories, so the
                // dashboard can list real staff, appointment, laboratory and billing
                // records instead of empty pages.
                //
                // Patient data comes through PATIENT_DIRECTORY_READ rather than
                // PATIENT_DEMOGRAPHICS_READ: the Super Admin can see who is
                // registered, but the clinical permission — and with it access to
                // medical records, diagnoses and prescriptions — stays with the
                // roles that actually treat patients.
                PATIENT_DIRECTORY_READ,
                STAFF_MANAGE,
                APPOINTMENT_MANAGE,
                LAB_ORDER_READ,
                INVOICE_READ,
                RECEIPT_READ,
                // Only admins can approve a large refund or a role change.
                REFUND_APPROVE
        );
        matrix.put(UserRole.SUPER_ADMIN, superAdmin);
        matrix.put(UserRole.ADMIN, superAdmin);

        matrix.put(UserRole.HOSPITAL_ADMIN, ordered(
                DEPARTMENT_MANAGE,
                STAFF_MANAGE,
                WARD_MANAGE,
                ROOM_MANAGE,
                REPORT_READ,
                APPOINTMENT_MANAGE,
                PATIENT_REGISTER,
                PATIENT_DEMOGRAPHICS_READ,
                REFUND_APPROVE
        ));

        matrix.put(UserRole.DOCTOR, ordered(
                PATIENT_DEMOGRAPHICS_READ,
                DIAGNOSIS_WRITE,
                TREATMENT_PLAN_WRITE,
                PRESCRIPTION_WRITE,
                LAB_ORDER_CREATE,
                LAB_ORDER_READ,
                ADMISSION_WRITE
        ));

        matrix.put(UserRole.NURSE, ordered(
                PATIENT_DEMOGRAPHICS_READ,
                VITAL_WRITE,
                MEDICATION_ADMINISTER
        ));

        matrix.put(UserRole.RECEPTIONIST, ordered(
                PATIENT_REGISTER,
                PATIENT_DEMOGRAPHICS_READ,
                CHECK_IN,
                PATIENT_ASSIGN,
                APPOINTMENT_MANAGE,
                QUEUE_MANAGE
        ));

        Set<String> labTech = ordered(
                LAB_ORDER_READ,
                LAB_RESULT_WRITE,
                LAB_RESULT_VALIDATE,
                PATIENT_DEMOGRAPHICS_READ
        );
        matrix.put(UserRole.LAB_TECHNICIAN, labTech);
        matrix.put(UserRole.LABORATORY, labTech);

        matrix.put(UserRole.PHARMACIST, ordered(
                PRESCRIPTION_VERIFY,
                PRESCRIPTION_DISPENSE,
                INVENTORY_MANAGE,
                BATCH_MANAGE
        ));

        matrix.put(UserRole.CASHIER, ordered(
                INVOICE_READ,
                PAYMENT_CREATE,
                RECEIPT_READ,
                REFUND_CREATE
        ));

        matrix.put(UserRole.PATIENT, ordered(APPOINTMENT_MANAGE, OWN_RECORD_READ));

        return java.util.Collections.unmodifiableMap(matrix);
    }

    private static Set<String> ordered(String... values) {
        return java.util.Collections.unmodifiableSet(new LinkedHashSet<>(List.of(values)));
    }

    /** Permissions held by a role, with legacy aliases already collapsed. */
    public static Set<String> forRole(UserRole role) {
        if (role == null) {
            return Set.of();
        }
        return MATRIX.getOrDefault(role.canonical(), Set.of());
    }

    public static boolean has(UserRole role, String permission) {
        return forRole(role).contains(permission);
    }

    public static boolean hasAny(UserRole role, String... permissions) {
        Set<String> granted = forRole(role);
        for (String permission : permissions) {
            if (granted.contains(permission)) {
                return true;
            }
        }
        return false;
    }

    /** Spring Security authority names for a role, including the legacy alias. */
    public static List<String> authoritiesFor(UserRole role) {
        List<String> authorities = new java.util.ArrayList<>();
        authorities.add("ROLE_" + role.name());
        if (role == UserRole.SUPER_ADMIN) {
            authorities.add("ROLE_ADMIN");
        }
        if (role == UserRole.LAB_TECHNICIAN) {
            authorities.add("ROLE_LABORATORY");
        }
        return List.copyOf(authorities);
    }
}