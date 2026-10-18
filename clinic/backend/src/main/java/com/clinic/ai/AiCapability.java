package com.clinic.ai;

import com.clinic.entity.UserRole;
import com.clinic.security.Permissions;

import java.util.Set;

import static com.clinic.security.Permissions.*;

/**
 * The questions the assistant knows how to answer from real hospital data.
 *
 * <p>Two design decisions are worth stating plainly, because they are the reason
 * this is an enum and not a set of model-invoked functions:
 *
 * <ol>
 *   <li><b>The model does not choose what data to read.</b> The client asks for a
 *       named capability; the server checks permissions, builds the query and
 *       computes the numbers. There is no function-calling loop for a prompt to
 *       hijack, and no way for text in a patient record or a user's question to
 *       reach a query the user was not already authorised for.</li>
 *   <li><b>The model does not do arithmetic.</b> Counts, sums and dates come from
 *       the repositories as computed values. The model receives those as facts and
 *       is asked to explain them, never to derive them. A language model
 *       inventing "₵12,450 collected last month" is a billing incident.</li>
 * </ol>
 *
 * <p>The cost is that the assistant cannot answer a question outside this list. It
 * says so, rather than improvising — see {@code NOT_AVAILABLE} handling in
 * {@code AiService}.
 */
public enum AiCapability {

    /**
     * Appointment volume and outcomes over a date range.
     *
     * <p>Held by reception, doctors and administrators — anyone who can see the
     * appointment book. Aggregates only; no patient identity.
     */
    APPOINTMENT_METRICS(
            "appointment_metrics",
            "Appointment totals and outcomes",
            "How many appointments were booked, completed, cancelled or missed over a date range.",
            Set.of(APPOINTMENT_MANAGE),
            false),

    /**
     * Free slots for a doctor, via the real scheduling service.
     *
     * <p>Goes through {@code AppointmentService}, so doctor- and patient-scoped
     * callers get the same scoping the REST endpoints enforce.
     */
    AVAILABLE_SLOTS(
            "available_slots",
            "Find appointment slots",
            "Which slots are free for a named doctor, and which appointments already occupy them.",
            Set.of(APPOINTMENT_MANAGE),
            false),

    /**
     * New-patient registration trend.
     *
     * <p>Counts only. The administrative directory permission is enough — there is
     * no reason a trend needs to expose who.
     */
    PATIENT_REGISTRATIONS(
            "patient_registrations",
            "Patient registration trend",
            "How many patients registered over a date range, and how that compares with the previous period.",
            Set.of(PATIENT_REGISTER, PATIENT_DIRECTORY_READ, PATIENT_DEMOGRAPHICS_READ),
            false),

    /**
     * Bookings per clinician.
     *
     * <p>Workload, not performance: this is how many appointments each doctor has,
     * used for rostering. It deliberately reports no outcomes per clinician, which
     * would be a clinical judgement the data does not support.
     */
    STAFF_WORKLOAD(
            "staff_workload",
            "Doctor workload",
            "How many appointments each doctor is carrying over a date range.",
            Set.of(STAFF_MANAGE, REPORT_READ),
            false),

    /**
     * Low stock, out of stock, near-expiry batches and total stock value.
     */
    PHARMACY_INVENTORY(
            "pharmacy_inventory",
            "Pharmacy stock and expiry",
            "Which medicines are low or out of stock, which batches expire soon, and the total stock value.",
            Set.of(INVENTORY_MANAGE, BATCH_MANAGE),
            false),

    /**
     * Order queue depth by status, plus draft vs final results and critical flags.
     */
    LABORATORY_WORKLOAD(
            "laboratory_workload",
            "Laboratory workload",
            "How many lab orders are pending, in progress or complete, and how many results are still drafts.",
            Set.of(LAB_ORDER_READ),
            false),

    /**
     * Billing totals, straight from the invoice repository.
     */
    FINANCIAL_SUMMARY(
            "financial_summary",
            "Financial summary",
            "Revenue collected, outstanding balances and invoice status breakdown for a date range.",
            Set.of(INVOICE_READ),
            false),

    /**
     * Clinical documentation help for a clinician's own authorised patients.
     *
     * <p>The only capability that puts clinical text into a prompt, which is why it
     * is gated on the clinical read permissions and honours
     * {@code AI_ALLOW_IDENTIFIABLE_DATA}. The output is a draft that requires
     * clinician verification and is labelled as such.
     */
    CLINICAL_DOCUMENTATION(
            "clinical_documentation",
            "Clinical documentation draft",
            "Draft a visit summary or handover note from records the clinician is authorised to read.",
            Set.of(DIAGNOSIS_WRITE),
            true),

