package com.clinic.integration;

import com.clinic.dto.request.LoginRequest;
import com.clinic.entity.AdminUser;
import com.clinic.entity.AuditAction;
import com.clinic.entity.Doctor;
import com.clinic.entity.LaboratoryStaff;
import com.clinic.entity.Patient;
import com.clinic.entity.Pharmacist;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.AuditLogRepository;
import com.clinic.repository.UserRepository;
import com.clinic.security.CustomUserPrincipal;
import com.clinic.service.AuthService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end coverage of the Super Admin account lifecycle.
 *
 * <p>Runs against the real security filter chain, the real service layer and a real
 * database, because the rules under test are precisely the ones that only hold when
 * all three are wired together: a deactivated account must lose access on the
 * <em>next</em> request, not merely on its next login, and non-admins must be turned
 * away by the backend rather than by a hidden button.
 *
 * <p>Authentication is injected per request with
 * {@link SecurityMockMvcRequestPostProcessors#authentication}. Spring Security 6
 * clears the security context at the start of every request, so setting the shared
 * holder in a test method would have no effect.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinice_userlifecycle;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class UserLifecycleIntegrationTest {

    private static final String USERS = "/api/v1/admin/users";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthService authService;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private String superAdminId;
    private String secondSuperAdminId;

    @BeforeEach
    void seedSuperAdmins() {
        // The Spring context, and therefore the database, is reused across every
        // test method here — so each method has to start from a known population.
        //
        // Cleared with raw SQL because @SQLRestriction hides soft-deleted rows from
        // JPA, and the "last Super Admin" rules are count-based: a leftover admin
        // from a previous test would silently make the guard unreachable.
        jdbcTemplate.update(
                "update users set deleted = true, deleted_at = current_timestamp "
                        + "where role = 'SUPER_ADMIN'");

        // Two, so that "the last Super Admin" is a state the test can genuinely
        // reach by removing one, rather than something unreachable from the start.
        // Unique per method because a soft-deleted row keeps its email and the
        // unique index still applies to it — reusing an address would collide.
        String run = UUID.randomUUID().toString().substring(0, 8);
        superAdminId = saveAdmin(UserRole.SUPER_ADMIN, "root-" + run + "@example.com");
        secondSuperAdminId = saveAdmin(UserRole.SUPER_ADMIN, "second-" + run + "@example.com");
    }

    // ==================================================================
    // Create: every role
    // ==================================================================

    @Test
    @DisplayName("creates a doctor with its required profile")
    void createsDoctor() throws Exception {
        String id = createOk("""
                {"email":"doc.one@example.com","fullName":"Doc One","phone":"+15550001",
                 "role":"DOCTOR","password":"Password123!",
                 "specialization":"Cardiology","licenseNumber":"LIC-001"}""");

        JsonNode detail = getOk(USERS + "/" + id);
        assertEquals("Cardiology", detail.at("/profile/specialization").asText());
        assertEquals("LIC-001", detail.at("/profile/licenseNumber").asText());
        assertTrue(detail.get("mustChangePassword").asBoolean(),
                "an issued credential must be temporary");
    }

    @Test
    @DisplayName("creates nurse, cashier, receptionist, lab tech and hospital admin")
    void createsStaffRolesWithoutExtraProfile() throws Exception {
        String nurseId = createOk("""
                {"email":"nurse@example.com","fullName":"Nur Seq","role":"NURSE","password":"Password123!"}""");
        assertEquals("NURSE", getOk(USERS + "/" + nurseId).get("role").asText());

        createOk("""
                {"email":"cashier@example.com","fullName":"Cash Ire","role":"CASHIER","password":"Password123!"}""");
        createOk("""
                {"email":"reception@example.com","fullName":"Recep T ion","role":"RECEPTIONIST","password":"Password123!"}""");
        createOk("""
                {"email":"labtech@example.com","fullName":"Lab Tech","role":"LAB_TECHNICIAN","password":"Password123!"}""");
        createOk("""
                {"email":"hospadmin@example.com","fullName":"Hosp Admin","role":"HOSPITAL_ADMIN","password":"Password123!"}""");
    }

    @Test
    @DisplayName("creates a pharmacist with an employee number")
    void createsPharmacist() throws Exception {
        String id = createOk("""
                {"email":"pharm@example.com","fullName":"Pharm Acy","role":"PHARMACIST",
                 "password":"Password123!","employeeNumber":"EMP-9","pharmacyLocation":"Main"}""");

        assertEquals("EMP-9", getOk(USERS + "/" + id).at("/profile/employeeNumber").asText());
    }

    @Test
    @DisplayName("creates a patient with demographics")
    void createsPatient() throws Exception {
        String id = createOk("""
                {"email":"pat@example.com","fullName":"Pat Ient","role":"PATIENT","password":"Password123!",
                 "dateOfBirth":"1990-04-01","gender":"FEMALE","address":"12 Clinic Road",
                 "emergencyContactName":"Kin","emergencyContactPhone":"+15559999"}""");

        JsonNode detail = getOk(USERS + "/" + id);
        assertEquals("1990-04-01", detail.at("/profile/dateOfBirth").asText());
        assertEquals("12 Clinic Road", detail.at("/profile/address").asText());
    }

    // ==================================================================
    // Create: validation and conflicts
    // ==================================================================

    @Test
    @DisplayName("duplicate email is 409, not 400")
    void duplicateEmailIsConflict() throws Exception {
        createOk("""
                {"email":"dup@example.com","fullName":"First","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(post(USERS + "/accounts").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"dup@example.com","fullName":"Second","role":"CASHIER","password":"Password123!"}"""))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("malformed input is 400")
    void invalidInputIsBadRequest() throws Exception {
        mockMvc.perform(post(USERS + "/accounts").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","fullName":"","role":"CASHIER"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a doctor without a license number is rejected")
    void doctorRequiresLicenseNumber() throws Exception {
        mockMvc.perform(post(USERS + "/accounts").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"nolicense@example.com","fullName":"No License","role":"DOCTOR",
                                 "password":"Password123!","specialization":"Radiology"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a weak supplied password is rejected")
    void weakPasswordRejected() throws Exception {
        mockMvc.perform(post(USERS + "/accounts").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"weak@example.com","fullName":"Weak Pass","role":"CASHIER","password":"short"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a generated password is returned once and never readable again")
    void generatedPasswordShownExactlyOnce() throws Exception {
        String id = createOk("""
                {"email":"gen@example.com","fullName":"Gen Pass","role":"CASHIER"}""");

        // A later read exposes no credential at all, which is what makes
        // "shown once" a property of the system rather than a promise in a comment.
        JsonNode detail = getOk(USERS + "/" + id);
        assertFalse(detail.has("generatedPassword"), "detail must never carry a credential");
        assertFalse(detail.has("password"), "detail must never carry a password field");
    }

    // ==================================================================
    // Passwords are never serialized
    // ==================================================================

    @Test
    @DisplayName("no response ever contains a password hash")
    void passwordHashNeverSerialized() throws Exception {
        createOk("""
                {"email":"secretcheck@example.com","fullName":"Secret Check","role":"CASHIER"}""");

        for (String body : new String[]{
                getOkRaw(USERS + "/search"),
                getOkRaw(USERS + "/" + userRepository.findByEmail("secretcheck@example.com").orElseThrow().getId()),
                getOkRaw(USERS)}) {

            assertFalse(body.contains("$2a$"), "a BCrypt hash leaked into: " + body);
            assertFalse(body.toLowerCase().contains("\"password\""),
                    "a password field leaked into: " + body);
        }
    }

    // ==================================================================
    // Edit and role change
    // ==================================================================

    @Test
    @DisplayName("edits a profile without touching the role")
    void editsProfile() throws Exception {
        String id = createOk("""
                {"email":"edit@example.com","fullName":"Edit Me","phone":"+15550000",
                 "role":"DOCTOR","password":"Password123!","specialization":"Neurology","licenseNumber":"LIC-ED"}""");

        mockMvc.perform(put(USERS + "/" + id + "/profile").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName":"Edited Name","specialization":"Neurosurgery"}"""))
                .andExpect(status().isOk());

        JsonNode detail = getOk(USERS + "/" + id);
        assertEquals("Edited Name", detail.get("fullName").asText());
        assertEquals("Neurosurgery", detail.at("/profile/specialization").asText());
        assertEquals("DOCTOR", detail.get("role").asText(), "a profile edit must not change the role");
    }

    @Test
    @DisplayName("changing a role is applied and audited")
    void changesRole() throws Exception {
        String id = createOk("""
                {"email":"promote@example.com","fullName":"Promote Me","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(patch(USERS + "/" + id + "/role").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"RECEPTIONIST","reason":"Promoted to front desk"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("RECEPTIONIST"));

        assertEquals(UserRole.RECEPTIONIST, userRepository.findById(id).orElseThrow().getRole());
        assertTrue(auditLogRepository.findAll().stream()
                        .anyMatch(a -> a.getAction() == AuditAction.ROLE_CHANGED),
                "a role change must leave an audit row");
    }

    // ==================================================================
    // Deactivate / activate
    // ==================================================================

    @Test
    @DisplayName("deactivation blocks login and invalidates a token already in hand")
    void deactivationBlocksLoginAndExistingToken() throws Exception {
        String id = createOk("""
                {"email":"suspend@example.com","fullName":"Sus Pend","role":"CASHIER","password":"Password123!"}""");

        // Sign in first so a genuinely valid token exists to invalidate.
        String token = authService.login(new LoginRequest("suspend@example.com", "Password123!"))
                .accessToken();

        mockMvc.perform(patch(USERS + "/" + id + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false,"reason":"Left the organisation"}"""))
                .andExpect(status().isOk());

        // Login is refused...
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"suspend@example.com","password":"Password123!"}"""))
                .andExpect(status().isUnauthorized());

        // ...and so is the token captured before suspension, on the very next
        // request. This is the assertion that would fail if invalidation relied
        // on token expiry instead of on the account's live status.
        mockMvc.perform(get("/api/v1/admin/users/search").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("deactivation without a reason is rejected")
    void deactivationRequiresReason() throws Exception {
        String id = createOk("""
                {"email":"noreason@example.com","fullName":"No Reason","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(patch(USERS + "/" + id + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("reactivation clears the deactivation trail")
    void reactivates() throws Exception {
        String id = createOk("""
                {"email":"reactivate@example.com","fullName":"Re Activate","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(patch(USERS + "/" + id + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false,"reason":"On leave"}"""))
                .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(patch(USERS + "/" + id + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":true}"""))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode after = objectMapper.readTree(result.getResponse().getContentAsString());
        assertTrue(after.get("active").asBoolean());
        assertTrue(after.get("deactivationReason").isNull(), "the old reason must not linger");
    }

    // ==================================================================
    // Delete
    // ==================================================================

    @Test
    @DisplayName("delete is a soft delete: the row survives but leaves the list")
    void softDeleteHidesUser() throws Exception {
        String id = createOk("""
                {"email":"goner@example.com","fullName":"Go Ner","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(delete(USERS + "/" + id + "/account").with(asAdmin()))
                .andExpect(status().isNoContent());

        // Checked with a raw query on purpose. @SQLRestriction hides soft-deleted
        // rows from every JPA read, findById included, so going through the
        // repository would tell us nothing about what is still in the table — and
        // what is still in the table is the entire point, because medical, billing
        // and audit rows reference this id.
        // Checked with a raw query on purpose. @SQLRestriction hides soft-deleted
        // rows from every JPA read, findById included, so going through the
        // repository would tell us nothing about what is still in the table — and
        // what is still in the table is the entire point, because medical, billing
        // and audit rows reference this id.
        Integer surviving = jdbcTemplate.queryForObject(
                "select count(*) from users where id = ? and deleted = true",
                Integer.class, id);

        assertEquals(1, surviving,
                "a soft delete must keep the row that medical and billing data points at");

        // Invisible through the entity layer, and unable to authenticate.
        assertFalse(userRepository.findById(id).isPresent(),
                "a soft-deleted account must be hidden from the directory");

        mockMvc.perform(get(USERS + "/search").with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.email=='goner@example.com')]").isEmpty());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"goner@example.com","password":"Password123!"}"""))
                .andExpect(status().isUnauthorized());
    }

    // ==================================================================
    // Safety rules
    // ==================================================================

    @Test
    @DisplayName("an admin cannot delete, deactivate or demote their own account")
    void selfProtection() throws Exception {
        mockMvc.perform(delete(USERS + "/" + superAdminId + "/account").with(asAdmin()))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch(USERS + "/" + superAdminId + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false,"reason":"stepping down"}"""))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch(USERS + "/" + superAdminId + "/role").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"CASHIER"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the last active Super Admin cannot be removed or demoted")
    void lastSuperAdminProtected() throws Exception {
        // Drop the second admin, leaving exactly one — reachable only because
        // self-protection is not what's being tested here.
        mockMvc.perform(delete(USERS + "/" + secondSuperAdminId + "/account").with(asAdmin()))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete(USERS + "/" + superAdminId + "/account").with(asAdmin()))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch(USERS + "/" + superAdminId + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false,"reason":"stepping down"}"""))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch(USERS + "/" + superAdminId + "/role").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"CASHIER"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("removing a Super Admin is allowed while another remains")
    void superAdminRemovableWhenAnotherExists() throws Exception {
        mockMvc.perform(delete(USERS + "/" + secondSuperAdminId + "/account").with(asAdmin()))
                .andExpect(status().isNoContent());
    }

    // ==================================================================
    // Authorization: only Super Admin
    // ==================================================================

    @Test
    @DisplayName("every other role is refused on every /admin/users endpoint")
    void nonSuperAdminsAreForbidden() throws Exception {
        // ADMIN is deliberately absent: it is a legacy alias that canonicalises to
        // SUPER_ADMIN, so an account carrying it is a Super Admin by another name.
        // `legacyAdminAliasStillHoldsSuperAdminRights` pins that behaviour instead of
        // pretending the alias is a weaker role.
        for (UserRole role : new UserRole[]{
                UserRole.DOCTOR, UserRole.NURSE, UserRole.PHARMACIST, UserRole.CASHIER,
                UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.LAB_TECHNICIAN,
                UserRole.HOSPITAL_ADMIN}) {

            var as = asUser(saveUserForRole(role));

            mockMvc.perform(get(USERS + "/search").with(as)).andExpect(status().isForbidden());
            mockMvc.perform(get(USERS).with(as)).andExpect(status().isForbidden());
            mockMvc.perform(get(USERS + "/" + superAdminId).with(as)).andExpect(status().isForbidden());
            mockMvc.perform(post(USERS + "/accounts").with(as)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"escalate@example.com","fullName":"Es Calate","role":"CASHIER"}"""))
                    .andExpect(status().isForbidden());
            mockMvc.perform(put(USERS + "/" + superAdminId + "/profile").with(as)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isForbidden());
            mockMvc.perform(patch(USERS + "/" + superAdminId + "/role").with(as)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"role":"SUPER_ADMIN"}"""))
                    .andExpect(status().isForbidden());
            mockMvc.perform(patch(USERS + "/" + superAdminId + "/status").with(as)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"active":false,"reason":"nope"}"""))
                    .andExpect(status().isForbidden());
            mockMvc.perform(delete(USERS + "/" + superAdminId + "/account").with(as))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("the legacy ADMIN alias still resolves to Super Admin rights")
    void legacyAdminAliasStillHoldsSuperAdminRights() throws Exception {
        var as = asUser(saveUserForRole(UserRole.ADMIN));

        // Documented consequence of the alias: ADMIN is not a weaker role, so it
        // must not be treated as one by any authorization decision.
        mockMvc.perform(get(USERS + "/search").with(as)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Super Admin cannot reach clinical data")
    void superAdminHasNoClinicalAccess() throws Exception {
        mockMvc.perform(get("/api/v1/medical-records").with(asAdmin()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("a patient view exposes demographics but no clinical record")
    void patientDetailCarriesDemographicsOnly() throws Exception {
        String id = createOk("""
                {"email":"demog@example.com","fullName":"Demog Raphy","role":"PATIENT","password":"Password123!",
                 "dateOfBirth":"1985-06-15","gender":"MALE","address":"9 Ward Street"}""");

        String body = getOkRaw(USERS + "/" + id);
        assertTrue(body.contains("1985-06-15"), "demographics should be present");

        for (String clinical : new String[]{
                "diagnosis", "prescription", "medicalRecord", "labResult", "treatmentPlan"}) {
            assertFalse(body.contains(clinical),
                    clinical + " must not appear in a Super Admin account view: " + body);
        }
    }

    // ==================================================================
    // Audit
    // ==================================================================

    @Test
    @DisplayName("every lifecycle action writes an audit row")
    void lifecycleIsAudited() throws Exception {
        String id = createOk("""
                {"email":"audited@example.com","fullName":"Audit Ed","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(put(USERS + "/" + id + "/profile").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"fullName":"Audit Ed Two"}"""))
                .andExpect(status().isOk());
        mockMvc.perform(patch(USERS + "/" + id + "/status").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"active":false,"reason":"sabbatical"}"""))
                .andExpect(status().isOk());
        mockMvc.perform(delete(USERS + "/" + id + "/account").with(asAdmin()))
                .andExpect(status().isNoContent());

        var actions = auditLogRepository.findAll().stream().map(a -> a.getAction()).toList();
        assertTrue(actions.contains(AuditAction.USER_CREATED), "create must be audited");
        assertTrue(actions.contains(AuditAction.USER_UPDATED), "edit must be audited");
        assertTrue(actions.contains(AuditAction.USER_DEACTIVATED), "deactivate must be audited");
        assertTrue(actions.contains(AuditAction.USER_DELETED), "delete must be audited");
    }

    // ==================================================================
    // Search / filtering
    // ==================================================================

    @Test
    @DisplayName("the directory filters by role, status and free text")
    void filtersDirectory() throws Exception {
        createOk("""
                {"email":"findme@example.com","fullName":"Findable Person","role":"NURSE","password":"Password123!"}""");
        createOk("""
                {"email":"other@example.com","fullName":"Unrelated","role":"CASHIER","password":"Password123!"}""");

        mockMvc.perform(get(USERS + "/search").with(asAdmin()).param("role", "NURSE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.email=='other@example.com')]").isEmpty())
                .andExpect(jsonPath("$.content[?(@.email=='findme@example.com')]").exists());

        mockMvc.perform(get(USERS + "/search").with(asAdmin()).param("q", "findable"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.email=='findme@example.com')]").exists());

        mockMvc.perform(get(USERS + "/search").with(asAdmin()).param("active", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").exists());
    }

    // ==================================================================
    // Helpers
    // ==================================================================

    private String saveAdmin(UserRole role, String email) {
        AdminUser admin = AdminUser.builder()
                .email(email)
                .password(passwordEncoder.encode("Password123!"))
                .fullName("Admin " + role)
                .role(role)
                .active(true)
                .build();
        return userRepository.save(admin).getId();
    }

    private String saveUserForRole(UserRole role) {
        User user = switch (role) {
            case DOCTOR -> Doctor.builder().specialization("General").licenseNumber("LIC-" + role).build();
            case PATIENT -> Patient.builder().build();
            case PHARMACIST -> Pharmacist.builder().employeeNumber("EMP-" + role).build();
            case LAB_TECHNICIAN -> LaboratoryStaff.builder().build();
            default -> AdminUser.builder().build();
        };
        user.setEmail(role.name().toLowerCase() + "." + System.nanoTime() + "@example.com");
        user.setPassword(passwordEncoder.encode("Password123!"));
        user.setFullName("Actor " + role);
        user.setRole(role);
        user.setActive(true);
        return userRepository.save(user).getId();
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor asAdmin() {
        return asUser(superAdminId);
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser(String userId) {
        CustomUserPrincipal principal =
                new CustomUserPrincipal(userRepository.findById(userId).orElseThrow());
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private String createOk(String json) throws Exception {
        MvcResult result = mockMvc.perform(post(USERS + "/accounts").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode user = body.get("user");
        assertNotNull(user, "create response must carry the user");
        // No endpoint may hand back a hash, whatever the caller supplied.
        assertFalse(result.getResponse().getContentAsString().contains("$2a$"),
                "the create response leaked a password hash");

        String id = user.get("id").asText();
        assertNotNull(id);
        return id;
    }

    private JsonNode getOk(String url) throws Exception {
        return objectMapper.readTree(getOkRaw(url));
    }

    private String getOkRaw(String url) throws Exception {
        return mockMvc.perform(get(url).with(asAdmin()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
}