package com.clinic.repository;

import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByEmailAndActiveTrue(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, String id);

    long countByRole(UserRole role);

    /**
     * Active accounts holding a role.
     *
     * <p>Used as the guard for "the last Super Admin cannot be removed". No explicit
     * {@code deleted} predicate: {@code @SQLRestriction("deleted = false")} on the
     * entity already excludes soft-deleted rows from every query.
     */
    long countByRoleAndActiveTrue(UserRole role);

    long countByActiveTrue();

    /** Counts per role in a single round trip, for the admin dashboard. */
    @Query("select u.role, count(u) from User u group by u.role")
    List<Object[]> countGroupedByRole();

    /** Active users holding any of the roles — used for notification fan-out. */
    List<User> findAllByRoleInAndActiveTrue(Collection<UserRole> roles);

    Page<User> findByRole(UserRole role, Pageable pageable);

    /** Doctors only, for the "assign to a doctor" picker. */
    List<User> findAllByRoleIn(Collection<UserRole> roles);

    /**
     * The admin users table: every non-deleted account, filtered in SQL.
     *
     * <p>Filtering here rather than in the service matters — the list is paginated,
     * so filtering after the fact would report a page that does not match the
     * requested page size and would skip matches that fall outside it.
     *
     * <p>Every predicate is nullable so one query serves every combination of
     * filters the UI can produce.
     */
    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:active is null or u.active = :active)
              and (:branchId is null or u.branchId = :branchId)
              and (:department is null or lower(u.department) = :department)
              and (
                    :search is null
                    or lower(u.fullName) like :search
                    or lower(u.email) like :search
                    or (u.phone is not null and lower(u.phone) like :search)
                  )
            """)
    Page<User> search(
            @org.springframework.data.repository.query.Param("role") UserRole role,
            @org.springframework.data.repository.query.Param("active") Boolean active,
            @org.springframework.data.repository.query.Param("branchId") String branchId,
            @org.springframework.data.repository.query.Param("department") String department,
            @org.springframework.data.repository.query.Param("search") String search,
            Pageable pageable);
}