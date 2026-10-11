package com.clinic.service.impl;

import com.clinic.dto.request.AdmissionCreateRequest;
import com.clinic.dto.request.DepartmentUpsertRequest;
import com.clinic.dto.request.RoomUpsertRequest;
import com.clinic.dto.request.WardUpsertRequest;
import com.clinic.dto.response.DepartmentResponse;
import com.clinic.entity.Admission;
import com.clinic.entity.Department;
import com.clinic.entity.Doctor;
import com.clinic.entity.Patient;
import com.clinic.entity.Room;
import com.clinic.entity.Ward;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.AdmissionRepository;
import com.clinic.repository.DepartmentRepository;
import com.clinic.repository.DoctorRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.RoomRepository;
import com.clinic.repository.WardRepository;
import com.clinic.service.AuditLogService;
import com.clinic.service.HospitalOperationsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Departments, wards, rooms and admissions.
 *
 * <p>Codes are normalised to upper case so "card" and "CARD" cannot both exist,
 * and deleting a department with wards is refused rather than silently cascading
 * away bed records.
 */
@Service
@Transactional
@Slf4j
public class HospitalOperationsServiceImpl implements HospitalOperationsService {

    private final DepartmentRepository departmentRepository;
    private final WardRepository wardRepository;
    private final RoomRepository roomRepository;
    private final AdmissionRepository admissionRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AuditLogService auditLogService;

    public HospitalOperationsServiceImpl(DepartmentRepository departmentRepository,
                                         WardRepository wardRepository,
                                         RoomRepository roomRepository,
                                         AdmissionRepository admissionRepository,
                                         PatientRepository patientRepository,
                                         DoctorRepository doctorRepository,
                                         AuditLogService auditLogService) {
        this.departmentRepository = departmentRepository;
        this.wardRepository = wardRepository;
        this.roomRepository = roomRepository;
        this.admissionRepository = admissionRepository;
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.auditLogService = auditLogService;
    }

    // ================= Departments =================

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentResponse> listDepartments() {
        return departmentRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(DepartmentResponse::from)
                .toList();
    }

