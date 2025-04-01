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
import java.util.stream.Collectors;

@Service
@Slf4j
public class TripService {

    @Autowired
    private TripRepository tripRepo;
    
    // Check if there are any overlapping current trips
    public boolean hasOverlappingCurrentTrip(Trip newTrip) {
        if (newTrip.getStartDate() == null || newTrip.getEndDate() == null) {
            return false;
        }

        LocalDate now = LocalDate.now();
        List<Trip> currentTrips = tripRepo.findAll().stream()
            .filter(trip -> trip.getStartDate() != null && trip.getEndDate() != null &&
                          !trip.getStartDate().isAfter(now.plusDays(1)) &&
                          !trip.getEndDate().isBefore(now))
            .collect(Collectors.toList());

        for (Trip currentTrip : currentTrips) {
            if (!(newTrip.getEndDate().isBefore(currentTrip.getStartDate()) ||
                  newTrip.getStartDate().isAfter(currentTrip.getEndDate()))) {
                return true;
            }
        }
        return false;
    }

    // Check if there are any overlapping dates with existing trips
    public boolean hasOverlappingDates(Trip newTrip) {
        if (newTrip.getStartDate() == null || newTrip.getEndDate() == null) {
            return false;
        }

        List<Trip> existingTrips = tripRepo.findAll();
        for (Trip existingTrip : existingTrips) {
            if (existingTrip.getStartDate() != null && existingTrip.getEndDate() != null) {
                if (!(newTrip.getEndDate().isBefore(existingTrip.getStartDate()) ||
                      newTrip.getStartDate().isAfter(existingTrip.getEndDate()))) {
                    return true;
                }
            }
        }
        return false;
    }

    // Save a new trip
    public Trip save(Trip trip) {
        log.info("Saving trip: {}", trip);
        
        // Check for overlapping dates
        if (hasOverlappingDates(trip)) {
            log.warn("Cannot save trip: Overlapping dates with existing trip");
            throw new IllegalStateException("Cannot have trips with overlapping dates");
        }
        
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

    // Delete a trip by ID
    public void deleteTrip(Long id) {
        log.info("Deleting trip with ID: {}", id);
        tripRepo.deleteById(id);
        log.info("Successfully deleted trip with ID: {}", id);
    }
}
