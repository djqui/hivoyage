package com.example.demo.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.example.demo.model.Trip;
import com.example.demo.service.TripService;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Controller
@Slf4j
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    // Display the new trip form
    @GetMapping("/user/newtrip")
    public String showNewTrip(Model model) {
        model.addAttribute("trip", new Trip());
        return "newtrip";
    }

    // Save trip and redirect to homepage
    @PostMapping("/user/saveTrip")
    public String saveTrip(Trip trip, RedirectAttributes redirectAttributes) {
        tripService.save(trip);
        redirectAttributes.addFlashAttribute("message", "Trip has been saved successfully!");
        log.info("Trip saved: {}", trip);
        return "redirect:/user/homepage";
    }

    // Display all trips on the homepage
    @GetMapping("/user/homepage")
    public String showTrips(Model model) {
        List<Trip> trips = tripService.getAllTrips();

        List<Trip> tripsWithCountdown = trips.stream().map(trip -> {
            if (trip.getStartDate() != null) {
                long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), trip.getStartDate());
                daysUntilTrip = Math.max(daysUntilTrip, 0); // Avoid negative countdowns
                trip.setCountdown("D-" + daysUntilTrip);
            } else {
                trip.setCountdown("Date not set");
            }
            return trip;
        }).collect(Collectors.toList());

        model.addAttribute("trips", tripsWithCountdown);
        return "homepage";
    }

    // Get a trip by ID and display details
    @GetMapping("/user/trip/{id}")
    public String getTrip(@PathVariable Long id, Model model) {
        Optional<Trip> optionalTrip = Optional.ofNullable(tripService.getTripById(id));
    
        if (optionalTrip.isEmpty()) {
            log.warn("Trip with ID {} not found", id);
            return "redirect:/user/homepage"; // Redirect if trip is not found
        }
    
        Trip trip = optionalTrip.get();
        LocalDate today = LocalDate.now();
        String status;
    
        if (trip.getStartDate() != null && trip.getEndDate() != null) {
            if (today.isBefore(trip.getStartDate())) {
                // Future trip
                long daysUntilTrip = ChronoUnit.DAYS.between(today, trip.getStartDate());
                status = "D-" + daysUntilTrip;
            } else if (!today.isAfter(trip.getEndDate())) {
                // Current trip (ongoing)
                status = "Ongoing";
            } else {
                // Past trip
                long daysSinceTrip = ChronoUnit.DAYS.between(trip.getEndDate(), today);
                status = "Ended " + daysSinceTrip + " days ago";
            }
        } else {
            status = "Date not set";
        }
    
        model.addAttribute("trip", trip);
        model.addAttribute("daysUntilTrip", status);
    
        return "tripdetails";
    }
    
}
