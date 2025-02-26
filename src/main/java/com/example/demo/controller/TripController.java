package com.example.demo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.example.demo.model.Trip;
import com.example.demo.service.TripService;

@Controller
public class TripController {

    @Autowired
    private TripService tripService;
    
    // Step 1: Display new trip form
    @GetMapping("/user/newtrip")
    public String showNewTrip(Model model) {
        model.addAttribute("trip", new Trip());
        return "newtrip";
    }
    
    // Step 2: Process form submission
    @PostMapping("/user/saveTrip")
    public String saveTrip(Trip trip, RedirectAttributes redi) {
        tripService.save(trip);
        redi.addFlashAttribute("message", "Trip has been saved successfully!");
        return "redirect:/welcome"; // Redirect to a confirmation page or trip list
    }
}
