package com.clinic.controller;

import com.clinic.service.PatientService;
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

@WebMvcTest(PatientController.class)
@AutoConfigureMockMvc(addFilters = false)
class PatientControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PatientService patientService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private TokenBlacklistRepository tokenBlacklistRepository;

    @Test
    void createReturnsCreated() throws Exception {
        UUID id = UUID.randomUUID();
        when(patientService.create(any())).thenReturn(patientResponse(id));

        mockMvc.perform(post("/api/v1/patients")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patientCreateRequest())))
                .andExpect(status().isCreated());

        verify(patientService).create(any());
    }

    @Test
    void getAllReturnsPage() throws Exception {
        UUID id = UUID.randomUUID();
        when(patientService.getAll(any())).thenReturn(new PageImpl<>(List.of(patientResponse(id)), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/v1/patients"))
                .andExpect(status().isOk());

        verify(patientService).getAll(any());
    }

    @Test
    void searchReturnsPage() throws Exception {
        UUID id = UUID.randomUUID();
        when(patientService.search(eq("John"), eq("patient@example.com"), eq("+15550001"), eq(true), any()))
                .thenReturn(new PageImpl<>(List.of(patientResponse(id))));

        mockMvc.perform(get("/api/v1/patients/search")
                        .param("fullName", "John")
                        .param("email", "patient@example.com")
                        .param("phone", "+15550001")
                        .param("active", "true"))
                .andExpect(status().isOk());

        verify(patientService).search(eq("John"), eq("patient@example.com"), eq("+15550001"), eq(true), any());
    }

    @Test
    void updateReturnsOk() throws Exception {
        UUID id = UUID.randomUUID();
        when(patientService.update(eq(id), any())).thenReturn(patientResponse(id));

        mockMvc.perform(put("/api/v1/patients/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patientUpdateRequest())))
                .andExpect(status().isOk());

        verify(patientService).update(eq(id), any());
    }

    @Test
    void deleteReturnsNoContent() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/patients/{id}", id))
                .andExpect(status().isNoContent());

        verify(patientService).delete(id);
    }
}
