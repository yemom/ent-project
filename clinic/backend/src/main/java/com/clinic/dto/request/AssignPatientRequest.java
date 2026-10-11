package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Front-desk assignment of a patient to a doctor, optionally to a nurse.
 *
 * <p>The receptionist picks the doctor and may name the nurse responsible for the
 * bed; the backend records the actor and notifies both. The nurse is optional so
 * a patient can be allocated to a doctor before nursing staff are assigned — the
 * doctor's panel must not depend on a nurse being present.
 */
public record AssignPatientRequest(
        @NotBlank(message = "Doctor is required")
        String doctorId,

        /**
         * Optional nurse responsible for this patient. Must be an active user whose
         * role is NURSE; anything else is rejected so the nursing panel cannot be
         * pointed at a non-nurse account.
         */
        String nurseId,

        /** Optional department used to validate the doctor's department fit. */
        String departmentId,

        @Size(max = 500, message = "Reason must not exceed 500 characters")
        String reason
) {
}