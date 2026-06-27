package com.clinic.repository;

import com.clinic.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailAndActiveTrue(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, String id);
}