    @Override
    public DepartmentResponse createDepartment(DepartmentUpsertRequest request) {
        String code = normaliseCode(request.code());
        if (departmentRepository.existsByCode(code)) {
            throw new BadRequestException("A department with code " + code + " already exists");
        }

        Department department = Department.builder()
                .name(request.name().trim())
                .code(code)
                .description(request.description())
                .headDoctorId(validateHeadDoctor(request.headDoctorId()))
                .active(request.active() == null || request.active())
                .build();

        Department saved = departmentRepository.save(department);
        log.info("Created department id={} code={}", saved.getId(), saved.getCode());
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_CREATED, "DEPARTMENT", saved.getId(),
                "Created department " + saved.getName());
        return DepartmentResponse.from(saved);
    }

    @Override
    public DepartmentResponse updateDepartment(String id, DepartmentUpsertRequest request) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found: " + id));

        String code = normaliseCode(request.code());
        if (departmentRepository.existsByCodeAndIdNot(code, id)) {
            throw new BadRequestException("A department with code " + code + " already exists");
        }

        department.setName(request.name().trim());
        department.setCode(code);
        department.setDescription(request.description());
        department.setHeadDoctorId(validateHeadDoctor(request.headDoctorId()));
        if (request.active() != null) {
            department.setActive(request.active());
        }

        Department saved = departmentRepository.save(department);
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_VIEWED, "DEPARTMENT", id,
                "Updated department " + saved.getName());
        return DepartmentResponse.from(saved);
    }

    @Override
    public void deleteDepartment(String id) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found: " + id));

        long wards = wardRepository.findByDepartmentId(id, Pageable.unpaged()).getTotalElements();
        if (wards > 0) {
            throw new BadRequestException("Cannot delete a department that still has " + wards + " ward(s)");
        }

        departmentRepository.delete(department);
        log.info("Deleted department id={}", id);
    }

    // ================= Wards =================

    @Override
    @Transactional(readOnly = true)
    public Page<DepartmentResponse.WardResponse> listWards(String departmentId, Pageable pageable) {
        Page<Ward> page = (departmentId == null || departmentId.isBlank())
                ? wardRepository.findAll(pageable)
                : wardRepository.findByDepartmentId(departmentId, pageable);
        return page.map(DepartmentResponse.WardResponse::from);
    }

    @Override
    public DepartmentResponse.WardResponse createWard(WardUpsertRequest request) {
        String code = normaliseCode(request.code());
        if (wardRepository.existsByCode(code)) {
            throw new BadRequestException("A ward with code " + code + " already exists");
        }

        Ward ward = Ward.builder()
                .department(getDepartment(request.departmentId()))
                .name(request.name().trim())
                .code(code)
                .floor(request.floor())
                .capacity(request.capacity() == null ? 1 : request.capacity())
                .active(request.active() == null || request.active())
                .build();

        Ward saved = wardRepository.save(ward);
        log.info("Created ward id={} code={}", saved.getId(), saved.getCode());
        return DepartmentResponse.WardResponse.from(saved);
    }

    @Override
    public DepartmentResponse.WardResponse updateWard(String id, WardUpsertRequest request) {
        Ward ward = wardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ward not found: " + id));

        String code = normaliseCode(request.code());
        if (!code.equals(ward.getCode()) && wardRepository.existsByCode(code)) {
            throw new BadRequestException("A ward with code " + code + " already exists");
        }

        if (request.departmentId() != null && !request.departmentId().isBlank()) {
            ward.setDepartment(getDepartment(request.departmentId()));
        }
        ward.setName(request.name().trim());
        ward.setCode(code);
        ward.setFloor(request.floor());
        if (request.capacity() != null) {
            ward.setCapacity(request.capacity());
        }
        if (request.active() != null) {
            ward.setActive(request.active());
        }

        return DepartmentResponse.WardResponse.from(wardRepository.save(ward));
    }

    @Override
    public void deleteWard(String id) {
        Ward ward = wardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ward not found: " + id));

        long rooms = roomRepository.findByWardId(id, Pageable.unpaged()).getTotalElements();
        if (rooms > 0) {
            throw new BadRequestException("Cannot delete a ward that still has " + rooms + " room(s)");
        }
        wardRepository.delete(ward);
        log.info("Deleted ward id={}", id);
    }

    // ================= Rooms =================

    @Override
    @Transactional(readOnly = true)
    public Page<DepartmentResponse.RoomResponse> listRooms(String wardId, Pageable pageable) {
        Page<Room> page = (wardId == null || wardId.isBlank())
                ? roomRepository.findAll(pageable)
                : roomRepository.findByWardId(wardId, pageable);
        return page.map(DepartmentResponse.RoomResponse::from);
    }

    @Override
    public DepartmentResponse.RoomResponse createRoom(RoomUpsertRequest request) {
        Room room = Room.builder()
                .ward(getWard(request.wardId()))
                .name(request.name().trim())
                .roomType(request.roomType() == null || request.roomType().isBlank()
                        ? "GENERAL" : request.roomType().trim())
                .capacity(request.capacity() == null ? 1 : request.capacity())
                .status(parseRoomStatus(request.status()))
                .build();

        Room saved = roomRepository.save(room);
        log.info("Created room id={} name={}", saved.getId(), saved.getName());
        return DepartmentResponse.RoomResponse.from(saved);
    }

    @Override
    public DepartmentResponse.RoomResponse updateRoom(String id, RoomUpsertRequest request) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + id));

        if (request.wardId() != null && !request.wardId().isBlank()) {
            room.setWard(getWard(request.wardId()));
        }
        room.setName(request.name().trim());
        if (request.roomType() != null && !request.roomType().isBlank()) {
            room.setRoomType(request.roomType().trim());
        }
        if (request.capacity() != null) {
            room.setCapacity(request.capacity());
        }
        if (request.status() != null && !request.status().isBlank()) {
            room.setStatus(parseRoomStatus(request.status()));
        }

        return DepartmentResponse.RoomResponse.from(roomRepository.save(room));
    }

    @Override
    public void deleteRoom(String id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + id));
        roomRepository.delete(room);
        log.info("Deleted room id={}", id);
    }

    // ================= Admissions =================

    @Override
    @Transactional(readOnly = true)
    public Page<DepartmentResponse.AdmissionResponse> listAdmissions(Admission.Status status,
                                                                     Pageable pageable) {
        Page<Admission> page = status != null
                ? admissionRepository.findByStatus(status, pageable)
                : admissionRepository.findAll(pageable);
        return page.map(DepartmentResponse.AdmissionResponse::from);
    }

    @Override
    public DepartmentResponse.AdmissionResponse admit(AdmissionCreateRequest request) {
        Patient patient = patientRepository.findById(request.patientId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + request.patientId()));

        // One open admission per patient keeps the beds board unambiguous.
        if (admissionRepository.findOpenAdmissions().stream()
                .anyMatch(existing -> existing.getPatient() != null
                        && existing.getPatient().getId().equals(patient.getId()))) {
            throw new BadRequestException("This patient already has an open admission");
        }

        Doctor doctor = resolveDoctor(request.doctorId());
        Ward ward = request.wardId() == null || request.wardId().isBlank()
                ? null : getWard(request.wardId());
        Room room = request.roomId() == null || request.roomId().isBlank()
                ? null : getRoom(request.roomId());

        if (room != null && ward != null && !room.getWard().getId().equals(ward.getId())) {
            throw new BadRequestException("The selected room does not belong to the selected ward");
        }

        Admission admission = Admission.builder()
                .patient(patient)
                .doctor(doctor)
                .ward(ward)
                .room(room)
                .status(Admission.Status.ADMITTED)
                .admittedAt(LocalDateTime.now())
                .diagnosis(request.diagnosis())
                .notes(request.notes())
                .build();

        // Occupying the room keeps room status and the beds board consistent.
        if (room != null) {
            room.setStatus(Room.Status.OCCUPIED);
            roomRepository.save(room);
        }

        Admission saved = admissionRepository.save(admission);
        log.info("Admitted patient {} to ward {}", patient.getId(), ward != null ? ward.getId() : "none");
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_CREATED, "ADMISSION", saved.getId(),
                "Admitted patient " + patient.getFullName());
        return DepartmentResponse.AdmissionResponse.from(saved);
    }

    @Override
    public DepartmentResponse.AdmissionResponse discharge(String admissionId) {
        Admission admission = admissionRepository.findById(admissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Admission not found: " + admissionId));

        if (!admission.isOpen()) {
            throw new BadRequestException("This admission is already closed");
        }

        admission.discharge();
        if (admission.getRoom() != null) {
            admission.getRoom().setStatus(Room.Status.AVAILABLE);
            roomRepository.save(admission.getRoom());
        }

        Admission saved = admissionRepository.save(admission);
        auditLogService.record(com.clinic.entity.AuditAction.RECORD_AMENDED, "ADMISSION", admissionId,
                "Discharged patient");
        return DepartmentResponse.AdmissionResponse.from(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentResponse.AdmissionResponse> openAdmissions() {
        return admissionRepository.findOpenAdmissions().stream()
                .map(DepartmentResponse.AdmissionResponse::from)
                .toList();
    }

    // ================= helpers =================

    private Department getDepartment(String id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found: " + id));
    }

    private Ward getWard(String id) {
        return wardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ward not found: " + id));
    }

    private Room getRoom(String id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + id));
    }

    /** A head-of-department must actually be a doctor row. */
    private String validateHeadDoctor(String headDoctorId) {
        if (headDoctorId == null || headDoctorId.isBlank()) {
            return null;
        }
        Doctor doctor = doctorRepository.findById(headDoctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + headDoctorId));
        return doctor.getId();
    }

    /**
     * A doctor may only admit under their own id, which stops a doctor from
     * creating an admission that claims another doctor is responsible.
     */
    private Doctor resolveDoctor(String doctorId) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof com.clinic.security.CustomUserPrincipal principal
                && principal.getUser().getRole() == com.clinic.entity.UserRole.DOCTOR) {
            return doctorRepository.findById(principal.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Doctor not found: " + principal.getUserId()));
        }
        if (doctorId == null || doctorId.isBlank()) {
            return null;
        }
        return doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found: " + doctorId));
    }

    private Room.Status parseRoomStatus(String value) {
        if (value == null || value.isBlank()) {
            return Room.Status.AVAILABLE;
        }
        try {
            return Room.Status.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("status must be one of AVAILABLE, OCCUPIED, MAINTENANCE");
        }
    }

    private String normaliseCode(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }
}