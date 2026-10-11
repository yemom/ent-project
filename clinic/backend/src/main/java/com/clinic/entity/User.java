package com.clinic.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import java.math.BigDecimal;

/**
 * Abstract User entity representing base user in the system.
 * Supports Single Table Inheritance strategy.
 *
 * Inheritance hierarchy:
 * - User (abstract)
 * - Patient
 * - Doctor
 *
 * Fields: id, email, password, fullName, phone, role, active, createdAt,
 * updatedAt
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_email", columnList = "email", unique = true),
        @Index(name = "idx_phone", columnList = "phone")
})
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "user_type", discriminatorType = DiscriminatorType.STRING)
@SQLDelete(sql = "UPDATE users SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted = false")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public abstract class User extends BaseEntity {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email;

    @NotBlank(message = "Password is required")
    @Column(name = "password", nullable = false, length = 255)
    private String password;

    @NotBlank(message = "Full name is required")
    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "phone", length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    /**
     * Owning branch for staff accounts. Patient rows carry their own branch_id.
     * Every scoped query filters on this so a branch never sees another branch's
     * records; a null value means "unscoped" and is only possible for the
     * platform-level super admin.
     */
    @Column(name = "branch_id", length = 36)
    private String branchId;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "ward", length = 100)
    private String ward;

    /**
     * Forces a password change on the next sign-in.
     *
     * <p>Set when an administrator issues a temporary credential. Without it a
     * handed-out password would remain valid indefinitely, which is how shared
     * "initial passwords" quietly become permanent ones.
     */
    @Builder.Default
    @Column(name = "must_change_password", nullable = false)
    private Boolean mustChangePassword = false;

    /**
     * Why this account was deactivated. Required on deactivation.
     *
     * <p>Recorded so "when did this clinician lose access, and who decided" is
     * answerable later without reconstructing it from log files.
     */
    @Column(name = "deactivation_reason", length = 500)
    private String deactivationReason;

    @Column(name = "deactivated_at")
    private java.time.LocalDateTime deactivatedAt;

    /** Clears the deactivation trail when an account is reactivated. */
    public void activate() {
        this.active = true;
        this.deactivationReason = null;
        this.deactivatedAt = null;
    }

    public void deactivate(String reason) {
        this.active = false;
        this.deactivationReason = reason;
        this.deactivatedAt = java.time.LocalDateTime.now();
    }

}