package com.clinic.service;

import com.clinic.entity.Appointment;
import com.clinic.entity.AppointmentStatus;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.entity.UserRole;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ConflictException;
import com.clinic.exception.ForbiddenException;
import com.clinic.mapper.AppointmentMapper;
import com.clinic.repository.AppointmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.impl.AppointmentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Booking rules: what the front desk is allowed to create, and what the server
 * refuses regardless of what the request claims.
 *
 * <p>Each test states a rule that reception would otherwise discover by getting a
 * 400 or a 409 at the counter, so the rule lives here rather than in production.
 */
@ExtendWith(MockitoExtension.class)
class AppointmentServiceImplTest {

    @Mock private AppointmentRepository appointmentRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private DoctorRepository doctorRepository;
    @Mock private CurrentUser currentUser;

    private AppointmentMapper appointmentMapper;
    private AppointmentServiceImpl appointmentService;

    private UUID patientId;
    private UUID doctorId;
    private String callerId;
    private Patient patient;
    private Doctor doctor;

    @BeforeEach
    void setUp() {
        appointmentMapper = new AppointmentMapper();
        appointmentService = new AppointmentServiceImpl(
                appointmentRepository, patientRepository, doctorRepository, appointmentMapper, currentUser);

        patientId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
        callerId = "front-desk-1";
        patient = patientEntity(patientId);
        doctor = doctorEntity(doctorId);

        lenient().when(currentUser.role()).thenReturn(UserRole.RECEPTIONIST);
        lenient().when(currentUser.userId()).thenReturn(callerId);
        // No existing bookings unless a test says otherwise.
        lenient().when(appointmentRepository.findBookableInWindow(
                anyString(), any(LocalDateTime.class), any(LocalDateTime.class), anyCollection()))
                .thenReturn(List.of());
        lenient().when(appointmentRepository.save(any(Appointment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    @Test
    void createPersistsAppointment() {
        stubPatientAndDoctor();

        var response = appointmentService.create(appointmentCreateRequest(patientId, doctorId));

        assertEquals("Checkup", response.reasonForVisit());
        assertEquals(patientId.toString(), response.patient().id());
        assertEquals("REG-1234", response.patient().registrationNumber());
        assertEquals("Cardiology", response.doctor().specialization());
        verify(appointmentRepository).save(any(Appointment.class));
    }

    @Test
    void createDefaultsToScheduledWhenNoStatusIsSupplied() {
        stubPatientAndDoctor();
        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                patientId.toString(), doctorId.toString(), LocalDateTime.now().plusDays(1), 30, null, "Checkup", null);

        assertEquals(AppointmentStatus.SCHEDULED, appointmentService.create(request).status());
    }

    @Test
    void createRejectsAnUnknownStatusWithAReadableMessage() {
        stubPatientAndDoctor();
        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                patientId.toString(), doctorId.toString(), LocalDateTime.now().plusDays(1), 30,
                "PENDING", "Checkup", null);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> appointmentService.create(request));

        assertTrue(ex.getMessage().contains("PENDING"), ex.getMessage());
        assertTrue(ex.getMessage().contains("SCHEDULED"), "the message should list the valid values");
    }

    @Test
    void createRejectsAnAppointmentInThePast() {
        stubPatientAndDoctor();
        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                patientId.toString(), doctorId.toString(), LocalDateTime.now().minusDays(1), 30,
                "SCHEDULED", "Checkup", null);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> appointmentService.create(request));

