package com.clinic.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@AutoConfigureMockMvc
class DebugLabOrdersTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "nahom@dev.com", roles = "DOCTOR")
    void debugGetLabOrders() throws Exception {
        try {
            MvcResult result = mockMvc.perform(get("/api/lab-orders")
                            .param("doctorId", "e96b4403-3f94-42db-b03b-783d725c156c")
                            .param("size", "50"))
                    .andReturn();
            System.out.println("=== TEST STATUS ===");
            System.out.println("STATUS: " + result.getResponse().getStatus());
            System.out.println("BODY: " + result.getResponse().getContentAsString());
            if (result.getResolvedException() != null) {
                System.out.println("=== EXCEPTION ===");
                result.getResolvedException().printStackTrace(System.out);
            }
        } catch (Exception e) {
            System.out.println("=== MOCKMVC THREW EXCEPTION ===");
            e.printStackTrace(System.out);
        }
    }
}
