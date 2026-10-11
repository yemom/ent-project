package com.clinic.config;

public final class ApiPaths {

    public static final String API_V1 = "/api/v1";
    /** Public, DB-free liveness probe (no repository access). */
    public static final String HEALTH = API_V1 + "/health";
    public static final String AUTH = API_V1 + "/auth";
    public static final String PATIENTS = API_V1 + "/patients";
    public static final String DOCTORS = API_V1 + "/doctors";
    public static final String APPOINTMENTS = API_V1 + "/appointments";
    public static final String MEDICAL_RECORDS = API_V1 + "/medical-records";
    public static final String PRESCRIPTION_ORDERS = API_V1 + "/prescription-orders";
    public static final String NOTIFICATIONS = API_V1 + "/notifications";
    public static final String FRONT_DESK = API_V1 + "/front-desk";
    public static final String BILLING = API_V1 + "/billing";
    public static final String ROLE_REQUESTS = API_V1 + "/admin/role-requests";

    private ApiPaths() {
    }
}
