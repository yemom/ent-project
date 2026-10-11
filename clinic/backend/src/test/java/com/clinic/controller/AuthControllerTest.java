package com.clinic.controller;

import com.clinic.dto.response.AuthResponse;
import com.clinic.mapper.UserMapper;
import com.clinic.security.CurrentUser;
import com.clinic.service.AuthService;
import com.clinic.security.jwt.JwtTokenProvider;
import com.clinic.repository.TokenBlacklistRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static com.clinic.support.TestFixtures.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = AuthController.class,
        includeFilters = @org.springframework.context.annotation.ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = UserMapper.class))
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private TokenBlacklistRepository tokenBlacklistRepository;

    /** The controller derives the caller's identity from the security context. */
    @MockBean
    private CurrentUser currentUser;

    private final UserMapper userMapper = new UserMapper();

    @org.junit.jupiter.api.BeforeEach
    void stubCaller() {
        when(currentUser.userId()).thenReturn("user-1");
        when(currentUser.require()).thenReturn(
                new com.clinic.security.CustomUserPrincipal(patientEntity(java.util.UUID.randomUUID())));
    }

    @Test
    void registerReturnsCreated() throws Exception {
        AuthResponse response = authResponse("token-1");
        when(authService.register(any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest())))
            .andExpect(status().isCreated());

        verify(authService).register(any());
    }

    @Test
    void loginReturnsOk() throws Exception {
        when(authService.login(any())).thenReturn(authResponse("token-2"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest())))
                .andExpect(status().isOk());

        verify(authService).login(any());
    }

    @Test
    void logoutReturnsNoContent() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .header("Authorization", "Bearer token-3"))
                .andExpect(status().isNoContent());

        verify(authService).logout("Bearer token-3");
    }
}
