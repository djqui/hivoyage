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

function initializeMap() {
    // Initialize the map
    const map = L.map('summary-map').setView([0, 0], 2);
    
    // Add the tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add marker cluster plugin
    const markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    
    // Fetch trip data and add markers
    fetchTripData().then(trips => {
        let hasValidMarkers = false;
        
        trips.forEach(trip => {
            if (trip.latitude && trip.longitude && 
                !isNaN(trip.latitude) && !isNaN(trip.longitude)) {
                const marker = L.marker([trip.latitude, trip.longitude])
                    .bindPopup(`
                        <strong>${trip.destination}</strong><br>
                        ${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}
                    `);
                markers.addLayer(marker);
                hasValidMarkers = true;
            } else {
                console.warn('Invalid coordinates for trip:', trip.destination);
            }
        });
        
        map.addLayer(markers);
        
        // Fit map bounds to show all markers if we have any
        if (hasValidMarkers) {
            map.fitBounds(markers.getBounds().pad(0.1));
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
        return await response.json();
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