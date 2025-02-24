package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.example.demo.model.Trip;
import com.example.demo.repository.TripRepository;

@Service
public class TripService {

    @Autowired
    private TripRepository tripRepo;
    
    public Trip save(Trip trip) {
        return tripRepo.save(trip);
    }
    
    // You can add methods to retrieve or delete trips as needed.
}
