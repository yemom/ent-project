package com.clinic.controller;

import com.clinic.service.MedicalRecordService;
import com.clinic.security.jwt.JwtTokenProvider;
import com.clinic.repository.TokenBlacklistRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static com.clinic.support.TestFixtures.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MedicalRecordController.class)
@AutoConfigureMockMvc(addFilters = false)
class MedicalRecordControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MedicalRecordService medicalRecordService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private TokenBlacklistRepository tokenBlacklistRepository;

    @Test
    void createReturnsCreated() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(medicalRecordService.create(any())).thenReturn(medicalRecordResponse(id, patientId, doctorId, appointmentId));

        mockMvc.perform(post("/api/v1/medical-records")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(medicalRecordCreateRequest(patientId, doctorId, appointmentId))))
                .andExpect(status().isCreated());

        verify(medicalRecordService).create(any());
    }

    @Test
    void getAllReturnsPage() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(medicalRecordService.getAll(any())).thenReturn(new PageImpl<>(List.of(medicalRecordResponse(id, patientId, doctorId, appointmentId)), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/v1/medical-records"))
                .andExpect(status().isOk());

        verify(medicalRecordService).getAll(any());
    }

    @Test
    void searchReturnsPage() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(medicalRecordService.search(any(), any())).thenReturn(new PageImpl<>(List.of(medicalRecordResponse(id, patientId, doctorId, appointmentId))));

        mockMvc.perform(get("/api/v1/medical-records/search")
                        .param("patientId", patientId.toString())
                        .param("doctorId", doctorId.toString())
                        .param("appointmentId", appointmentId.toString())
                        .param("confidential", "true")
                        .param("keyword", "diag"))
                .andExpect(status().isOk());

        verify(medicalRecordService).search(any(), any());
    }

    @Test
    void updateReturnsOk() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(medicalRecordService.update(eq(id), any())).thenReturn(medicalRecordResponse(id, patientId, doctorId, appointmentId));

        mockMvc.perform(put("/api/v1/medical-records/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(medicalRecordUpdateRequest(patientId, doctorId, appointmentId))))
                .andExpect(status().isOk());

        verify(medicalRecordService).update(eq(id), any());
    }

    @Test
    void deleteReturnsNoContent() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/medical-records/{id}", id))
                .andExpect(status().isNoContent());

        verify(medicalRecordService).delete(id);
    }
}
