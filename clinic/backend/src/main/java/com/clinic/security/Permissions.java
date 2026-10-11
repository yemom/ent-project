package com.clinic.security;

/**
 * Central permission vocabulary shared by the backend method-security rules and
 * mirrored on the frontend in {@code frontend/src/features/auth/permissions.ts}.
 *
 * <p>Value strings are the wire format used in {@code @PreAuthorize} expressions
 * and in the permission list returned to the browser, so both layers filter
 * menus and guard routes from exactly the same data.
 */
public final class Permissions {

    // Administration / platform
    public static final String SETTINGS_MANAGE = "settings:manage";
    public static final String BRANCH_MANAGE = "branch:manage";
    public static final String USER_MANAGE = "user:manage";
    public static final String ROLE_MANAGE = "role:manage";
    public static final String AUDIT_READ = "audit:read";
    public static final String DEPARTMENT_MANAGE = "department:manage";
    public static final String STAFF_MANAGE = "staff:manage";
    public static final String WARD_MANAGE = "ward:manage";
    public static final String ROOM_MANAGE = "room:manage";
    public static final String REPORT_READ = "report:read";

    // Clinical
    public static final String DIAGNOSIS_WRITE = "diagnosis:write";
    public static final String TREATMENT_PLAN_WRITE = "treatment_plan:write";
    public static final String PRESCRIPTION_WRITE = "prescription:write";
    public static final String PRESCRIPTION_DISPENSE = "prescription:dispense";
    public static final String PRESCRIPTION_VERIFY = "prescription:verify";
    public static final String LAB_ORDER_CREATE = "lab_order:create";
    public static final String LAB_ORDER_READ = "lab_order:read";
    public static final String LAB_RESULT_WRITE = "lab_result:write";
    public static final String LAB_RESULT_VALIDATE = "lab_result:validate";
    public static final String INVENTORY_MANAGE = "inventory:manage";
    public static final String BATCH_MANAGE = "batch:manage";
    public static final String VITAL_WRITE = "vital:write";
    public static final String MEDICATION_ADMINISTER = "medication:administer";
    public static final String ADMISSION_WRITE = "admission:write";

    // Front desk / scheduling
    public static final String PATIENT_REGISTER = "patient:register";
    public static final String PATIENT_DEMOGRAPHICS_READ = "patient:demographics:read";
    /**
     * Administrative access to the patient <em>directory</em> — name, email, phone,
     * registration number — for roles that manage the clinic but hold no clinical
     * duty.
     *
     * <p>Deliberately separate from {@link #PATIENT_DEMOGRAPHICS_READ}: that one is
     * granted to clinicians who need demographics in order to treat, and granting it
     * to an administrator would silently hand the clinical role over as a side
     * effect. This permission opens the directory listings only; medical records,
     * diagnoses and prescriptions still require their own clinical permissions.
     */
    public static final String PATIENT_DIRECTORY_READ = "patient:directory:read";
    /** Reading one's own clinical record (as opposed to another patient's). */
    public static final String OWN_RECORD_READ = "own_record:read";
    public static final String PATIENT_ASSIGN = "patient:assign";
    public static final String APPOINTMENT_MANAGE = "appointment:manage";
    public static final String QUEUE_MANAGE = "queue:manage";
    public static final String CHECK_IN = "checkin:write";

    // Billing
    public static final String INVOICE_READ = "invoice:read";
    public static final String PAYMENT_CREATE = "payment:create";
    public static final String RECEIPT_READ = "receipt:read";
    public static final String REFUND_CREATE = "refund:create";
    public static final String REFUND_APPROVE = "refund:approve";

    private Permissions() {
    }
}