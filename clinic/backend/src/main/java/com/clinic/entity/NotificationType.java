package com.clinic.entity;

/**
 * Notification categories emitted by the system.
 *
 * <p>Generalises the former lab-only notification: a row now targets either a
 * specific user or a whole role, carries a reference to the related record and
 * a client-side link so the bell can navigate straight to it.
 */
public enum NotificationType {
    /** A doctor created a lab/investigation order. */
    LAB_ORDER_CREATED,
    /** A lab technician submitted/validated a result. */
    LAB_RESULT_READY,
    /** A receptionist assigned a patient to a doctor. */
    PATIENT_ASSIGNED,
    /** Appointment is due. */
    APPOINTMENT_REMINDER,
    /** A prescription passed pharmacy verification. */
    PRESCRIPTION_READY,
    /** Generic system notification. */
    SYSTEM,

    // ------------------------------------------------------------------
    // Appointments
    //
    // Emitted from the appointment service after the record has been persisted,
    // so a rejected request never produces a notification claiming success.
    // ------------------------------------------------------------------

    /** An appointment was booked. */
    APPOINTMENT_CREATED,
    /** An appointment was moved to a different time. */
    APPOINTMENT_RESCHEDULED,
    /** An appointment was cancelled. */
    APPOINTMENT_CANCELLED,
    /**
     * An appointment moved between lifecycle states — confirmed, checked in,
     * completed, missed.
     */
    APPOINTMENT_STATUS_CHANGED,

    // ------------------------------------------------------------------
    // Prescriptions
    // ------------------------------------------------------------------

    /** A prescription order was written and is awaiting pharmacy review. */
    PRESCRIPTION_CREATED,
    /** A prescription moved state: verified, dispensed, cancelled, rejected. */
    PRESCRIPTION_STATUS_CHANGED;

    /** Whether this type concerns an appointment, used to route the client link. */
    public boolean isAppointment() {
        return this == APPOINTMENT_CREATED
                || this == APPOINTMENT_RESCHEDULED
                || this == APPOINTMENT_CANCELLED
                || this == APPOINTMENT_STATUS_CHANGED
                || this == APPOINTMENT_REMINDER;
    }

    /** Whether this type concerns a prescription. */
    public boolean isPrescription() {
        return this == PRESCRIPTION_READY
                || this == PRESCRIPTION_CREATED
                || this == PRESCRIPTION_STATUS_CHANGED;
    }
}