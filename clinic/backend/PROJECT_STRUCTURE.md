# clinic Project Structure & pom.xml Documentation

##  Complete Project Tree

```
clinic/
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/clinic/
│   │   │       ├── config/                    # Spring configuration classes
│   │   │       │   └── (SecurityConfig, JpaAuditingConfig, etc.)
│   │   │       │
│   │   │       ├── controller/                # REST API Controllers
│   │   │       │   ├── AuthController.java
│   │   │       │   ├── PatientController.java
│   │   │       │   ├── DoctorController.java
│   │   │       │   ├── AppointmentController.java
│   │   │       │   └── MedicalRecordController.java
│   │   │       │
│   │   │       ├── service/                   # Business Logic Services
│   │   │       │   ├── AuthService.java
│   │   │       │   ├── UserService.java
│   │   │       │   ├── PatientService.java
│   │   │       │   ├── DoctorService.java
│   │   │       │   ├── AppointmentService.java
│   │   │       │   └── MedicalRecordService.java
│   │   │       │
│   │   │       ├── repository/                # Data Access Layer
│   │   │       │   ├── UserRepository.java
│   │   │       │   ├── PatientRepository.java
│   │   │       │   ├── DoctorRepository.java
│   │   │       │   ├── AppointmentRepository.java
│   │   │       │   └── MedicalRecordRepository.java
│   │   │       │
│   │   │       ├── entity/                    # JPA Entities
│   │   │       │   ├── User.java              (Abstract base)
│   │   │       │   ├── Patient.java
│   │   │       │   ├── Doctor.java
│   │   │       │   ├── Appointment.java
│   │   │       │   └── MedicalRecord.java
│   │   │       │
│   │   │       ├── dto/
│   │   │       │   ├── request/               # Request DTOs
│   │   │       │   │   ├── LoginRequest.java
│   │   │       │   │   ├── RegisterRequest.java
│   │   │       │   │   ├── PatientCreateRequest.java
│   │   │       │   │   ├── AppointmentRequest.java
│   │   │       │   │   └── MedicalRecordRequest.java
│   │   │       │   │
│   │   │       │   └── response/              # Response DTOs
│   │   │       │       ├── UserResponse.java
│   │   │       │       ├── PatientResponse.java
│   │   │       │       ├── DoctorResponse.java
│   │   │       │       ├── AppointmentResponse.java
│   │   │       │       ├── MedicalRecordResponse.java
│   │   │       │       └── AuthResponse.java
│   │   │       │
│   │   │       ├── mapper/                    # DTO Mappers
│   │   │       │   ├── UserMapper.java
│   │   │       │   ├── PatientMapper.java
│   │   │       │   ├── DoctorMapper.java
│   │   │       │   ├── AppointmentMapper.java
│   │   │       │   └── MedicalRecordMapper.java
│   │   │       │
│   │   │       ├── security/
│   │   │       │   ├── jwt/
│   │   │       │   │   ├── JwtTokenProvider.java
│   │   │       │   │   ├── JwtAuthenticationFilter.java
│   │   │       │   │   └── JwtProperties.java
│   │   │       │   │
│   │   │       │   ├── CustomUserDetailsService.java
│   │   │       │   └── SecurityContextUser.java
│   │   │       │
│   │   │       ├── exception/                 # Custom Exceptions & Handler
│   │   │       │   ├── GlobalExceptionHandler.java
│   │   │       │   ├── ResourceNotFoundException.java
│   │   │       │   ├── BadCredentialsException.java
│   │   │       │   ├── TokenExpiredException.java
│   │   │       │   └── ValidationException.java
│   │   │       │
│   │   │       ├── validation/                # Custom Validators
│   │   │       │   ├── UniqueEmail.java
│   │   │       │   ├── UniquePhone.java
│   │   │       │   └── DateInFuture.java
│   │   │       │
│   │   │       └── clinicApplication.java   # Spring Boot entry point
│   │   │
│   │   └── resources/
│   │       ├── application.yml                # Default/Base configuration
│   │       ├── application-dev.yml            # Development profile
│   │       ├── application-prod.yml           # Production profile
│   │       ├── application-test.yml           # Test profile
│   │       │
│   │       └── db/migration/                  # Flyway migrations
│   │           ├── V1__init.sql               # Schema initialization
│   │           ├── V2__users.sql              # User table
│   │           ├── V3__patients.sql           # Patient table
│   │           ├── V4__doctors.sql            # Doctor table
│   │           ├── V5__appointments.sql       # Appointment table
│   │           └── V6__medical_records.sql    # Medical records table
│   │
│   └── test/
│       ├── java/
│       │   └── com/clinice/
│       │       ├── controller/                # Controller tests (@WebMvcTest)
│       │       │   ├── AuthControllerTest.java
│       │       │   ├── PatientControllerTest.java
│       │       │   ├── AppointmentControllerTest.java
│       │       │   └── ...
│       │       │
│       │       ├── service/                   # Service tests (@Test with mocks)
│       │       │   ├── AuthServiceTest.java
│       │       │   ├── PatientServiceTest.java
│       │       │   ├── AppointmentServiceTest.java
│       │       │   └── ...
│       │       │
│       │       └── repository/                # Repository tests (@DataJpaTest)
│       │           ├── UserRepositoryTest.java
│       │           ├── PatientRepositoryTest.java
│       │           ├── AppointmentRepositoryTest.java
│       │           └── ...
│       │
│       └── resources/
│           └── application-test.yml           # Test configuration (H2, etc.)
│
├── pom.xml                                   # Maven configuration
├── Dockerfile                                # Multi-stage Docker build
├── docker-compose.yml                        # Docker Compose orchestration
├── .gitignore                                # Git ignore patterns
└── README.md                                 # Project documentation
```

