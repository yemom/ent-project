package com.clinic.controller;

import com.clinic.service.AppointmentService;
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

@WebMvcTest(AppointmentController.class)
@AutoConfigureMockMvc(addFilters = false)
class AppointmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AppointmentService appointmentService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private TokenBlacklistRepository tokenBlacklistRepository;

    @Test
    void createReturnsCreated() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(appointmentService.create(any())).thenReturn(appointmentResponse(id, patientId, doctorId));

        mockMvc.perform(post("/api/v1/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(appointmentCreateRequest(patientId, doctorId))))
                .andExpect(status().isCreated());

        verify(appointmentService).create(any());
    }

    @Test
    void getAllReturnsPage() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(appointmentService.getAll(any())).thenReturn(new PageImpl<>(List.of(appointmentResponse(id, patientId, doctorId)), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/v1/appointments"))
                .andExpect(status().isOk());

        verify(appointmentService).getAll(any());
    }

    @Test
    void searchReturnsPage() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(appointmentService.search(any(), any())).thenReturn(new PageImpl<>(List.of(appointmentResponse(id, patientId, doctorId))));

        mockMvc.perform(get("/api/v1/appointments/search")
                        .param("patientId", patientId.toString())
                        .param("doctorId", doctorId.toString())
                        .param("status", "SCHEDULED")
                        .param("keyword", "check"))
                .andExpect(status().isOk());

        verify(appointmentService).search(any(), any());
    }

    @Test
    void updateReturnsOk() throws Exception {
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        when(appointmentService.update(eq(id), any())).thenReturn(appointmentResponse(id, patientId, doctorId));

        mockMvc.perform(put("/api/v1/appointments/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(appointmentUpdateRequest(patientId, doctorId))))
                .andExpect(status().isOk());

        verify(appointmentService).update(eq(id), any());
    }

    @Test
    void deleteReturnsNoContent() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/appointments/{id}", id).param("reason", "Not needed"))
                .andExpect(status().isNoContent());

        verify(appointmentService).cancel(eq(id), eq("Not needed"));
    }
}
