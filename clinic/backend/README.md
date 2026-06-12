# clinic - Clinic Appointment & Medical Records Management System

A production-ready Spring Boot 3.x (Java 21) backend system for managing clinic appointments and medical records.

##  Architecture

- **Layered Architecture**: Controller → Service → Repository → Entity
- **Design Patterns**: DTO, Mapper, Service Layer
- **SOLID Principles**: Applied throughout
- **API-First**: RESTful API with OpenAPI/Swagger documentation

##  Tech Stack

- **Java 21** with Records and modern language features
- **Spring Boot 3.3.0** with Spring Framework 6.x
- **Spring Data JPA** with Hibernate ORM
- **PostgreSQL** for production, H2 for testing
- **Flyway** for database migrations
- **Spring Security 6.x** with JWT authentication
- **Maven** for build automation
- **Lombok** for reducing boilerplate
- **SpringDoc OpenAPI** for Swagger UI
- **Docker & Docker Compose** for containerization

##  Quick Start

### Prerequisites

- Java 21 or higher
- Maven 3.9+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker Compose)

### Build & Run

```bash
# Build the project
mvn clean package

# Run with Maven
mvn spring-boot:run

# Run with Docker Compose
docker-compose up -d

# View Swagger UI
http://localhost:8080/swagger-ui.html
```

### Run Tests

```bash
# All tests (unit + integration)
mvn clean verify

# Unit tests only
mvn test

# Integration tests only
mvn verify -DskipUnitTests

# With coverage report
mvn clean verify
# Coverage report: target/site/jacoco/index.html
```

##  Project Structure

```
clinic/
├── src/
│   ├── main/
│   │   ├── java/com/clinic/
│   │   │   ├── entity/                 # JPA entities
│   │   │   ├── dto/
│   │   │   │   ├── request/            # Request DTOs
│   │   │   │   └── response/           # Response DTOs
│   │   │   ├── repository/             # Data access layer
│   │   │   ├── service/                # Business logic layer
│   │   │   ├── controller/             # REST endpoints
│   │   │   ├── security/
│   │   │   │   └── jwt/                # JWT authentication
│   │   │   ├── exception/              # Custom exceptions
│   │   │   ├── validation/             # Custom validators
│   │   │   ├── mapper/                 # DTO mappers
│   │   │   ├── config/                 # Configuration classes
│   │   │   └── clinicApplication.java
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       ├── application-prod.yml
│   │       ├── application-test.yml
│   │       └── db/migration/           # Flyway SQL scripts
│   └── test/
│       ├── java/com/clinice/
│       │   ├── controller/
│       │   ├── service/
│       │   └── repository/
│       └── resources/
├── pom.xml
├── Dockerfile
├── docker-compose.yml
└── README.md
```

##  Core Features

### 1. **Entity Models**

- User (Base with role)
- Patient (extends User)
- Doctor (extends User)
- Appointment
- MedicalRecord

### 2. **REST API Endpoints** (8+ endpoints)

- Auth: Register, Login, Logout
- Patient: CRUD operations with pagination/filtering
- Doctor: CRUD operations with pagination/filtering
- Appointment: Schedule, Cancel, List with pagination
- Medical Records: Create, View, Update

### 3. **Security**

- JWT Authentication (stateless)
- Role-based Access Control (RBAC): ADMIN, DOCTOR, PATIENT
- BCrypt password hashing
- Token blacklist for logout

### 4. **Database**

- PostgreSQL with proper schema
- Flyway versioned migrations
- Normalized relational design

### 5. **API Documentation**

- OpenAPI 3.0 specification
- Swagger UI at `/swagger-ui.html`
- API docs at `/v3/api-docs`

##  Security Features

- **JWT Tokens**: Signed with HS512
- **Password Security**: BCrypt hashing
- **Token Expiration**: Configurable TTL
- **Role-Based Authorization**: @PreAuthorize annotations
- **CORS**: Configurable cross-origin requests
- **Input Validation**: Bean Validation with custom validators

##  Testing

- **Unit Tests**: @WebMvcTest, @DataJpaTest
- **Integration Tests**: Testcontainers with PostgreSQL
- **Coverage**: JaCoCo (target: 70%+)
- **Frameworks**: JUnit 5, Mockito

##  Docker Deployment

```bash
# Build Docker image
docker build -t clinice:latest .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Docker Compose Services

- **app**: Spring Boot application (port 8080)
- **postgres**: PostgreSQL database (port 5432)

##  Configuration

### application.yml

Profiles supported:

- `dev` - Development environment
- `prod` - Production environment
- `test` - Testing environment

### Key Properties

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate # Never use create in prod
  security:
    jwt:
      secret: your-secret-key-change-in-prod
      expiration: 86400000 # 24 hours
```

##  Code Quality

- **Code Coverage**: 70%+ (enforced by JaCoCo)
- **Testing**: Comprehensive unit and integration tests
- **Clean Code**: SOLID principles, design patterns
- **Documentation**: JavaDoc, API documentation

##  API Documentation

Visit `/swagger-ui.html` after starting the application to:

- View all available endpoints
- Test API calls interactively
- View request/response schemas

##  Database Migrations

Migrations are versioned and applied automatically with Flyway:

- V1\_\_init.sql - Initial schema
- V2\_\_users.sql - User entity
- V3\_\_patients.sql - Patient entity
- V4\_\_doctors.sql - Doctor entity
- V5\_\_appointments.sql - Appointment entity
- V6\_\_medical_records.sql - Medical records entity

##  Dependencies

See [pom.xml](pom.xml) for complete dependency list. Key dependencies:

- Spring Boot 3.3.0
- Spring Security 6.x
- Spring Data JPA
- Hibernate 6.x
- PostgreSQL Driver
- JJWT 0.12.3
- Lombok 1.18.30
- SpringDoc OpenAPI 2.3.0

##  Contributing

1. Create a feature branch
2. Follow Spring Boot conventions
3. Write tests (>70% coverage)
4. Create pull request

##  License

Proprietary - clinic System

##  Contact

For questions or support, contact the development team.