---

##  pom.xml Summary

### Parent & Properties

- **Parent**: Spring Boot Starter Parent 3.3.0
- **Java Version**: 21 (source & target)
- **Project**: clinic 1.0.0 (JAR packaging)
- **Encoding**: UTF-8

### Key Dependencies

#### Spring Boot Starters

| Dependency                       | Purpose                        |
| -------------------------------- | ------------------------------ |
| `spring-boot-starter-web`        | REST APIs, embedded Tomcat     |
| `spring-boot-starter-data-jpa`   | JPA/Hibernate support          |
| `spring-boot-starter-security`   | Authentication & authorization |
| `spring-boot-starter-validation` | Bean validation                |
| `spring-boot-starter-actuator`   | Application monitoring         |

#### Database & Migrations

| Dependency                   | Purpose                   |
| ---------------------------- | ------------------------- |
| `postgresql`                 | PostgreSQL JDBC driver    |
| `h2database`                 | In-memory DB for tests    |
| `flyway-core`                | Database versioning       |
| `flyway-database-postgresql` | Flyway PostgreSQL support |

#### Security & Authentication

| Dependency                     | Purpose                       |
| ------------------------------ | ----------------------------- |
| `spring-boot-starter-security` | Spring Security framework     |
| `jjwt-api`                     | JWT token creation/validation |
| `jjwt-impl`                    | JWT implementation            |
| `jjwt-jackson`                 | JWT Jackson integration       |

#### Utilities & Documentation

| Dependency                            | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `lombok`                              | Reduce boilerplate (getters, setters, constructors) |
| `springdoc-openapi-starter-webmvc-ui` | Swagger UI + OpenAPI docs                           |

#### Testing

| Dependency                  | Purpose                        |
| --------------------------- | ------------------------------ |
| `spring-boot-starter-test`  | JUnit 5, AssertJ, Mockito      |
| `spring-security-test`      | Security test support          |
| `junit-jupiter-*`           | JUnit 5 core modules           |
| `mockito-*`                 | Mocking framework              |
| `testcontainers`            | Docker-based integration tests |
| `testcontainers-postgresql` | PostgreSQL Testcontainer       |

### Maven Plugins

| Plugin                     | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `spring-boot-maven-plugin` | Package as executable JAR with layered Docker support   |
| `maven-surefire-plugin`    | Run unit tests (*Test.java, *Tests.java)                |
| `maven-failsafe-plugin`    | Run integration tests (*IT.java, *IntegrationTest.java) |
| `maven-compiler-plugin`    | Compile with Java 21 + Lombok annotation processing     |
| `jacoco-maven-plugin`      | Code coverage (70% minimum)                             |

---

##  Architectural Layers

### 1. **Controller Layer** (`com.clinice.controller`)

- REST endpoints
- Request validation
- Response DTOs
- HTTP status codes
- @RestController, @RequestMapping

### 2. **Service Layer** (`com.clinice.service`)

- Business logic
- Transaction management
- Service-to-service communication
- @Service, @Transactional

### 3. **Repository Layer** (`com.clinice.repository`)

- Data access
- JPA queries
- Custom query methods
- @Repository extends JpaRepository

### 4. **Entity Layer** (`com.clinice.entity`)

- JPA/Hibernate entities
- Relationships (OneToMany, ManyToOne, etc.)
- Database constraints
- @Entity, @Table

### 5. **DTO Layer** (`com.clinice.dto`)

