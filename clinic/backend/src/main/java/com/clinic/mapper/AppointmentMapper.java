package com.clinic.mapper;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import com.clinic.dto.response.AppointmentSummaryResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import org.springframework.stereotype.Component;

@Component
public class AppointmentMapper {

    private final UserMapper userMapper;

    public AppointmentMapper(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public Appointment toEntity(AppointmentCreateRequest request, Patient patient, Doctor doctor) {
        if (request == null) {
            return null;
        }

        return Appointment.builder()
                .patient(patient)
                .doctor(doctor)
                .appointmentDate(request.appointmentDate())
                .duration(request.duration())
                .status(AppointmentStatus.SCHEDULED)
                .reasonForVisit(request.reasonForVisit())
                .notes(request.notes())
                .reminderSent(false)
                .build();
    }

    public void updateEntity(Appointment appointment, AppointmentUpdateRequest request, Patient patient, Doctor doctor) {
        if (appointment == null || request == null) {
            return;
        }

        if (patient != null) {
            appointment.setPatient(patient);
        }
        if (doctor != null) {
            appointment.setDoctor(doctor);
        }
        if (request.appointmentDate() != null) {
            appointment.setAppointmentDate(request.appointmentDate());
        }
        if (request.duration() != null) {
            appointment.setDuration(request.duration());
        }
        if (request.status() != null) {
            appointment.setStatus(request.status());
        }
        if (request.reasonForVisit() != null) {
            appointment.setReasonForVisit(request.reasonForVisit());
        }
        if (request.notes() != null) {
            appointment.setNotes(request.notes());
        }
        if (request.reminderSent() != null) {
            appointment.setReminderSent(request.reminderSent());
        }
        if (request.reminderSentAt() != null) {
            appointment.setReminderSentAt(request.reminderSentAt());
        }
        if (request.cancelledBy() != null) {
            appointment.setCancelledBy(request.cancelledBy());
        }
        if (request.cancellationReason() != null) {
            appointment.setCancellationReason(request.cancellationReason());
        }
        if (request.cancellationDate() != null) {
            appointment.setCancellationDate(request.cancellationDate());
        }
    }

    public AppointmentSummaryResponse toSummaryResponse(Appointment appointment) {
        if (appointment == null) {
            return null;
        }

        return new AppointmentSummaryResponse(
                appointment.getId(),
                appointment.getAppointmentDate(),
                appointment.getDuration(),
                appointment.getStatus(),
                appointment.getReasonForVisit()
        );
    }

    public AppointmentResponse toResponse(Appointment appointment) {
        if (appointment == null) {
            return null;
        }

        return new AppointmentResponse(
                appointment.getId(),
                userMapper.toSummaryResponse(appointment.getPatient()),
                userMapper.toSummaryResponse(appointment.getDoctor()),
                appointment.getAppointmentDate(),
                appointment.getDuration(),
                appointment.getStatus(),
                appointment.getReasonForVisit(),
                appointment.getNotes(),
                appointment.getReminderSent(),
                appointment.getReminderSentAt(),
                appointment.getCancelledBy(),
                appointment.getCancellationReason(),
                appointment.getCancellationDate(),
                appointment.getCreatedAt(),
                appointment.getUpdatedAt()
        );
    }
}
