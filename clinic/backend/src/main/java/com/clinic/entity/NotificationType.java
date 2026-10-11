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
    SYSTEM
}