        assertTrue(ex.getMessage().toLowerCase().contains("past"), ex.getMessage());
        verify(appointmentRepository, org.mockito.Mockito.never()).save(any(Appointment.class));
    }

    @Test
    void createRejectsANonPositiveDuration() {
        stubPatientAndDoctor();
        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                patientId.toString(), doctorId.toString(), LocalDateTime.now().plusDays(1), 0,
                "SCHEDULED", "Checkup", null);

        assertThrows(BadRequestException.class, () -> appointmentService.create(request));
    }

    // ------------------------------------------------------------------
    // Double booking
    // ------------------------------------------------------------------

    @Test
    void createRejectsAnOverlappingBookingForTheSameDoctor() {
        stubPatientAndDoctor();
        LocalDateTime slot = LocalDateTime.now().plusDays(2).withSecond(0).withNano(0);
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor, slot);

        when(appointmentRepository.findBookableInWindow(
                eq(doctorId.toString()), any(LocalDateTime.class), any(LocalDateTime.class), anyCollection()))
                .thenReturn(List.of(existing));

        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                patientId.toString(), doctorId.toString(), slot.plusMinutes(15), 30, "SCHEDULED", "Checkup", null);

        ConflictException ex = assertThrows(ConflictException.class, () -> appointmentService.create(request));
        assertTrue(ex.getMessage().contains("already booked"), ex.getMessage());
    }

    @Test
    void createAllowsASlotThatBeginsExactlyWhenThePreviousOneEnds() {
        stubPatientAndDoctor();
        LocalDateTime slot = LocalDateTime.now().plusDays(2).withSecond(0).withNano(0);
        // 09:00-09:30 already taken; the new booking starts at 09:30.
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor, slot);

        when(appointmentRepository.findBookableInWindow(
                eq(doctorId.toString()), any(LocalDateTime.class), any(LocalDateTime.class), anyCollection()))
                .thenReturn(List.of(existing));

        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                patientId.toString(), doctorId.toString(), slot.plusMinutes(30), 30, "SCHEDULED", "Checkup", null);

        assertNotNull(appointmentService.create(request));
    }

    @Test
    void reschedulingIgnoresTheAppointmentsOwnCurrentSlot() {
        LocalDateTime slot = LocalDateTime.now().plusDays(3).withSecond(0).withNano(0);
        Appointment self = appointmentEntity(UUID.randomUUID(), patient, doctor, slot);
        when(appointmentRepository.findById(self.getId())).thenReturn(Optional.of(self));
        // The only candidate returned is the appointment being moved.
        when(appointmentRepository.findBookableInWindow(
                eq(doctorId.toString()), any(LocalDateTime.class), any(LocalDateTime.class), anyCollection()))
                .thenReturn(List.of(self));

        var update = new com.clinic.dto.request.AppointmentUpdateRequest(
                null, null, slot.plusMinutes(120), null, null, null, null, null, null, null, null, null);

        var response = appointmentService.update(self.getId(), update);

        assertEquals(slot.plusMinutes(120), response.appointmentDate());
    }

    @Test
    void reschedulingOntoAnotherDoctorsBookingIsRejected() {
        LocalDateTime slot = LocalDateTime.now().plusDays(3).withSecond(0).withNano(0);
        Doctor otherDoctor = doctorEntity(UUID.randomUUID());
        Appointment taken = appointmentEntity(UUID.randomUUID(), patient, otherDoctor, slot.plusMinutes(60));
        Appointment self = appointmentEntity(UUID.randomUUID(), patient, doctor, slot);
        when(appointmentRepository.findById(self.getId())).thenReturn(Optional.of(self));
        // The conflict check runs before the entity is resolved, so nothing else is fetched.
        when(appointmentRepository.findBookableInWindow(
                eq(otherDoctor.getId()), any(LocalDateTime.class), any(LocalDateTime.class), anyCollection()))
                .thenReturn(List.of(taken));

        var update = new com.clinic.dto.request.AppointmentUpdateRequest(
                null, otherDoctor.getId(), slot.plusMinutes(75), null, null, null, null, null, null, null, null, null);

        assertThrows(ConflictException.class, () -> appointmentService.update(self.getId(), update));
    }

    @Test
    void updateRefusesToSetTheStatusThroughTheRescheduleEndpoint() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var update = new com.clinic.dto.request.AppointmentUpdateRequest(
                null, null, null, null, AppointmentStatus.COMPLETED, null, null, null, null, null, null, null);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> appointmentService.update(existing.getId(), update));
        assertTrue(ex.getMessage().toLowerCase().contains("status"), ex.getMessage());
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    @Test
    void changeStatusConfirmsAScheduledAppointment() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var response = appointmentService.changeStatus(existing.getId(),
                new com.clinic.dto.request.AppointmentStatusRequest(AppointmentStatus.CONFIRMED, null));

        assertEquals(AppointmentStatus.CONFIRMED, response.status());
    }

    @Test
    void changeStatusRejectsSkippingStraightToCompleted() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> appointmentService.changeStatus(existing.getId(),
                        new com.clinic.dto.request.AppointmentStatusRequest(AppointmentStatus.COMPLETED, null)));

        assertTrue(ex.getMessage().contains("SCHEDULED"), ex.getMessage());
    }

    @Test
    void cancellingRecordsWhoCancelledAndWhy() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var response = appointmentService.changeStatus(existing.getId(),
                new com.clinic.dto.request.AppointmentStatusRequest(AppointmentStatus.CANCELLED, "Patient rescheduled"));

        assertEquals(AppointmentStatus.CANCELLED, response.status());
        assertEquals("Patient rescheduled", response.cancellationReason());
        assertEquals("RECEPTIONIST", response.cancelledBy());
        assertNotNull(response.cancellationDate());
    }

    @Test
    void undoingACancellationClearsTheCancellationRecord() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        existing.setStatus(AppointmentStatus.CANCELLED);
        existing.setCancellationReason("Mistake");
        existing.setCancelledBy("RECEPTIONIST");
        existing.setCancellationDate(LocalDateTime.now().minusHours(1));
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var response = appointmentService.changeStatus(existing.getId(),
                new com.clinic.dto.request.AppointmentStatusRequest(AppointmentStatus.SCHEDULED, null));

        assertEquals(AppointmentStatus.SCHEDULED, response.status());
        assertNull(response.cancellationReason());
        assertNull(response.cancelledBy());
        assertNull(response.cancellationDate());
    }

    @Test
    void aCompletedAppointmentIsTerminal() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        existing.setStatus(AppointmentStatus.COMPLETED);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        assertThrows(BadRequestException.class,
                () -> appointmentService.changeStatus(existing.getId(),
                        new com.clinic.dto.request.AppointmentStatusRequest(AppointmentStatus.CANCELLED, null)));
    }

    @Test
    void cancellingTwiceKeepsTheOriginalReason() {
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        existing.setStatus(AppointmentStatus.CANCELLED);
        existing.setCancellationReason("Original reason");
        existing.setCancellationDate(LocalDateTime.now().minusDays(1));
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var response = appointmentService.cancel(existing.getId(), "Second attempt");

        assertEquals("Original reason", response.cancellationReason());
    }

    // ------------------------------------------------------------------
    // Record-level authorisation
    // ------------------------------------------------------------------

    @Test
    void aPatientCannotBookForSomeoneElse() {
        lenient().when(currentUser.role()).thenReturn(UserRole.PATIENT);
        lenient().when(currentUser.userId()).thenReturn(patientId.toString());

        var request = new com.clinic.dto.request.AppointmentCreateRequest(
                UUID.randomUUID().toString(), doctorId.toString(), LocalDateTime.now().plusDays(1), 30,
                "SCHEDULED", "Checkup", null);

        assertThrows(ForbiddenException.class, () -> appointmentService.create(request));
    }

    @Test
    void aPatientCannotOpenAnotherPatientsAppointment() {
        lenient().when(currentUser.role()).thenReturn(UserRole.PATIENT);
        lenient().when(currentUser.userId()).thenReturn("someone-else");
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        assertThrows(ForbiddenException.class, () -> appointmentService.getById(existing.getId()));
    }

    @Test
    void aDoctorCannotOpenAnotherDoctorsAppointment() {
        lenient().when(currentUser.role()).thenReturn(UserRole.DOCTOR);
        lenient().when(currentUser.userId()).thenReturn(UUID.randomUUID().toString());
        Appointment existing = appointmentEntity(UUID.randomUUID(), patient, doctor);
        when(appointmentRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        assertThrows(ForbiddenException.class, () -> appointmentService.getById(existing.getId()));
    }

    @Test
    void findByIdReturnsAppointment() {
        String id = UUID.randomUUID().toString();
        when(appointmentRepository.findById(id)).thenReturn(Optional.of(
                appointmentEntity(UUID.fromString(id), patientEntity(UUID.randomUUID()), doctorEntity(UUID.randomUUID()))));

        var response = appointmentService.getById(id);

        assertNotNull(response);
    }

    private void stubPatientAndDoctor() {
        when(patientRepository.findById(patientId.toString())).thenReturn(Optional.of(patient));
        when(doctorRepository.findById(doctorId.toString())).thenReturn(Optional.of(doctor));
    }
}