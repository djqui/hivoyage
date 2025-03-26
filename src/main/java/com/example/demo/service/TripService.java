package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.example.demo.model.Trip;
import com.example.demo.repository.TripRepository;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class TripService {

    @Autowired
    private TripRepository tripRepo;
    
    // Save a new trip
    public Trip save(Trip trip) {
        log.info("Saving trip: {}", trip);
        Trip savedTrip = tripRepo.save(trip);
        log.info("Saved trip with ID: {}", savedTrip.getId());
        return savedTrip;
    }

    // Retrieve all trips and calculate countdown for each trip
    public List<Trip> getAllTrips() {
        log.info("Fetching all trips from database");
        List<Trip> trips = tripRepo.findAll();
        log.info("Found {} trips in database", trips.size());
        
        for (Trip trip : trips) {
            log.info("Processing trip: {} with dates: start={}, end={}", 
                trip.getDestination(), trip.getStartDate(), trip.getEndDate());
            if (trip.getStartDate() != null) {
                long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), trip.getStartDate());
                trip.setCountdown("D-" + daysUntilTrip);
            }
        }
        return trips;
    }

    // Retrieve a trip by ID
    public Trip getTripById(Long id) {
        log.info("Fetching trip with ID: {}", id);
        Optional<Trip> trip = tripRepo.findById(id);
        if (trip.isPresent()) {
            Trip foundTrip = trip.get();
            log.info("Found trip: {} with dates: start={}, end={}", 
                foundTrip.getDestination(), foundTrip.getStartDate(), foundTrip.getEndDate());
            if (foundTrip.getStartDate() != null) {
                long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), foundTrip.getStartDate());
                foundTrip.setCountdown("D-" + daysUntilTrip);
            }
            return foundTrip;
        }
        log.warn("No trip found with ID: {}", id);
        return null;
    }
}
