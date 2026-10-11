package com.clinic.security;

import com.clinic.entity.AdminUser;
import com.clinic.entity.Doctor;
import com.clinic.entity.LaboratoryStaff;
import com.clinic.entity.Patient;
import com.clinic.entity.PatientAssignment;
import com.clinic.entity.Pharmacist;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.AdmissionRepository;
import com.clinic.repository.DepartmentRepository;
import com.clinic.repository.InvoiceLineRepository;
import com.clinic.repository.InvoiceRepository;
import com.clinic.repository.NurseObservationRepository;
import com.clinic.repository.PatientAssignmentRepository;
import com.clinic.repository.PatientRepository;
import com.clinic.repository.PaymentRepository;
import com.clinic.repository.ReceiptRepository;
import com.clinic.repository.RoomRepository;
import com.clinic.repository.UserRepository;
import com.clinic.repository.WardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves the permission matrix is enforced by the real security filter chain.
 *
 * <p>For each role this asserts 403 on the endpoints it must not reach, and that a
 * doctor cannot read a patient outside their assignment. Method security is
 * enabled in production configuration, so these are genuine 403s.
 *
 * <p>Authentication is injected per request with
 * {@link SecurityMockMvcRequestPostProcessors#authentication} rather than by
 * writing to the shared {@code SecurityContextHolder}: Spring Security 6 clears
 * the context at the start of every request, so a pre-set context would be lost.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:clinice_rbac;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "app.rate-limit.enabled=false"
})
@AutoConfigureMockMvc
class RbacAccessControlTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private PatientAssignmentRepository assignmentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceLineRepository invoiceLineRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ReceiptRepository receiptRepository;

    @Autowired
    private NurseObservationRepository observationRepository;

    @Autowired
    private AdmissionRepository admissionRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private WardRepository wardRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    private String superAdminId;
    private String doctorId;
    private String otherDoctorId;
    private String nurseId;
    private String receptionistId;
    private String labTechId;
    private String pharmacistId;
    private String cashierId;
    private String hospitalAdminId;
    private String patientId;
    private String otherPatientId;

    @BeforeEach
    void seed() {
        SecurityContextHolder.clearContext();
        // Children before parents, and batch deletes to avoid the per-entity delete
        // cascade from Patient.assignments (which fails on the non-null doctor_id).
        receiptRepository.deleteAllInBatch();
        paymentRepository.deleteAllInBatch();
        invoiceLineRepository.deleteAllInBatch();
        invoiceRepository.deleteAllInBatch();
        observationRepository.deleteAllInBatch();
        admissionRepository.deleteAllInBatch();
        roomRepository.deleteAllInBatch();
        wardRepository.deleteAllInBatch();
        departmentRepository.deleteAllInBatch();
        assignmentRepository.deleteAllInBatch();
        patientRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        superAdminId = save(AdminUser.builder().role(UserRole.SUPER_ADMIN).build());
        hospitalAdminId = save(AdminUser.builder().role(UserRole.HOSPITAL_ADMIN).build());
        doctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("Cardiology")
                .licenseNumber("LIC-" + System.nanoTime()).available(true).build());
        otherDoctorId = save(Doctor.builder().role(UserRole.DOCTOR).specialization("Neurology")
                .licenseNumber("LIC-" + System.nanoTime()).available(true).build());
        nurseId = save(AdminUser.builder().role(UserRole.NURSE).build());
        receptionistId = save(AdminUser.builder().role(UserRole.RECEPTIONIST).build());
        labTechId = save(LaboratoryStaff.builder().role(UserRole.LAB_TECHNICIAN).build());
        pharmacistId = save(Pharmacist.builder().role(UserRole.PHARMACIST)
                .employeeNumber("PH-" + System.nanoTime()).build());
        cashierId = save(AdminUser.builder().role(UserRole.CASHIER).build());
        patientId = savePatient("patient.one@example.com");
        otherPatientId = savePatient("patient.two@example.com");

        // Only `patientId` belongs to `doctorId` and `nurseId`. `otherPatientId`
        // is assigned to nobody, so it stands in for "someone else's patient".
        assignmentRepository.save(PatientAssignment.builder()
                .patient(patientRepository.findById(patientId).orElseThrow())
                .doctor((Doctor) userRepository.findById(doctorId).orElseThrow())
                .nurseId(nurseId)
                .assignedAt(java.time.LocalDateTime.now())
                .build());
    }

    /** Fills in shared account fields and persists the given user entity. */
    private String save(User user) {
        user.setEmail(user.getRole().name().toLowerCase() + "." + System.nanoTime() + "@example.com");
        user.setPassword(passwordEncoder.encode("Password123!"));
        user.setFullName("Test " + user.getRole());
        user.setActive(true);
        return userRepository.save(user).getId();
    }

    private String savePatient(String email) {
        Patient patient = Patient.builder()
                .email(email)
                .password(passwordEncoder.encode("Password123!"))
                .fullName("Patient " + email)
                .role(UserRole.PATIENT)
                .active(true)
                .build();
        return patientRepository.save(patient).getId();
    }

    /** Applies a real principal (with its ROLE_/PERM_ authorities) to one request. */
    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser(String userId) {
        User user = userRepository.findById(userId).orElseThrow();
        CustomUserPrincipal principal = new CustomUserPrincipal(user);
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    // ---------------- Super admin: no clinical data -----------------------

    @Test
    void superAdminIsDeniedClinicalData() throws Exception {
        assertForbidden(superAdminId, get("/api/v1/medical-records"));
    }

    /**
     * The patient directory is a separate grant from clinical demographics.
     *
     * <p>Super Admin can list registered patients but still cannot open a medical
     * record, which is the boundary that keeps platform administration from
     * accumulating access to patient data.
     */
    @Test
    void superAdminReadsThePatientDirectoryButNotRecords() throws Exception {
        mockMvc.perform(get("/api/v1/patients").with(asUser(superAdminId)))
                .andExpect(status().isOk());
        assertForbidden(superAdminId, get("/api/v1/medical-records"));
        // A directory read must not become a per-patient clinical read either.
        assertForbidden(superAdminId, get("/api/v1/patients/" + patientId));
    }

    @Test
    void superAdminCanReadAuditLogsAndPermissions() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs").with(asUser(superAdminId)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/permissions").with(asUser(superAdminId)))
                .andExpect(status().isOk());
    }

    // ---------------- Hospital admin: operations, no clinical -------------

    @Test
    void hospitalAdminIsDeniedClinicalData() throws Exception {
        assertForbidden(hospitalAdminId, get("/api/v1/medical-records"));
        assertForbidden(hospitalAdminId, labResultCreate());
    }

    // ---------------- Doctor: assigned patients only ----------------------

    @Test
    void doctorCanReadAssignedPatient() throws Exception {
        mockMvc.perform(get("/api/v1/patients/" + patientId).with(asUser(doctorId)))
                .andExpect(status().isOk());
    }

    @Test
    void doctorCannotReadUnassignedPatient() throws Exception {
        assertForbidden(doctorId, get("/api/v1/patients/" + otherPatientId));
    }

    @Test
    void doctorOwnPanelExcludesOtherDoctorsPatients() throws Exception {
        String body = mockMvc.perform(get("/api/v1/front-desk/patients").with(asUser(otherDoctorId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains(patientId), "doctor must not see a patient assigned to another doctor");
    }

    @Test
    void doctorIsDeniedAdminEndpoints() throws Exception {
        assertForbidden(doctorId, get("/api/v1/admin/users"));
        assertForbidden(doctorId, get("/api/v1/admin/audit-logs"));
    }

    // ---------------- Nurse: vitals, no prescribing -----------------------

    @Test
    void nurseCannotPrescribeOrDiagnose() throws Exception {
        assertForbidden(nurseId, medicalRecordCreate());
        assertForbidden(nurseId, prescriptionCreate());
        assertForbidden(nurseId, labOrderCreate());
    }

    @Test
    void nursePanelIsScopedToTheirAssignments() throws Exception {
        String body = mockMvc.perform(get("/api/v1/front-desk/patients").with(asUser(nurseId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertTrue(body.contains(patientId), "nurse must see the patient allocated to them");
        assertFalse(body.contains(otherPatientId), "nurse must not see an unassigned patient");
    }

    @Test
    void nurseCanRecordVitalsForAssignedPatientOnly() throws Exception {
        mockMvc.perform(withBody(post("/api/v1/nursing/observations"), String.format(
                        "{\"patientId\":\"%s\",\"kind\":\"VITALS\",\"heartRate\":72,"
                                + "\"bloodPressure\":\"120/80\"}", patientId))
                        .with(asUser(nurseId)))
                .andExpect(status().isCreated());

        // Unassigned patient: rejected as a bad request rather than a 403, because
        // the nurse is permitted to chart, just not for this patient.
        mockMvc.perform(withBody(post("/api/v1/nursing/observations"), String.format(
                        "{\"patientId\":\"%s\",\"kind\":\"VITALS\",\"heartRate\":72}", otherPatientId))
                        .with(asUser(nurseId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void nurseCannotAdmitPatients() throws Exception {
        assertForbidden(nurseId, admissionCreate());
    }

    @Test
    void doctorCannotRecordObservations() throws Exception {
        // A doctor holds diagnosis:write but not vital:write or
        // medication:administer, so the nursing chart is closed to them.
        assertForbidden(doctorId, vitalsCreate());
    }

    // ---------------- Receptionist: front desk only -----------------------

    @Test
    void receptionistSeesAvailableNurses() throws Exception {
        String body = mockMvc.perform(get("/api/v1/front-desk/nurses").with(asUser(receptionistId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertTrue(body.contains(nurseId), "front desk must be able to allocate the seeded nurse");
    }

    @Test
    void receptionistCannotAllocateANonNurse() throws Exception {
        // Naming a doctor as the nurse must be refused, otherwise any front-desk
        // account could expose a patient's chart to an unrelated user.
        mockMvc.perform(withBody(post("/api/v1/front-desk/patients/" + patientId + "/assign"), String.format(
                        "{\"doctorId\":\"%s\",\"nurseId\":\"%s\"}", doctorId, receptionistId))
                        .with(asUser(receptionistId)))
                .andExpect(status().isBadRequest());
    }

    // ---------------- Hospital operations: departments/wards/rooms ----------

    @Test
    void hospitalAdminManagesDepartmentsWardsAndRooms() throws Exception {
        String departmentId = extractId(mockMvc.perform(withBody(post("/api/v1/hospital/departments"),
                        "{\"name\":\"Cardiology\",\"code\":\"CARD-" + System.nanoTime() + "\"}")
                        .with(asUser(hospitalAdminId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        String wardId = extractId(mockMvc.perform(withBody(post("/api/v1/hospital/wards"), String.format(
                        "{\"departmentId\":\"%s\",\"name\":\"Ward A\",\"code\":\"WA-%d\","
                                + "\"capacity\":10}", departmentId, System.nanoTime()))
                        .with(asUser(hospitalAdminId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(withBody(post("/api/v1/hospital/rooms"), String.format(
                        "{\"wardId\":\"%s\",\"name\":\"Room 1\",\"capacity\":1}", wardId))
                        .with(asUser(hospitalAdminId)))
                .andExpect(status().isCreated());
    }

    @Test
    void superAdminCannotManageClinicalStructure() throws Exception {
        // SUPER_ADMIN holds platform administration only; ward/room/department
        // structure is HOSPITAL_ADMIN's remit.
        assertForbidden(superAdminId, departmentCreate());
    }

    @Test
    void doctorCannotManageWardsOrRooms() throws Exception {
        assertForbidden(doctorId, departmentCreate());
        assertForbidden(doctorId, roomCreate());
    }

    @Test
    void anyAuthenticatedRoleMayReadDepartments() throws Exception {
        // Bed availability is needed at the front desk and on the wards board, so
        // the read is deliberately open to every signed-in role.
        mockMvc.perform(get("/api/v1/hospital/departments").with(asUser(patientId)))
                .andExpect(status().isOk());
    }

    // ---------------- Cashier: billing only --------------------------------

    @Test
    void cashierHasNoClinicalAccess() throws Exception {
        assertForbidden(cashierId, medicalRecordCreate());
        assertForbidden(cashierId, labOrderCreate());
        assertForbidden(cashierId, get("/api/v1/admin/users"));
    }

    @Test
    void cashierReadsInvoicesAndCollectsPayment() throws Exception {
        String invoiceId = extractId(mockMvc.perform(withBody(post("/api/v1/billing/invoices"), String.format(
                        "{\"patientId\":\"%s\",\"lines\":[{\"description\":\"Consultation\","
                                + "\"quantity\":2,\"unitPrice\":50}]}", patientId))
                        .with(asUser(cashierId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/v1/billing/invoices").with(asUser(cashierId)))
                .andExpect(status().isOk());

        // A receipt is issued with the payment, in the same request.
        mockMvc.perform(withBody(post("/api/v1/billing/payments"), String.format(
                        "{\"invoiceId\":\"%s\",\"amount\":100,\"method\":\"CASH\"}", invoiceId))
                        .with(asUser(cashierId)))
                .andExpect(status().isCreated());
    }

    @Test
    void doctorHasNoBillingAccess() throws Exception {
        assertForbidden(doctorId, get("/api/v1/billing/invoices"));
        assertForbidden(doctorId, paymentCreate());
        assertForbidden(doctorId, get("/api/v1/billing/summary"));
    }

    @Test
    void patientReadsOwnInvoicesButNotTheRevenueSummary() throws Exception {
        mockMvc.perform(get("/api/v1/billing/invoices").with(asUser(patientId)))
                .andExpect(status().isOk());
        assertForbidden(patientId, get("/api/v1/billing/summary"));
    }

    /**
     * Another patient's invoice is reported as 404, not 403.
     *
     * <p>A 403 would confirm the id exists, letting a patient enumerate the billing
     * ledger one guess at a time. "Not found" is indistinguishable from a bad id.
     */
    @Test
    void patientCannotReachAnotherPatientsInvoice() throws Exception {
        String invoiceId = extractId(mockMvc.perform(withBody(post("/api/v1/billing/invoices"), String.format(
                        "{\"patientId\":\"%s\",\"lines\":[{\"description\":\"Consultation\","
                                + "\"quantity\":1,\"unitPrice\":10}]}", otherPatientId))
                        .with(asUser(cashierId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/v1/billing/invoices/" + invoiceId).with(asUser(patientId)))
                .andExpect(status().isNotFound());
    }

    // ---------------- Global search ----------------------------------------

    @Test
    void globalSearchIsAvailableToEverySignedInRole() throws Exception {
        mockMvc.perform(get("/api/v1/admin/search").param("q", "Patient").with(asUser(patientId)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/search").param("q", "Patient").with(asUser(superAdminId)))
                .andExpect(status().isOk());
    }

    @Test
    void superAdminCanProvisionPrivilegedRolesButOthersCannot() throws Exception {
        // A hospital with no HOSPITAL_ADMIN cannot be staffed, so the Super Admin
        // must be able to create one — but only a Super Admin may.
        long code = System.nanoTime();
        mockMvc.perform(withBody(post("/api/v1/admin/users"), String.format(
                        "{\"email\":\"admin.%d@example.com\",\"password\":\"Password123!\","
                                + "\"fullName\":\"New Hospital Admin\",\"role\":\"HOSPITAL_ADMIN\"}", code))
                        .with(asUser(superAdminId)))
                .andExpect(status().isCreated());

        // Everyone else is refused, so nobody can hand themselves admin rights.
        assertForbidden(hospitalAdminId, withBody(post("/api/v1/admin/users"), String.format(
                "{\"email\":\"sneaky.%d@example.com\",\"password\":\"Password123!\","
                        + "\"fullName\":\"Sneaky\",\"role\":\"SUPER_ADMIN\"}", code)));
        assertForbidden(receptionistId, withBody(post("/api/v1/admin/users"), String.format(
                "{\"email\":\"sneaky2.%d@example.com\",\"password\":\"Password123!\","
                        + "\"fullName\":\"Sneaky\",\"role\":\"HOSPITAL_ADMIN\"}", code)));
    }

    @Test
    void patientSearchNeverEnumeratesTheUserDirectory() throws Exception {
        String body = mockMvc.perform(get("/api/v1/admin/search")
                        .param("q", "Test ").with(asUser(patientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // The seeded staff accounts all have fullName "Test <ROLE>"; a patient must
        // not be able to discover them through search.
        assertFalse(body.contains(superAdminId), "patient search must not return the user directory");
        assertTrue(readJsonArray(body, "users").isEmpty(),
                "the users section must be empty for a patient");
        assertTrue(readJsonArray(body, "departments").isEmpty(),
                "the departments section must be empty for a patient");

        // The doctor directory is deliberately reachable: patients book appointments,
        // which requires choosing a provider. It carries name and specialisation only.
        assertFalse(readJsonArray(body, "doctors").isEmpty(),
                "a patient must be able to find a doctor to book with");
    }

    @Test
    void receptionistCanUseFrontDeskButNotClinicalEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/front-desk/doctors").with(asUser(receptionistId)))
                .andExpect(status().isOk());
        assertForbidden(receptionistId, medicalRecordCreate());
        assertForbidden(receptionistId, labOrderCreate());
        assertForbidden(receptionistId, get("/api/v1/admin/users"));
    }

    // ---------------- Lab tech / pharmacist -------------------------------

    @Test
    void labTechnicianCannotDiagnoseOrPrescribe() throws Exception {
        assertForbidden(labTechId, medicalRecordCreate());
        assertForbidden(labTechId, prescriptionCreate());
        assertForbidden(labTechId, labOrderCreate());
        mockMvc.perform(get("/api/lab-orders").with(asUser(labTechId)))
                .andExpect(status().isOk());
    }

    @Test
    void pharmacistCannotPrescribe() throws Exception {
        assertForbidden(pharmacistId, prescriptionCreate());
        assertForbidden(pharmacistId, medicalRecordCreate());
    }

    // ---------------- Patient: own data only -------------------------------

    @Test
    void patientCanReadOwnRecordButNotAnother() throws Exception {
        mockMvc.perform(get("/api/v1/patients/" + patientId).with(asUser(patientId)))
                .andExpect(status().isOk());
        assertForbidden(patientId, get("/api/v1/patients/" + otherPatientId));
        assertForbidden(patientId, get("/api/v1/patients"));
        assertForbidden(patientId, get("/api/v1/admin/users"));
        assertForbidden(patientId, medicalRecordCreate());
    }

    @Test
    void notificationsAreScopedToTheCaller() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/unread-count").with(asUser(patientId)))
                .andExpect(status().isOk());
        assertForbidden(patientId, get("/api/v1/admin/audit-logs"));
    }

    // ---------------- Unauthenticated --------------------------------------

    @Test
    void anonymousCannotReachProtectedEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/medical-records")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/api/v1/health")).andExpect(status().isOk());
    }

    // ---------------- helpers ---------------------------------------------

    private void assertForbidden(String userId, MockHttpServletRequestBuilder builder) throws Exception {
        mockMvc.perform(builder.with(asUser(userId))).andExpect(status().isForbidden());
    }

    /**
     * Reads the top-level {@code id} from a response body.
     *
     * <p>Parsed rather than pattern-matched on purpose: an invoice body also carries
     * {@code id} on each line item, and a greedy regex would silently hand back the
     * last nested id instead of the invoice's own — producing a test that fails for
     * the wrong reason.
     */
    private String extractId(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readTree(json)
                    .get("id")
                    .asText();
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Response body was not valid JSON: " + json, e);
        }
    }

    /** Reads a top-level array field, so an empty section is asserted as such. */
    private List<com.fasterxml.jackson.databind.JsonNode> readJsonArray(String json, String field) {
        try {
            com.fasterxml.jackson.databind.JsonNode node =
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(json).get(field);
            List<com.fasterxml.jackson.databind.JsonNode> values = new ArrayList<>();
            if (node != null && node.isArray()) {
                node.forEach(values::add);
            }
            return values;
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Response body was not valid JSON: " + json, e);
        }
    }

    /**
     * Bodies are fully valid so bean validation passes. Otherwise the request
     * fails with 400 before method security runs, and the test would pass for the
     * wrong reason.
     */
    private MockHttpServletRequestBuilder medicalRecordCreate() {
        return withBody(post("/api/v1/medical-records"), String.format(
                "{\"patientId\":\"%s\",\"recordDate\":\"%s\",\"diagnosis\":\"x\"}",
                patientId, java.time.LocalDate.now()));
    }

    private MockHttpServletRequestBuilder prescriptionCreate() {
        return withBody(post("/api/v1/prescription-orders"),
                "{\"doctorId\":\"d\",\"doctorName\":\"Dr\",\"patientName\":\"P\","
                        + "\"drugName\":\"Drug\",\"dosage\":\"1mg\"}");
    }

    private MockHttpServletRequestBuilder labOrderCreate() {
        return withBody(post("/api/lab-orders"),
                String.format("{\"patientId\":\"%s\",\"doctorId\":\"d\",\"tests\":[\"CBC\"],"
                        + "\"urgency\":\"ROUTINE\",\"clinicalNotes\":\"note\"}", patientId));
    }

    private MockHttpServletRequestBuilder labResultCreate() {
        return withBody(post("/api/lab-results"),
                "{\"labOrderId\":\"o\",\"labTechnicianId\":\"t\",\"findings\":\"ok\"}");
    }

    /** Fully valid so the 403 comes from method security, not bean validation. */
    private MockHttpServletRequestBuilder vitalsCreate() {
        return withBody(post("/api/v1/nursing/observations"), String.format(
                "{\"patientId\":\"%s\",\"kind\":\"VITALS\",\"heartRate\":72}", patientId));
    }

    private MockHttpServletRequestBuilder admissionCreate() {
        return withBody(post("/api/v1/hospital/admissions"), String.format(
                "{\"patientId\":\"%s\"}", patientId));
    }

    private MockHttpServletRequestBuilder departmentCreate() {
        return withBody(post("/api/v1/hospital/departments"), String.format(
                "{\"name\":\"Dept\",\"code\":\"D%d\"}", System.nanoTime()));
    }

    private MockHttpServletRequestBuilder roomCreate() {
        return withBody(post("/api/v1/hospital/rooms"),
                "{\"wardId\":\"w\",\"name\":\"Room 1\",\"capacity\":1}");
    }

    private MockHttpServletRequestBuilder paymentCreate() {
        return withBody(post("/api/v1/billing/payments"),
                "{\"invoiceId\":\"i\",\"amount\":10,\"method\":\"CASH\"}");
    }

    private MockHttpServletRequestBuilder withBody(MockHttpServletRequestBuilder builder, String json) {
        return builder.contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json);
    }
}