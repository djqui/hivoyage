package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.example.demo.model.Trip;
import com.example.demo.repository.TripRepository;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Service
public class TripService {

    @Autowired
    private TripRepository tripRepo;
    
    // Save a new trip
    public Trip save(Trip trip) {
        return tripRepo.save(trip);
    }

    // Retrieve all trips and calculate countdown for each trip
    public List<Trip> getAllTrips() {
        List<Trip> trips = tripRepo.findAll();
        for (Trip trip : trips) {
            long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), trip.getStartDate());
            trip.setCountdown("D-" + daysUntilTrip);
        }
        return trips;
    }

    // Retrieve a trip by ID
    public Trip getTripById(Long id) {
        Optional<Trip> trip = tripRepo.findById(id);
        if (trip.isPresent()) {
            Trip foundTrip = trip.get();
            long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), foundTrip.getStartDate());
            foundTrip.setCountdown("D-" + daysUntilTrip);
            return foundTrip;
        }
        return null;
    }
}
