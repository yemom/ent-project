package com.clinic.integration;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PostgreSQL-only evidence for the appointment-slot invariant.
 *
 * <p>Run explicitly with {@code RUN_POSTGRES_CONCURRENCY_TESTS=true}. The normal
 * H2 suite cannot prove PostgreSQL exclusion constraints or transaction
 * arbitration, so this test is intentionally not part of the default test run.
 */
@Testcontainers(disabledWithoutDocker = true)
class PostgresAppointmentConcurrencyTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeAll
    static void requireExplicitExecution() {
        Assumptions.assumeTrue(
                "true".equalsIgnoreCase(System.getenv("RUN_POSTGRES_CONCURRENCY_TESTS")),
                "Set RUN_POSTGRES_CONCURRENCY_TESTS=true to run PostgreSQL concurrency evidence");
    }

    @Test
    void onlyOneConcurrentAppointmentCanReserveTheSameDoctorSlot() throws Exception {
        DataSource dataSource = dataSource();
        try (Connection setup = dataSource.getConnection();
             Statement statement = setup.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS concurrency_doctors (id varchar(36) PRIMARY KEY)");
            statement.execute("CREATE TABLE IF NOT EXISTS concurrency_appointments ("
                    + "id varchar(36) PRIMARY KEY, doctor_id varchar(36) NOT NULL, "
                    + "appointment_date timestamp NOT NULL, duration integer NOT NULL, status varchar(20) NOT NULL)");
            statement.execute("CREATE EXTENSION IF NOT EXISTS btree_gist");
            statement.execute("ALTER TABLE concurrency_appointments "
                    + "DROP CONSTRAINT IF EXISTS concurrency_doctor_slot_exclusion");
            statement.execute("ALTER TABLE concurrency_appointments "
                    + "ADD CONSTRAINT concurrency_doctor_slot_exclusion EXCLUDE USING gist ("
                    + "doctor_id WITH =, tsrange(appointment_date, "
                    + "appointment_date + make_interval(mins => duration), '[)') WITH &&) "
                    + "WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED'))");
        }

        String doctorId = "doctor-concurrency";
        LocalDateTime slot = LocalDateTime.of(2035, 1, 2, 9, 0);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger committed = new AtomicInteger();

        Runnable insert = () -> {
            try (Connection connection = dataSource.getConnection();
                 PreparedStatement statement = connection.prepareStatement(
                         "INSERT INTO concurrency_appointments "
                                 + "(id, doctor_id, appointment_date, duration, status) "
                                 + "VALUES (?, ?, ?, ?, 'SCHEDULED')")) {
                connection.setAutoCommit(false);
                statement.setString(1, java.util.UUID.randomUUID().toString());
                statement.setString(2, doctorId);
                statement.setObject(3, slot);
                statement.setInt(4, 30);
                ready.countDown();
                start.await(10, TimeUnit.SECONDS);
                statement.executeUpdate();
                connection.commit();
                committed.incrementAndGet();
            } catch (Exception expectedForTheLosingTransaction) {
                // The exclusion constraint aborts exactly one competing transaction.
            }
        };

        Thread first = new Thread(insert, "appointment-concurrency-first");
        Thread second = new Thread(insert, "appointment-concurrency-second");
        first.start();
        second.start();
        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        first.join(15_000);
        second.join(15_000);

        assertThat(committed).hasValue(1);
    }

    private DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.postgresql.Driver");
        dataSource.setUrl(POSTGRES.getJdbcUrl());
        dataSource.setUsername(POSTGRES.getUsername());
        dataSource.setPassword(POSTGRES.getPassword());
        return dataSource;
    }
}
