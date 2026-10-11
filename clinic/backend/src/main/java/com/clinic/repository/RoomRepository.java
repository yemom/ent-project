package com.clinic.repository;

import com.clinic.entity.Room;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, String> {

    @EntityGraph(attributePaths = "ward")
    Page<Room> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"ward", "ward.department"})
    Page<Room> findByWardId(String wardId, Pageable pageable);

    @EntityGraph(attributePaths = {"ward", "ward.department"})
    List<Room> findByStatus(Room.Status status);

    @EntityGraph(attributePaths = {"ward", "ward.department"})
    List<Room> findAllByOrderByNameAsc();

    long countByStatus(Room.Status status);
}