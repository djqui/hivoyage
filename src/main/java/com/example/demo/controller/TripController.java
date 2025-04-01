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
import com.example.demo.model.Trip;
import com.example.demo.model.ItineraryItem;
import com.example.demo.model.PackingItem;
import com.example.demo.service.TripService;
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
    public String saveTrip(Trip trip, RedirectAttributes redirectAttributes) {
        tripService.save(trip);
        redirectAttributes.addFlashAttribute("message", "Trip has been saved successfully!");
        log.info("Trip saved: {}", trip);
        return "redirect:/user/homepage";
    }

    // Display all trips on the homepage
    @GetMapping("/user/homepage")
    public String showTrips(Model model) {
        log.info("Handling homepage request");
        List<Trip> trips = tripService.getAllTrips();
        log.info("Retrieved {} trips from service", trips.size());

        List<Trip> tripsWithCountdown = trips.stream().map(trip -> {
            if (trip.getStartDate() != null) {
                long daysUntilTrip = ChronoUnit.DAYS.between(LocalDate.now(), trip.getStartDate());
                daysUntilTrip = Math.max(daysUntilTrip, 0); // Avoid negative countdowns
                trip.setCountdown("D-" + daysUntilTrip);
                log.info("Trip {}: Set countdown to {}", trip.getDestination(), trip.getCountdown());
            } else {
                trip.setCountdown("Date not set");
                log.info("Trip {}: No start date set", trip.getDestination());
            }
            return trip;
        }).collect(Collectors.toList());

        model.addAttribute("trips", tripsWithCountdown);
        log.info("Added {} trips to model", tripsWithCountdown.size());
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
}
