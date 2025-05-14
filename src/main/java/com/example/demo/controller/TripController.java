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
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

@Controller
@Slf4j
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    // Display the new trip form
    @GetMapping("/user/newtrip")
    public String showNewTrip(@AuthenticationPrincipal CustomUserDetails userDetails, Model model) {
        model.addAttribute("trip", new Trip());
        if (userDetails != null) {
            model.addAttribute("user", userDetails.getUser());
        }
        return "Newtrip";
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
        model.addAttribute("user", user);
    
        return "TripDetails";
    }
    
    @PostMapping("/user/trip/{id}/saveItinerary")
    public String saveItinerary(@PathVariable Long id, @RequestParam("day") int day,
                               @RequestParam("title") String title,
                               @RequestParam("location") String location,
                               @RequestParam("description") String description,
                               @AuthenticationPrincipal CustomUserDetails userDetails,
                               RedirectAttributes redirectAttributes) {
        log.info("Saving itinerary item for trip {}: day={}, title={}, location={}", id, day, title, location);
        
        saveItineraryItem(id, day, title, location, description, userDetails.getUser());
        redirectAttributes.addFlashAttribute("message", "Itinerary item saved successfully!");
        return "redirect:/user/trip/" + id;
    }
    
    @PostMapping("/user/trip/{id}/saveItineraryAjax")
    @ResponseBody
    public ResponseEntity<?> saveItineraryAjax(@PathVariable Long id, 
                                           @RequestParam("day") int day,
                                           @RequestParam("title") String title,
                                           @RequestParam("location") String location,
                                           @RequestParam("description") String description,
                                           @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("Saving itinerary item via AJAX for trip {}: day={}, title={}, location={}, description={}", 
                id, day, title, location, description);
        
        if (userDetails == null) {
            log.error("User details is null! Authentication issue detected.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("User not authenticated");
        }
        
        User user = userDetails.getUser();
        log.info("Authenticated user: {}", user.getEmail());
        
        try {
            boolean success = saveItineraryItem(id, day, title, location, description, user);
            if (success) {
                log.info("Successfully saved itinerary item via AJAX");
                return ResponseEntity.ok().body("Item saved successfully");
            } else {
                log.error("Failed to save item: Trip not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Trip not found");
            }
        } catch (Exception e) {
            log.error("Exception while saving itinerary item: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error saving item: " + e.getMessage());
        }
    }
    
    private boolean saveItineraryItem(Long id, int day, String title, String location, String description, User user) {
        Trip trip = tripService.getTripByIdForUser(id, user);
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
            tripService.saveWithoutDateCheck(trip, user);
            log.info("Successfully saved itinerary item for trip {}", id);
            return true;
        } else {
            log.error("Trip with ID {} not found", id);
            return false;
        }
    }

    @PostMapping("/user/trip/{id}/deleteDay")
    public String deleteDay(@PathVariable Long id, 
                          @RequestParam("day") int day,
                          @AuthenticationPrincipal CustomUserDetails userDetails,
                           RedirectAttributes redirectAttributes) {
        log.info("Deleting day {} from trip {}", day, id);
        
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
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
            tripService.saveWithoutDateCheck(trip, user);
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
                                        @RequestParam("checked") boolean checked,
                                        @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("Saving packing item for trip {}: name={}, checked={}", id, name, checked);
        
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
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
            tripService.saveWithoutDateCheck(trip, user);
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
                                          @RequestParam("oldName") String oldName,
                                          @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("Updating packing item for trip {}: oldName={}, newName={}, checked={}", id, oldName, name, checked);
        
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
        if (trip != null && trip.getPackingList() != null) {
            PackingItem itemToUpdate = trip.getPackingList().stream()
                .filter(item -> item.getName().equals(oldName))
                .findFirst()
                .orElse(null);
            
            if (itemToUpdate != null) {
                itemToUpdate.setName(name);
                itemToUpdate.setChecked(checked);
                tripService.saveWithoutDateCheck(trip, user);
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
                                                @RequestParam("checked") boolean checked,
                                                @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("Updating packing item status for trip {}: name={}, checked={}", id, name, checked);
        
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
        if (trip != null && trip.getPackingList() != null) {
            PackingItem itemToUpdate = trip.getPackingList().stream()
                .filter(item -> item.getName().equals(name))
                .findFirst()
                .orElse(null);
            
            if (itemToUpdate != null) {
                itemToUpdate.setChecked(checked);
                tripService.saveWithoutDateCheck(trip, user);
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
                                          @RequestParam("name") String name,
                                          @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("Deleting packing item for trip {}: name={}", id, name);
        
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
        if (trip != null && trip.getPackingList() != null) {
            PackingItem itemToDelete = trip.getPackingList().stream()
                .filter(item -> item.getName().equals(name))
                .findFirst()
                .orElse(null);
            
            if (itemToDelete != null) {
                trip.getPackingList().remove(itemToDelete);
                tripService.saveWithoutDateCheck(trip, user);
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
                                           @RequestParam("description") String description,
                                           @AuthenticationPrincipal CustomUserDetails userDetails) {
        log.info("Deleting itinerary item for trip {}: day={}, title={}, location={}", id, day, title, location);
        
        User user = userDetails.getUser();
        Trip trip = tripService.getTripByIdForUser(id, user);
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
                tripService.saveWithoutDateCheck(trip, user);
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
    public String showLists(@AuthenticationPrincipal CustomUserDetails userDetails, Model model) {
        User user = userDetails.getUser();
        List<Trip> trips = tripService.getAllTripsForUser(user);
        model.addAttribute("trips", trips);
        model.addAttribute("user", user);
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

    @GetMapping("/user/trip-summary")
    public String showTripSummary(@AuthenticationPrincipal CustomUserDetails userDetails, Model model) {
        User user = userDetails.getUser();
        List<Trip> trips = tripService.getAllTripsForUser(user);
        
        // Calculate statistics
        long totalTripDays = trips.stream()
            .filter(trip -> trip.getStartDate() != null && trip.getEndDate() != null)
            .mapToLong(trip -> ChronoUnit.DAYS.between(trip.getStartDate(), trip.getEndDate()) + 1)
            .sum();
            
        // Get unique countries visited
        long countriesVisited = trips.stream()
            .map(Trip::getDestination)
            .distinct()
            .count();
            
        // Find next trip
        LocalDate today = LocalDate.now();
        long daysUntilNextTrip = trips.stream()
            .filter(trip -> trip.getStartDate() != null && trip.getStartDate().isAfter(today))
            .mapToLong(trip -> ChronoUnit.DAYS.between(today, trip.getStartDate()))
            .min()
            .orElse(0);
            
        model.addAttribute("trips", trips);
        model.addAttribute("totalTripDays", totalTripDays);
        model.addAttribute("countriesVisited", countriesVisited);
        model.addAttribute("daysUntilNextTrip", daysUntilNextTrip);
        model.addAttribute("user", user);
        
        return "TripSummary";
    }
    
    @GetMapping("/api/trips/summary")
    @ResponseBody
    public ResponseEntity<?> getTripSummaryData(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userDetails.getUser();
        List<Trip> trips = tripService.getAllTripsForUser(user);
        
        List<Map<String, Object>> tripData = trips.stream()
            .map(trip -> {
                Map<String, Object> data = new HashMap<>();
                data.put("destination", trip.getDestination());
                data.put("startDate", trip.getStartDate());
                data.put("endDate", trip.getEndDate());
                data.put("latitude", trip.getLatitude());
                data.put("longitude", trip.getLongitude());
                return data;
            })
            .collect(Collectors.toList());
            
        return ResponseEntity.ok(tripData);
    }

    @GetMapping("/api/trips/update-coordinates")
    @ResponseBody
    public ResponseEntity<?> updateTripCoordinates(@AuthenticationPrincipal CustomUserDetails userDetails) {
        try {
            tripService.updateMissingCoordinates();
            return ResponseEntity.ok().body("Coordinates updated successfully");
        } catch (Exception e) {
            log.error("Error updating coordinates: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error updating coordinates: " + e.getMessage());
        }
    }
}
