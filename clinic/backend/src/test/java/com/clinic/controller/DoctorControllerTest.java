package com.clinic.controller;

import com.clinic.service.DoctorService;
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

@WebMvcTest(DoctorController.class)
@AutoConfigureMockMvc(addFilters = false)
class DoctorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DoctorService doctorService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private TokenBlacklistRepository tokenBlacklistRepository;

    @Test
    void createReturnsCreated() throws Exception {
        UUID id = UUID.randomUUID();
        when(doctorService.create(any())).thenReturn(doctorResponse(id));

        mockMvc.perform(post("/api/v1/doctors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(doctorCreateRequest())))
                .andExpect(status().isCreated());

        verify(doctorService).create(any());
    }

    @Test
    void getAllReturnsPage() throws Exception {
        UUID id = UUID.randomUUID();
        when(doctorService.getAll(any())).thenReturn(new PageImpl<>(List.of(doctorResponse(id)), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/v1/doctors"))
                .andExpect(status().isOk());

        verify(doctorService).getAll(any());
    }

    @Test
    void searchReturnsPage() throws Exception {
        UUID id = UUID.randomUUID();
        when(doctorService.search(eq("Dr"), eq("doctor@example.com"), eq("Cardiology"), eq(true), eq(false), any()))
                .thenReturn(new PageImpl<>(List.of(doctorResponse(id))));

        mockMvc.perform(get("/api/v1/doctors/search")
                        .param("fullName", "Dr")
                        .param("email", "doctor@example.com")
                        .param("specialization", "Cardiology")
                        .param("active", "true")
                        .param("available", "false"))
                .andExpect(status().isOk());

        verify(doctorService).search(eq("Dr"), eq("doctor@example.com"), eq("Cardiology"), eq(true), eq(false), any());
    }

    @Test
    void updateReturnsOk() throws Exception {
        String id = UUID.randomUUID().toString();
        when(doctorService.update(eq(id), any())).thenReturn(doctorResponse(UUID.fromString(id)));

        mockMvc.perform(put("/api/v1/doctors/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(doctorUpdateRequest())))
                .andExpect(status().isOk());

        verify(doctorService).update(eq(id), any());
    }

    @Test
    void deleteReturnsNoContent() throws Exception {
        String id = UUID.randomUUID().toString();

        mockMvc.perform(delete("/api/v1/doctors/{id}", id))
                .andExpect(status().isNoContent());

        verify(doctorService).delete(id);
    }
}
