package com.clinic.config;

import com.clinic.entity.AdminUser;
import com.clinic.entity.AuditAction;
import com.clinic.entity.Patient;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.UserRepository;
import com.clinic.service.AuditLogService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Super Admin bootstrap.
 *
 * <p>Covers the behaviours that decide whether the founder can actually sign in
 * after a deploy: creation from the configured password, promotion of a legacy
 * row, and the guarantee that an existing Super Admin's password is never
 * rewritten on a later boot.
 *
 * <p>The PROMOTE path uses a native SQL UPDATE (via {@code EntityManager.createNativeQuery})
 * to change {@code user_type} and {@code role} in-place, bypassing JPA's discriminator
 * object-identity constraints. The CREATE path still uses {@code userRepository.saveAndFlush}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminUserInitializerTest {

    private static final String EMAIL = "12yemom@gmail.com";
    private static final String NAME = "Esrom Basazinaw";
    private static final String PASSWORD = "Fekerte@zegeye1221";

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private EntityManager entityManager;

    /** Reusable mock Query returned by entityManager.createNativeQuery(...). */
    private Query nativeQuery;

    private AdminUserInitializer initializer;
    private PasswordEncoder encoder;

    @BeforeEach
    void setUp() {
        encoder = new BCryptPasswordEncoder();
        // Constructor order matches @RequiredArgsConstructor field declaration order:
        // UserRepository, PasswordEncoder, AuditLogService, EntityManager
        initializer = new AdminUserInitializer(userRepository, encoder, auditLogService, entityManager);

        ReflectionTestUtils.setField(initializer, "superAdminName", NAME);
        ReflectionTestUtils.setField(initializer, "superAdminEmail", EMAIL);
        ReflectionTestUtils.setField(initializer, "superAdminPassword", PASSWORD);
        // Explicit default so the recovery flag is never accidentally on.
        ReflectionTestUtils.setField(initializer, "forceSuperAdminPassword", false);

        // Stub saveAndFlush for the CREATE path.
        lenient().when(userRepository.saveAndFlush(any(User.class)))
                .thenAnswer(inv -> {
                    User saved = inv.getArgument(0);
                    if (saved.getId() == null) saved.setId("generated-id");
                    return saved;
                });

        // Stub the native-query chain used by the PROMOTE path.
        nativeQuery = mock(Query.class);
        lenient().when(entityManager.createNativeQuery(anyString())).thenReturn(nativeQuery);
        lenient().when(nativeQuery.setParameter(anyString(), any())).thenReturn(nativeQuery);
        lenient().when(nativeQuery.executeUpdate()).thenReturn(1);

        lenient().when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        lenient().when(userRepository.findAll()).thenReturn(List.of());
    }

    // ------------------------------------------------------------------
    // CREATE path
    // ------------------------------------------------------------------

    @Test
    void createsTheSuperAdminWithTheConfiguredPassword() {
        initializer.run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());

        User created = saved.getValue();
        assertEquals(UserRole.SUPER_ADMIN, created.getRole());
        assertEquals(EMAIL, created.getEmail());
        assertEquals(NAME, created.getFullName());
        // The password is hashed, never stored or logged in the clear.
        assertNotEquals(PASSWORD, created.getPassword());
        assertTrue(encoder.matches(PASSWORD, created.getPassword()),
                "the configured password must verify against the stored hash");
    }

    @Test
    void creationIsAudited() {
        initializer.run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        verify(auditLogService).record(eq(AuditAction.USER_CREATED), eq("USER"),
                eq(saved.getValue().getId()), anyString());
    }

    @Test
    void refusesToCreateAnAccountWithANonCompliantPassword() {
        ReflectionTestUtils.setField(initializer, "superAdminPassword", "weak");

        initializer.run(null);

        // Creating a weak-password account would be worse than creating none.
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    // ------------------------------------------------------------------
    // PROMOTE path — all go through entityManager.createNativeQuery()
    // ------------------------------------------------------------------

    @Test
    void promotesALegacyPatientRowAndAppliesTheConfiguredPassword() {
        Patient legacy = Patient.builder()
                .email(EMAIL)
                .fullName(NAME)
                .password(encoder.encode("SomeOldPassword1!"))
                .role(UserRole.PATIENT)
                .active(true)
                .build();
        legacy.setId("legacy-id");

        when(userRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(legacy));

        initializer.run(null);

        // The native UPDATE must have been executed.
        verify(entityManager).createNativeQuery(anyString());
        verify(nativeQuery).setParameter(eq("id"), eq("legacy-id"));

        // The password parameter must be a BCrypt hash of PASSWORD, not the old one.
        ArgumentCaptor<String> pwCaptor = ArgumentCaptor.forClass(String.class);
        verify(nativeQuery).setParameter(eq("pw"), pwCaptor.capture());
        assertTrue(encoder.matches(PASSWORD, pwCaptor.getValue()),
                "the bootstrap password must be applied when promoting a legacy row");

        // The promotion must be audited.
        verify(auditLogService).record(eq(AuditAction.ROLE_CHANGED), eq("USER"),
                eq("legacy-id"), anyString());
    }

    @Test
    void neverRewritesThePasswordOfAnAccountThatIsAlreadySuperAdmin() {
        AdminUser existing = AdminUser.builder()
                .email(EMAIL)
                .fullName(NAME)
                .password(encoder.encode("AlreadySet1!"))
                .role(UserRole.SUPER_ADMIN)
                .active(true)
                .build();
        existing.setId("existing-id");

        when(userRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(existing));

        initializer.run(null);

        // A restart must not touch the DB at all when already SUPER_ADMIN.
        verify(userRepository, never()).saveAndFlush(any(User.class));
        verify(entityManager, never()).createNativeQuery(anyString());
    }

    @Test
    void forceFlagReappliesThePasswordToAnExistingSuperAdmin() {
        AdminUser existing = AdminUser.builder()
                .email(EMAIL)
                .fullName(NAME)
                .password(encoder.encode("AlreadySet1!"))
                .role(UserRole.SUPER_ADMIN)
                .active(true)
                .build();
        existing.setId("existing-id");

        when(userRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(existing));
        ReflectionTestUtils.setField(initializer, "forceSuperAdminPassword", true);

        initializer.run(null);

        // Force-flag must trigger a native UPDATE with the new hash.
        verify(entityManager).createNativeQuery(anyString());
        ArgumentCaptor<String> pwCaptor = ArgumentCaptor.forClass(String.class);
        verify(nativeQuery).setParameter(eq("pw"), pwCaptor.capture());
        assertTrue(encoder.matches(PASSWORD, pwCaptor.getValue()),
                "the recovery flag exists precisely so a drifted password can be reset");
    }

    @Test
    void forceFlagStillRefusesANonCompliantPassword() {
        AdminUser existing = AdminUser.builder()
                .email(EMAIL)
                .fullName(NAME)
                .password(encoder.encode("AlreadySet1!"))
                .role(UserRole.SUPER_ADMIN)
                .active(true)
                .build();
        existing.setId("existing-id");

        when(userRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(existing));
        ReflectionTestUtils.setField(initializer, "forceSuperAdminPassword", true);
        ReflectionTestUtils.setField(initializer, "superAdminPassword", "weak");

        initializer.run(null);

        // Update still fires but with the OLD hash (policy rejected the new one).
        verify(entityManager).createNativeQuery(anyString());
        ArgumentCaptor<String> pwCaptor = ArgumentCaptor.forClass(String.class);
        verify(nativeQuery).setParameter(eq("pw"), pwCaptor.capture());
        assertTrue(encoder.matches("AlreadySet1!", pwCaptor.getValue()),
                "a weak recovery password must be refused, leaving the old hash in the UPDATE");
    }

    @Test
    void matchesByNameWhenNoEmailMatches() {
        AdminUser byName = AdminUser.builder()
                .email("different.address@example.com")
                .fullName(NAME)
                .password(encoder.encode("AlreadySet1!"))
                .role(UserRole.ADMIN)
                .active(true)
                .build();
        byName.setId("by-name-id");

        when(userRepository.findAll()).thenReturn(List.of(byName));

        initializer.run(null);

        verify(entityManager).createNativeQuery(anyString());
        verify(nativeQuery).setParameter(eq("id"), eq("by-name-id"));
        verify(auditLogService).record(eq(AuditAction.ROLE_CHANGED), eq("USER"),
                eq("by-name-id"), anyString());
    }

    @Test
    void refusesToPromoteWhenTheNameIsAmbiguous() {
        // Ambiguous name — falls through to CREATE with the configured email.
        AdminUser first = AdminUser.builder().email("a@example.com").fullName(NAME)
                .password(encoder.encode("Password123!")).role(UserRole.ADMIN).active(true).build();
        AdminUser second = AdminUser.builder().email("b@example.com").fullName(NAME)
                .password(encoder.encode("Password123!")).role(UserRole.ADMIN).active(true).build();
        when(userRepository.findAll()).thenReturn(List.of(first, second));

        initializer.run(null);

        // Falls through to creation.
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertEquals(EMAIL, saved.getValue().getEmail());
    }

    @Test
    void placeholderEmailIsUsedOnlyWhenNoneIsConfigured() {
        ReflectionTestUtils.setField(initializer, "superAdminEmail", "");

        initializer.run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertTrue(saved.getValue().getEmail().endsWith("@clinic.local"),
                "an unset email must use an obviously-local placeholder, not a guess at a real mailbox");
    }
}