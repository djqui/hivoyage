package com.example.demo.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.example.demo.model.Trip;
import com.example.demo.model.ItineraryItem;
import com.example.demo.model.PackingItem;
import com.example.demo.model.User;
import com.example.demo.service.TripService;
import com.example.demo.security.CustomUserDetails;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.ArrayList;

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
    public String saveTrip(Trip trip, @AuthenticationPrincipal CustomUserDetails userDetails, RedirectAttributes redirectAttributes) {
        try {
            User user = userDetails.getUser();
            tripService.save(trip, user);
            redirectAttributes.addFlashAttribute("message", "Trip has been saved successfully!");
            log.info("Trip saved: {} for user: {}", trip, user.getEmail());
            return "redirect:/user/homepage";
        } catch (IllegalStateException e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
            log.warn("Failed to save trip: {}", e.getMessage());
            return "redirect:/user/newtrip";
        }
    }

    // Display all trips on the homepage
    @GetMapping("/user/homepage")
    public String showTrips(@AuthenticationPrincipal CustomUserDetails userDetails, Model model) {
        try {
            User user = userDetails.getUser();
            log.info("Handling homepage request for user: {}", user.getEmail());
            List<Trip> trips = tripService.getAllTripsForUser(user);
            log.info("Retrieved {} trips for user: {}", trips.size(), user.getEmail());

            if (trips == null) {
                trips = new ArrayList<>();
                log.warn("Trips list was null for user: {}, initialized empty list", user.getEmail());
            }

            // Sort trips by date
            trips.sort((t1, t2) -> {
                if (t1.getStartDate() == null) return 1;
                if (t2.getStartDate() == null) return -1;
                return t1.getStartDate().compareTo(t2.getStartDate());
            });

            model.addAttribute("trips", trips);
            model.addAttribute("user", user);
            log.info("Added {} sorted trips to model for user: {}", trips.size(), user.getEmail());
            return "homepage";
        } catch (Exception e) {
            log.error("Error displaying homepage for user: {}: {}", userDetails.getUsername(), e.getMessage());
            model.addAttribute("trips", new ArrayList<>());
            model.addAttribute("error", "An error occurred while loading trips. Please try again later.");
            return "homepage";
        }
    }

    // Get a trip by ID and display details
    @GetMapping("/user/trip/{id}")
    public String getTrip(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails userDetails, Model model) {
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
    
        if (trip == null) {
            log.warn("Trip with ID {} not found for user: {}", id, user.getEmail());
            return "redirect:/user/homepage";
        }
    
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
    
    @PostMapping("/user/trip/{id}/saveItinerary")
    public String saveItinerary(@PathVariable Long id, @RequestParam("day") int day,
                               @RequestParam("title") String title,
                               @RequestParam("location") String location,
                               @RequestParam("description") String description,
                               RedirectAttributes redirectAttributes) {
        log.info("Saving itinerary item for trip {}: day={}, title={}, location={}", id, day, title, location);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null) {
            ItineraryItem item = new ItineraryItem();
            item.setDay(day);
            item.setTitle(title);
            item.setLocation(location);
            item.setDescription(description);
            item.setTrip(trip);
            
            // Initialize itinerary list if null
            if (trip.getItinerary() == null) {
                trip.setItinerary(new ArrayList<>());
            }
            
            trip.getItinerary().add(item);
            tripService.save(trip);
            log.info("Successfully saved itinerary item for trip {}", id);
            redirectAttributes.addFlashAttribute("message", "Itinerary item saved successfully!");
        } else {
            log.error("Trip with ID {} not found", id);
            redirectAttributes.addFlashAttribute("error", "Trip not found!");
        }
        return "redirect:/user/trip/" + id;
    }

    @PostMapping("/user/trip/{id}/deleteDay")
    public String deleteDay(@PathVariable Long id, @RequestParam("day") int day,
                           RedirectAttributes redirectAttributes) {
        log.info("Deleting day {} from trip {}", day, id);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null && trip.getItinerary() != null) {
            List<ItineraryItem> itemsToRemove = new ArrayList<>();
            List<ItineraryItem> itemsToUpdate = new ArrayList<>();
            
            // First, identify items to remove and update
            for (ItineraryItem item : trip.getItinerary()) {
                if (item.getDay() == day) {
                    itemsToRemove.add(item);
                } else if (item.getDay() > day) {
                    item.setDay(item.getDay() - 1);
                    itemsToUpdate.add(item);
                }
            }
            
            // Remove the items for the deleted day
            trip.getItinerary().removeAll(itemsToRemove);
            
            // Save the updated trip
            tripService.save(trip);
            log.info("Successfully deleted day {} from trip {} and renumbered remaining days", day, id);
            redirectAttributes.addFlashAttribute("message", "Day deleted successfully!");
        } else {
            log.error("Trip with ID {} not found", id);
            redirectAttributes.addFlashAttribute("error", "Trip not found!");
        }
        return "redirect:/user/trip/" + id;
    }

    @PostMapping("/user/trip/{id}/savePackingItem")
    @ResponseBody
    public ResponseEntity<?> savePackingItem(@PathVariable Long id,
                                        @RequestParam("name") String name,
                                        @RequestParam("checked") boolean checked) {
        log.info("Saving packing item for trip {}: name={}, checked={}", id, name, checked);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null) {
            PackingItem item = new PackingItem();
            item.setName(name);
            item.setChecked(checked);
            item.setTrip(trip);
            
            // Initialize packing list if null
            if (trip.getPackingList() == null) {
                trip.setPackingList(new ArrayList<>());
            }
            
            trip.getPackingList().add(item);
            tripService.save(trip);
            log.info("Successfully saved packing item for trip {}", id);
            return ResponseEntity.ok().build();
        } else {
            log.error("Trip with ID {} not found", id);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/user/trip/{id}/updatePackingItem")
    @ResponseBody
    public ResponseEntity<?> updatePackingItem(@PathVariable Long id,
                                          @RequestParam("name") String name,
                                          @RequestParam("checked") boolean checked,
                                          @RequestParam("oldName") String oldName) {
        log.info("Updating packing item for trip {}: oldName={}, newName={}, checked={}", id, oldName, name, checked);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null && trip.getPackingList() != null) {
            PackingItem itemToUpdate = trip.getPackingList().stream()
                .filter(item -> item.getName().equals(oldName))
                .findFirst()
                .orElse(null);
            
            if (itemToUpdate != null) {
                itemToUpdate.setName(name);
                itemToUpdate.setChecked(checked);
                tripService.save(trip);
                log.info("Successfully updated packing item for trip {}", id);
                return ResponseEntity.ok().build();
            } else {
                log.error("Packing item {} not found in trip {}", oldName, id);
                return ResponseEntity.notFound().build();
            }
        } else {
            log.error("Trip with ID {} not found or has no packing list", id);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/user/trip/{id}/updatePackingItemStatus")
    @ResponseBody
    public ResponseEntity<?> updatePackingItemStatus(@PathVariable Long id,
                                                @RequestParam("name") String name,
                                                @RequestParam("checked") boolean checked) {
        log.info("Updating packing item status for trip {}: name={}, checked={}", id, name, checked);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null && trip.getPackingList() != null) {
            PackingItem itemToUpdate = trip.getPackingList().stream()
                .filter(item -> item.getName().equals(name))
                .findFirst()
                .orElse(null);
            
            if (itemToUpdate != null) {
                itemToUpdate.setChecked(checked);
                tripService.save(trip);
                log.info("Successfully updated packing item status for trip {}", id);
                return ResponseEntity.ok().build();
            } else {
                log.error("Packing item {} not found in trip {}", name, id);
                return ResponseEntity.notFound().build();
            }
        } else {
            log.error("Trip with ID {} not found or has no packing list", id);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/user/trip/{id}/deletePackingItem")
    @ResponseBody
    public ResponseEntity<?> deletePackingItem(@PathVariable Long id,
                                          @RequestParam("name") String name) {
        log.info("Deleting packing item for trip {}: name={}", id, name);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null && trip.getPackingList() != null) {
            PackingItem itemToDelete = trip.getPackingList().stream()
                .filter(item -> item.getName().equals(name))
                .findFirst()
                .orElse(null);
            
            if (itemToDelete != null) {
                trip.getPackingList().remove(itemToDelete);
                tripService.save(trip);
                log.info("Successfully deleted packing item from trip {}", id);
                return ResponseEntity.ok().build();
            } else {
                log.error("Packing item {} not found in trip {}", name, id);
                return ResponseEntity.notFound().build();
            }
        } else {
            log.error("Trip with ID {} not found or has no packing list", id);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/user/trip/{id}/deleteItinerary")
    @ResponseBody
    public ResponseEntity<?> deleteItinerary(@PathVariable Long id,
                                           @RequestParam("day") int day,
                                           @RequestParam("title") String title,
                                           @RequestParam("location") String location,
                                           @RequestParam("description") String description) {
        log.info("Deleting itinerary item for trip {}: day={}, title={}, location={}", id, day, title, location);
        
        Trip trip = tripService.getTripById(id);
        if (trip != null && trip.getItinerary() != null) {
            ItineraryItem itemToDelete = trip.getItinerary().stream()
                .filter(item -> item.getDay() == day && 
                              item.getTitle().equals(title) && 
                              item.getLocation().equals(location) && 
                              item.getDescription().equals(description))
                .findFirst()
                .orElse(null);
            
            if (itemToDelete != null) {
                trip.getItinerary().remove(itemToDelete);
                tripService.save(trip);
                log.info("Successfully deleted itinerary item from trip {}", id);
                return ResponseEntity.ok().build();
            } else {
                log.error("Itinerary item not found in trip {}", id);
                return ResponseEntity.notFound().build();
            }
        } else {
            log.error("Trip with ID {} not found or has no itinerary", id);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/user/lists")
    public String showLists(Model model) {
        List<Trip> trips = tripService.getAllTrips();
        model.addAttribute("trips", trips);
        return "Lists";
    }

    @PostMapping("/user/trip/{id}/delete")
    public String deleteTrip(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails userDetails, RedirectAttributes redirectAttributes) {
        User user = userDetails.getUser();
        log.info("Deleting trip with ID: {} for user: {}", id, user.getEmail());
        tripService.deleteTripForUser(id, user);
        redirectAttributes.addFlashAttribute("message", "Trip deleted successfully!");
        return "redirect:/user/homepage";
    }
}
