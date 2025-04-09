package com.example.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.demo.model.Trip;
import com.example.demo.model.User;
import java.util.List;

public interface TripRepository extends JpaRepository<Trip, Long> {
    List<Trip> findByUser(User user);
    List<Trip> findByUserOrderByStartDateAsc(User user);
}
