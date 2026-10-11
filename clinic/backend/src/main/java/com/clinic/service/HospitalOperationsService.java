package com.clinic.service;

import com.clinic.dto.request.AdmissionCreateRequest;
import com.clinic.dto.request.DepartmentUpsertRequest;
import com.clinic.dto.request.RoomUpsertRequest;
import com.clinic.dto.request.WardUpsertRequest;
import com.clinic.dto.response.DepartmentResponse;
import com.clinic.entity.Admission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Departments, wards, rooms and admissions.
 *
 * <p>Reads are open to any authenticated staff role because ward and bed
 * availability is needed at the front desk and on the wards board. Writes are
 * guarded by {@code department:manage} / {@code ward:manage} / {@code room:manage},
 * and admissions by {@code admission:write} (doctor only).
 */
public interface HospitalOperationsService {

    // Departments
    List<DepartmentResponse> listDepartments();

    DepartmentResponse createDepartment(DepartmentUpsertRequest request);

    DepartmentResponse updateDepartment(String id, DepartmentUpsertRequest request);

    void deleteDepartment(String id);

    // Wards
    Page<DepartmentResponse.WardResponse> listWards(String departmentId, Pageable pageable);

    DepartmentResponse.WardResponse createWard(WardUpsertRequest request);

    DepartmentResponse.WardResponse updateWard(String id, WardUpsertRequest request);

    void deleteWard(String id);

    // Rooms
    Page<DepartmentResponse.RoomResponse> listRooms(String wardId, Pageable pageable);

    DepartmentResponse.RoomResponse createRoom(RoomUpsertRequest request);

    DepartmentResponse.RoomResponse updateRoom(String id, RoomUpsertRequest request);

    void deleteRoom(String id);

    // Admissions
    Page<DepartmentResponse.AdmissionResponse> listAdmissions(Admission.Status status, Pageable pageable);

    DepartmentResponse.AdmissionResponse admit(AdmissionCreateRequest request);

    DepartmentResponse.AdmissionResponse discharge(String admissionId);

    List<DepartmentResponse.AdmissionResponse> openAdmissions();
}