    /**
     * A patient's own record, for the patient themselves.
     *
     * <p>{@code own_record:read} only, and the patient is resolved from the
     * principal, so this cannot be pointed at another account.
     */
    PATIENT_OWN_RECORD(
            "patient_own_record",
            "My medical record",
            "Explain the caller's own record, appointments and follow-up plan in plain language.",
            Set.of(OWN_RECORD_READ),
            true),

    /**
     * A patient's own appointments.
     */
    PATIENT_OWN_APPOINTMENTS(
            "patient_own_appointments",
            "My appointments",
            "Explain the caller's own upcoming and past appointments.",
            Set.of(OWN_RECORD_READ, APPOINTMENT_MANAGE),
            false),

    /**
     * The caller's own appointment book, for a doctor.
     *
     * <p>Exists because {@code AppointmentController} grants doctors read access to
     * the appointment book <em>by role</em>
     * ({@code SCHEDULER or hasRole('DOCTOR')}) and then narrows it to that doctor's
     * own panel inside the service. Without this capability the assistant would be
     * strictly less permissive than the REST API for exactly the same data, which
     * is a confusing difference rather than a security control.
     *
     * <p>The scoping is not reimplemented here: the capability calls
     * {@code AppointmentService.search} with no filters, so the service applies the
     * caller's own scope. Widening it to a clinic-wide aggregate for doctors would
     * grant more than {@code GET /appointments} does, so
     * {@link #APPOINTMENT_METRICS} stays on {@code appointment:manage} and remains
     * hospital-wide.
     */
    MY_APPOINTMENTS(
            "my_appointments",
            "My appointment book",
            "Summarise the caller's own appointments, including anything needing confirmation.",
            Set.of(APPOINTMENT_MANAGE),
            false) {
    },

    /**
     * A bounded operational projection from authorised historical or current
     * metrics. The service selects the metric for the caller's role; the model
     * never receives unrestricted hospital data.
    */
    OPERATIONAL_FORECAST(
            "operational_forecast",
            "Operational forecast",
            "Project the next operational period from authorised historical data and disclose when the data is insufficient.",
            Set.of(APPOINTMENT_MANAGE, REPORT_READ, PATIENT_DEMOGRAPHICS_READ,
                    LAB_ORDER_READ, INVENTORY_MANAGE, INVOICE_READ, OWN_RECORD_READ),
            false) {
    };

    /**
     * Roles that reach this capability without holding any of its permissions.
     *
     * <p>Kept beside the permission set rather than folded into it, so a reader can
     * see at a glance which capabilities are permission-driven and which mirror an
     * existing role-based rule.
     */
    private java.util.Set<UserRole> alsoAllowedRoles() {
        return this == MY_APPOINTMENTS
                ? java.util.Set.of(UserRole.DOCTOR)
                : java.util.Set.of();
    }

    private final String id;
    private final String label;
    private final String description;
    private final Set<String> anyOfPermissions;
    private final boolean involvesClinicalText;

    AiCapability(String id, String label, String description,
                 Set<String> anyOfPermissions, boolean involvesClinicalText) {
        this.id = id;
        this.label = label;
        this.description = description;
        this.anyOfPermissions = anyOfPermissions;
        this.involvesClinicalText = involvesClinicalText;
    }

    public String id() {
        return id;
    }

    public String label() {
        return label;
    }

    public String description() {
        return description;
    }

    /** Holding any one of these is enough. */
    public Set<String> anyOfPermissions() {
        return anyOfPermissions;
    }

    /**
     * Whether serving this capability puts free-text clinical content into a prompt.
     *
     * <p>Drives the {@code AI_ALLOW_IDENTIFIABLE_DATA} gate and the "this is a
     * draft requiring clinician review" labelling.
     */
    public boolean involvesClinicalText() {
        return involvesClinicalText;
    }

    public boolean isAvailableTo(UserRole role) {
        if (role == null) {
            return false;
        }
        if (alsoAllowedRoles().contains(role)) {
            return true;
        }
        Set<String> granted = com.clinic.security.RolePermissions.forRole(role);
        return anyOfPermissions.stream().anyMatch(granted::contains);
    }

    public static AiCapability byId(String id) {
        for (AiCapability capability : values()) {
            if (capability.id.equalsIgnoreCase(id)) {
                return capability;
            }
        }
        return null;
    }

    /**
     * Which capability covers an AI-proposed action type, if any.
     *
     * <p>Used to keep a proposed appointment change inside the same permission gate
     * as the rest of the assistant: booking needs {@code appointment:manage}, which
     * is exactly what {@link #AVAILABLE_SLOTS} already requires.
     */
    public static AiCapability forActionType(String actionType) {
        return switch (actionType) {
            case "BOOK_APPOINTMENT", "RESCHEDULE_APPOINTMENT", "CANCEL_APPOINTMENT" -> AVAILABLE_SLOTS;
            default -> null;
        };
    }
}