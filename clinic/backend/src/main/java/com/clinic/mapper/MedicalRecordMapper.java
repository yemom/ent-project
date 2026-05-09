package com.clinic.mapper;

import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.entity.Appointment;
import com.clinic.entity.Doctor;
import com.clinic.entity.MedicalRecord;
import com.clinic.entity.Patient;
import org.springframework.stereotype.Component;

@Component
public class MedicalRecordMapper {

    private final AppointmentMapper appointmentMapper;
    private final UserMapper userMapper;

    public MedicalRecordMapper(AppointmentMapper appointmentMapper, UserMapper userMapper) {
        this.appointmentMapper = appointmentMapper;
        this.userMapper = userMapper;
    }

    public MedicalRecord toEntity(MedicalRecordCreateRequest request, Patient patient, Doctor doctor, Appointment appointment) {
        if (request == null) {
            return null;
        }

        return MedicalRecord.builder()
                .patient(patient)
                .doctor(doctor)
                .appointment(appointment)
                .diagnosis(request.diagnosis())
                .treatment(request.treatment())
                .prescription(request.prescription())
                .testResults(request.testResults())
                .vitalSigns(request.vitalSigns())
                .followUpRequired(request.followUpRequired() != null ? request.followUpRequired() : Boolean.FALSE)
                .followUpDate(request.followUpDate())
                .notes(request.notes())
                .recordDate(request.recordDate())
                .medicalRecordType(request.medicalRecordType())
                .isConfidential(request.confidential() != null ? request.confidential() : Boolean.FALSE)
                .build();
    }

    public void updateEntity(MedicalRecord record, MedicalRecordUpdateRequest request, Patient patient, Doctor doctor, Appointment appointment) {
        if (record == null || request == null) {
            return;
        }

        if (patient != null) {
            record.setPatient(patient);
        }
        if (doctor != null) {
            record.setDoctor(doctor);
        }
        if (appointment != null) {
            record.setAppointment(appointment);
        }
        if (request.diagnosis() != null) {
            record.setDiagnosis(request.diagnosis());
        }
        if (request.treatment() != null) {
            record.setTreatment(request.treatment());
        }
        if (request.prescription() != null) {
            record.setPrescription(request.prescription());
        }
        if (request.testResults() != null) {
            record.setTestResults(request.testResults());
        }
        if (request.vitalSigns() != null) {
            record.setVitalSigns(request.vitalSigns());
        }
        if (request.followUpRequired() != null) {
            record.setFollowUpRequired(request.followUpRequired());
        }
        if (request.followUpDate() != null) {
            record.setFollowUpDate(request.followUpDate());
        }
        if (request.notes() != null) {
            record.setNotes(request.notes());
        }
        if (request.recordDate() != null) {
            record.setRecordDate(request.recordDate());
        }
        if (request.medicalRecordType() != null) {
            record.setMedicalRecordType(request.medicalRecordType());
        }
        if (request.confidential() != null) {
            record.setIsConfidential(request.confidential());
        }
    }

    public MedicalRecordResponse toResponse(MedicalRecord record) {
        if (record == null) {
            return null;
        }

        return new MedicalRecordResponse(
                record.getId(),
                userMapper.toSummaryResponse(record.getPatient()),
                userMapper.toSummaryResponse(record.getDoctor()),
                appointmentMapper.toSummaryResponse(record.getAppointment()),
                record.getDiagnosis(),
                record.getTreatment(),
                record.getPrescription(),
                record.getTestResults(),
                record.getVitalSigns(),
                record.getFollowUpRequired(),
                record.getFollowUpDate(),
                record.getNotes(),
                record.getRecordDate(),
                record.getMedicalRecordType(),
                record.getIsConfidential(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }
}