- **Request DTOs**: API input validation
- **Response DTOs**: API output formatting
- Records (Java 17+ feature) recommended

---

##  Security Layers

### Authentication & Authorization

1. **JWT Token Provider**: Generates and validates tokens
2. **Authentication Filter**: Extracts JWT from requests
3. **Custom UserDetailsService**: Loads user details from DB
4. **Security Configuration**: Configures security rules

### Password Security

- **BCrypt**: Passwords hashed with 10+ rounds
- **Salt**: Included automatically by BCrypt

### Authorization

- **@PreAuthorize**: Method-level authorization
- **Roles**: ADMIN, DOCTOR, PATIENT
- **Stateless**: No session storage

---

##  Database Design

### Entities & Relationships

```
User (Abstract)
├── Patient (OneToMany) → Appointments
├── Doctor (OneToMany) → Appointments
└── Medical Records

Appointment
├── ManyToOne → Patient
├── ManyToOne → Doctor
└── OneToMany → Medical Records

MedicalRecord
└── ManyToOne → Patient
```

### Flyway Migrations

- **V1**: Initial schema, sequences
- **V2**: User table (base)
- **V3**: Patient table (extends User)
- **V4**: Doctor table (extends User)
- **V5**: Appointment table
- **V6**: Medical records table

---

##  Testing Strategy

### Test Types

1. **Unit Tests** (@WebMvcTest, @Test with Mocks)
   - Controllers: Validate request/response handling
   - Services: Validate business logic
   - Coverage: 70%+ enforced by JaCoCo

2. **Integration Tests** (@DataJpaTest, Testcontainers)
   - Repository behavior with real DB
   - End-to-end API flows
   - Uses PostgreSQL Testcontainer

3. **Security Tests** (Spring Security Test)
   - Authentication flows
   - Authorization rules
   - JWT token validation

---

##  Docker & Deployment

### Dockerfile Strategy

- **Multi-stage Build**:
  - Stage 1: Maven builder (compile & package)
  - Stage 2: Eclipse Temurin JRE 21 (runtime only)
- **Non-root User**: Runs as `clinice:clinice`
- **Health Check**: /actuator/health endpoint
- **Port**: 8080 exposed

### Docker Compose Services

- **postgres**: PostgreSQL 16-Alpine (port 5432)
- **app**: Spring Boot app (port 8080)
- **Network**: Isolated `clinice-network`
- **Volumes**: `postgres_data` for persistence
- **Health Checks**: Ensures startup order

---

##  Build & Run Commands

```bash
# Clean build with all tests
mvn clean verify

# Run application
mvn spring-boot:run

# Package JAR
mvn clean package

# Docker Compose (builds & starts all)
docker-compose up -d

# View logs
docker-compose logs -f app

# Test coverage report
mvn clean verify
# Open: target/site/jacoco/index.html
```

---

## 📊 Dependency Management

### Version Strategy

- **Spring Boot**: 3.3.0 (manages Spring Framework, etc.)
- **Java**: 21 (LTS, recommended)
- **JJWT**: 0.12.3 (latest stable)
- **Testcontainers**: 1.19.7 (latest)
- **Lombok**: 1.18.30 (latest)

### Scope Management

- **compile**: Runtime classpath (default)
- **runtime**: Only at runtime (PostgreSQL driver)
- **test**: Only for tests (H2, Testcontainers)
- **optional**: Marked for exclusion (Lombok)

---

## ✅ Next Steps

1. **Run Maven compile**: `mvn clean compile`
2. **Generate project**: IDE auto-import of pom.xml
3. **Create Entities**: User, Patient, Doctor, Appointment, MedicalRecord
4. **Create DTOs**: Request & Response classes
5. **Implement Security**: JWT, authentication, authorization
6. **Build Controllers**: REST endpoints
7. **Write Tests**: 70%+ coverage
8. **Setup Docker**: Build & run with Compose
9. **API Documentation**: Swagger UI at /swagger-ui.html

---

## 📝 Production Checklist

- [ ] Change JWT secret in application-prod.yml (256+ bits)
- [ ] Configure PostgreSQL credentials (strong password)
- [ ] Enable HTTPS/TLS
- [ ] Set JPA DDL to `validate` (never `create` in prod)
- [ ] Configure Flyway to execute migrations
- [ ] Setup database backups
- [ ] Configure logging (info level for prod)
- [ ] Setup monitoring & alerts
- [ ] Implement rate limiting
- [ ] Enable CORS if needed
- [ ] Test disaster recovery
- [ ] Document API in Swagger/OpenAPI
