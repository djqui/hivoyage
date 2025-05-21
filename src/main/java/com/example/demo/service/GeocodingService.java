package com.example.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class GeocodingService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private static final String NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

    public GeocodingService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        
        // Add User-Agent header to comply with OpenStreetMap's usage policy
        restTemplate.getInterceptors().add((request, body, execution) -> {
            HttpHeaders headers = request.getHeaders();
            headers.set("User-Agent", "HiVoyage/1.0");
            return execution.execute(request, body);
        });
    }

    public Coordinates getCoordinates(String destination) {
        try {
            String url = String.format("%s?q=%s&format=json&limit=1", 
                NOMINATIM_API_URL, 
                java.net.URLEncoder.encode(destination, "UTF-8"));

            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());

            if (root.isArray() && root.size() > 0) {
                JsonNode firstResult = root.get(0);
                double lat = firstResult.get("lat").asDouble();
                double lon = firstResult.get("lon").asDouble();
                return new Coordinates(lat, lon);
            }
        } catch (Exception e) {
            log.error("Error geocoding destination: {}", destination, e);
        }
        return null;
    }

    public static class Coordinates {
        private final double latitude;
        private final double longitude;

        public Coordinates(double latitude, double longitude) {
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public double getLatitude() { return latitude; }
        public double getLongitude() { return longitude; }
    }
} 