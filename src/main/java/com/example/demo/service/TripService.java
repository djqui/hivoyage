package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.example.demo.model.Trip;
import com.example.demo.model.User;
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
    
    @Autowired
    private GeocodingService geocodingService;
    
    // Check if there are any overlapping current trips for a specific user
    public boolean hasOverlappingCurrentTrip(Trip newTrip, User user) {
        if (newTrip.getStartDate() == null || newTrip.getEndDate() == null) {
            return false;
        }

        LocalDate now = LocalDate.now();
        List<Trip> currentTrips = tripRepo.findByUser(user).stream()
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

    // Check if there are any overlapping dates with existing trips for a specific user
    public boolean hasOverlappingDates(Trip newTrip, User user) {
        if (newTrip.getStartDate() == null || newTrip.getEndDate() == null) {
            return false;
        }

        List<Trip> existingTrips = tripRepo.findByUser(user);
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

    // Save a new trip for a specific user
    public Trip save(Trip trip, User user) {
        log.info("Saving trip: {} for user: {}", trip, user.getEmail());
        
        // Check for overlapping dates
        if (hasOverlappingDates(trip, user)) {
            log.warn("Cannot save trip: Overlapping dates with existing trip for user: {}", user.getEmail());
            throw new IllegalStateException("Cannot have trips with overlapping dates");
        }
        
        // Get coordinates for the destination
        GeocodingService.Coordinates coords = geocodingService.getCoordinates(trip.getDestination());
        if (coords != null) {
            trip.setLatitude(coords.getLatitude());
            trip.setLongitude(coords.getLongitude());
        }
        
        trip.setUser(user);
        Trip savedTrip = tripRepo.save(trip);
        log.info("Saved trip with ID: {} for user: {}", savedTrip.getId(), user.getEmail());
        return savedTrip;
    }
    
    // Save trip items without checking date overlaps
    public Trip saveWithoutDateCheck(Trip trip, User user) {
        log.info("Saving trip items for trip ID: {} for user: {}", trip.getId(), user.getEmail());
        trip.setUser(user);
        Trip savedTrip = tripRepo.save(trip);
        log.info("Saved trip items for trip ID: {}", savedTrip.getId());
        return savedTrip;
    }

    // Retrieve all trips for a specific user
    public List<Trip> getAllTripsForUser(User user) {
        log.info("Fetching all trips for user: {}", user.getEmail());
        List<Trip> trips = tripRepo.findByUserOrderByStartDateAsc(user);
        log.info("Found {} trips for user: {}", trips.size(), user.getEmail());
        
        for (Trip trip : trips) {
            try {
                log.info("Processing trip: {} with dates: start={}, end={}", 
                    trip.getDestination(), trip.getStartDate(), trip.getEndDate());
                if (trip.getStartDate() != null) {
                    long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), trip.getStartDate());
                    daysUntilTrip = Math.max(daysUntilTrip, 0); // Ensure non-negative countdown
                    trip.setCountdown("D-" + daysUntilTrip);
                } else {
                    trip.setCountdown("Date not set");
                }
            } catch (Exception e) {
                log.error("Error processing trip {}: {}", trip.getDestination(), e.getMessage());
                trip.setCountdown("Error calculating countdown");
            }
        }
        return trips;
    }

    // Retrieve a trip by ID for a specific user
    public Trip getTripByIdForUser(Long id, User user) {
        log.info("Fetching trip with ID: {} for user: {}", id, user.getEmail());
        Optional<Trip> trip = tripRepo.findById(id);
        if (trip.isPresent() && trip.get().getUser().getId().equals(user.getId())) {
            Trip foundTrip = trip.get();
            log.info("Found trip: {} with dates: start={}, end={}", 
                foundTrip.getDestination(), foundTrip.getStartDate(), foundTrip.getEndDate());
            if (foundTrip.getStartDate() != null) {
                long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), foundTrip.getStartDate());
                foundTrip.setCountdown("D-" + daysUntilTrip);
            }
            return foundTrip;
        }
        log.warn("No trip found with ID: {} for user: {}", id, user.getEmail());
        return null;
    }

    // Delete a trip by ID for a specific user
    public void deleteTripForUser(Long id, User user) {
        log.info("Deleting trip with ID: {} for user: {}", id, user.getEmail());
        Optional<Trip> trip = tripRepo.findById(id);
        if (trip.isPresent() && trip.get().getUser().getId().equals(user.getId())) {
            tripRepo.deleteById(id);
            log.info("Successfully deleted trip with ID: {} for user: {}", id, user.getEmail());
        } else {
            log.warn("Cannot delete trip with ID: {} - not found or not owned by user: {}", id, user.getEmail());
        }
    }

    // Update coordinates for all trips without coordinates
    public void updateMissingCoordinates() {
        log.info("Updating missing coordinates for all trips");
        List<Trip> trips = tripRepo.findAll();
        
        for (Trip trip : trips) {
            if (trip.getLatitude() == null || trip.getLongitude() == null) {
                GeocodingService.Coordinates coords = geocodingService.getCoordinates(trip.getDestination());
                if (coords != null) {
                    trip.setLatitude(coords.getLatitude());
                    trip.setLongitude(coords.getLongitude());
                    tripRepo.save(trip);
                    log.info("Updated coordinates for trip: {} to lat: {}, lon: {}", 
                        trip.getDestination(), coords.getLatitude(), coords.getLongitude());
                }
            }
        }
    }
}
