document.addEventListener('DOMContentLoaded', function() {
    showLoading();
    // First, try to update any missing coordinates
    updateMissingCoordinates().then(() => {
        initializeMap();
    });
});

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading trip data...';
    document.querySelector('.map-section').appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.querySelector('.loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

async function updateMissingCoordinates() {
    try {
        const response = await fetch('/api/trips/update-coordinates');
        if (!response.ok) {
            console.warn('Failed to update coordinates:', await response.text());
        }
    } catch (error) {
        console.error('Error updating coordinates:', error);
    }
}

let map;
let markers = [];
let markerCluster;

function initializeMap() {
    // Initialize the map
    map = new google.maps.Map(document.getElementById('summary-map'), {
        center: MapConfig.defaultCenter,
        zoom: MapConfig.defaultZoom,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });
    
    // Fetch trip data and add markers
    fetchTripData().then(trips => {
        let hasValidMarkers = false;
        const bounds = new google.maps.LatLngBounds();
        markers = [];
        
        trips.forEach(trip => {
            if (trip.latitude && trip.longitude && 
                !isNaN(trip.latitude) && !isNaN(trip.longitude)) {
                const position = new google.maps.LatLng(trip.latitude, trip.longitude);
                bounds.extend(position);
                
                const marker = new google.maps.Marker({
                    position: position,
                    map: map,
                    title: trip.destination,
                    animation: google.maps.Animation.DROP
                });
                
                // Add info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div class='custom-gm-infowindow'>
                        <div class='infowindow-title'>${trip.destination}</div>
                        <div class='infowindow-dates'>${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}</div>
                    </div>`
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });
                
                markers.push(marker);
                hasValidMarkers = true;
            } else {
                console.warn('Invalid coordinates for trip:', trip.destination);
            }
        });
        
        // Use the new MarkerClusterer
        if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
            const { MarkerClusterer } = window.markerClusterer;
            markerCluster = new MarkerClusterer({
                map,
                markers
            });
        }
        
        // Fit map bounds to show all markers if we have any
        if (hasValidMarkers) {
            map.fitBounds(bounds);
            setTimeout(() => {
                const currentZoom = map.getZoom();
                if (currentZoom > 15) {
                    map.setZoom(15);
                }
            }, 100);
        } else {
            // If no valid markers, show a message
            const noMarkersDiv = document.createElement('div');
            noMarkersDiv.className = 'no-markers-message';
            noMarkersDiv.innerHTML = 'No trip locations available to display on the map.';
            document.querySelector('.map-section').appendChild(noMarkersDiv);
        }
        
        hideLoading();
    });
}

async function fetchTripData() {
    try {
        const response = await fetch('/api/trips/summary');
        if (!response.ok) {
            throw new Error('Failed to fetch trip data');
        }
        const data = await response.json();
        console.log('Fetched trip data:', data); // Add logging
        return data;
    } catch (error) {
        console.error('Error fetching trip data:', error);
        hideLoading();
        return [];
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
} 