// Add this at the beginning of the file
document.addEventListener('DOMContentLoaded', function() {
    // Verify Font Awesome is loaded
    console.log('Checking if Font Awesome is loaded...');
    const fontAwesomeTest = document.createElement('i');
    fontAwesomeTest.className = 'fas fa-user';
    fontAwesomeTest.style.visibility = 'hidden';
    document.body.appendChild(fontAwesomeTest);

    // Check if Font Awesome is applying styles
    const computedStyle = window.getComputedStyle(fontAwesomeTest);
    const isLoaded = computedStyle.fontFamily.includes('Font Awesome') || 
                    (computedStyle.width !== '0px' && computedStyle.content !== 'none');

    console.log('Font Awesome loaded:', isLoaded);
    document.body.removeChild(fontAwesomeTest);

    // If not loaded, try to reload the stylesheet
    if (!isLoaded) {
        console.log('Attempting to reload Font Awesome...');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css';
        document.head.appendChild(link);
    }
    
    // Add CSS for Google Places Autocomplete dropdown
    const style = document.createElement('style');
    style.textContent = `
        .pac-container {
            z-index: 10000 !important;
            font-family: var(--font);
            border-radius: 8px;
            border: 1px solid var(--border);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .pac-item {
            padding: 8px;
            cursor: pointer;
        }
        .pac-item:hover {
            background-color: rgba(221, 37, 37, 0.05);
        }
        .pac-item-selected, .pac-item-selected:hover {
            background-color: rgba(221, 37, 37, 0.1);
        }
        .pac-icon {
            margin-right: 8px;
        }
        .pac-matched {
            font-weight: bold;
            color: var(--secclr);
        }
    `;
    document.head.appendChild(style);

    // Initialize the itinerary progress
    updateItineraryProgress();

    // Initialize the map
    initTripMap();

    // Add event listeners to the stop select dropdowns
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');

    if (startStopSelect && endStopSelect) {
        startStopSelect.addEventListener('change', handleStopSelectChange);
        endStopSelect.addEventListener('change', handleStopSelectChange);
    }
});

// Global CSRF token handling
function addCsrfToken(options = {}) {
    try {
        const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        
        if (!options.headers) {
            options.headers = {};
        }
        
        if (csrfToken && csrfHeader) {
            console.log('CSRF token found, adding to request:', { header: csrfHeader });
            options.headers[csrfHeader] = csrfToken;
        } else {
            console.log('No CSRF token found, proceeding without it');
        }
    } catch (error) {
        console.error('Error adding CSRF token:', error);
    }
    
    return options;
}

// Helper function for making fetch requests with CSRF token
async function fetchWithCsrf(url, options = {}) {
    const fetchOptions = addCsrfToken(options);
    
    console.log(`Making ${options.method || 'GET'} request to ${url}`);
    
    try {
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorJson = await response.json();
                console.error(`Error response (${response.status}):`, errorJson);
                throw new Error(`Request failed with status ${response.status}: ${JSON.stringify(errorJson)}`);
            } else {
                const errorText = await response.text();
                console.error(`Error response (${response.status}): ${errorText}`);
                throw new Error(`Request failed with status ${response.status}: ${errorText}`);
            }
        }
        
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// itinerary functions
function addItineraryDay() {
    const itinerary = document.getElementById("itinerary");
    // Get number of existing day containers instead of all children
    const existingDayContainers = itinerary.querySelectorAll('.day-container');
    const dayNum = existingDayContainers.length + 1;
    
    const today = new Date();
    const date = new Date(today);
    date.setDate(date.getDate() + dayNum - 1);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    let dayDiv = document.createElement("div");
    dayDiv.className = "day-container";
    dayDiv.dataset.day = dayNum;
    dayDiv.innerHTML = `
        <div class="day-header" onclick="toggleDay(this)">
            <div class="day-info">
                <i class="fas fa-chevron-down"></i>
                <div class="day-title">
                    <span class="day-text">Day ${dayNum}</span>
                    <span class="day-date">${formattedDate}</span>
                </div>
            </div>
            <div class="day-actions">
                <button type="button" class="delete-day-btn" onclick="deleteDay(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="day-content">
            <ul class="stops" id="stops-day-${dayNum}"></ul>
            <button type="button" class="add-place-btn" onclick="addStop(this, ${dayNum})">
                <i class="fas fa-plus"></i>
                Add a place
            </button>
        </div>
    `;
    itinerary.appendChild(dayDiv);
    updateItineraryProgress();
    
    // Update the UI to reflect changes in the calendar 
    if (typeof updateCalendarWithItinerary === 'function') {
        setTimeout(updateCalendarWithItinerary, 300);
    }
}

let map;
let markers = [];
let directionsService;
let directionsRenderer;
let activeRoute = null; // To store the currently displayed route details
let currentDayStops = []; // To store the stop data for the currently toggled day

function initTripMap() {
    const mapElement = document.getElementById('trip-map');
    if (!mapElement) return;
    
    // Initialize the map
    map = new google.maps.Map(mapElement, {
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
    
    // Initialize directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#dd2525',
            strokeWeight: 4,
            strokeOpacity: 0.7
        }
    });
    
    // Get destination from the page
    const destination = document.querySelector('.trip-header h1').textContent.trim();
    if (destination) {
        focusMapOnDestination(destination);
    }
}

function focusMapOnDestination(destination) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: destination }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            map.setCenter(location);
            map.setZoom(10);
            
            // Add marker for destination
            const marker = new google.maps.Marker({
                position: location,
                map: map,
                title: destination
            });
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `<div class='custom-gm-infowindow'>
                    <div class='infowindow-title'>${destination}</div>
                    <div class='infowindow-address'>${location}</div>
                </div>`
            });
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
            infoWindow.open(map, marker);
        } else {
            console.warn('Could not geocode destination:', destination);
        }
    });
}

function toggleDay(header) {
    const dayContainer = header.closest('.day-container');
    const content = dayContainer.querySelector('.day-content');
    const chevron = header.querySelector('.fa-chevron-down');
    const dayNumber = dayContainer.dataset.day;
    
    if (dayContainer.classList.contains('collapsed')) {
        // Collapse all other days
        document.querySelectorAll('.day-container').forEach(container => {
            if (container !== dayContainer && !container.classList.contains('collapsed')) {
                const otherContent = container.querySelector('.day-content');
                const otherChevron = container.querySelector('.fa-chevron-down');
                otherContent.style.display = 'none';
                otherChevron.style.transform = 'rotate(-90deg)';
                container.classList.add('collapsed');
            }
        });
        
        // Expand this day
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
        dayContainer.classList.remove('collapsed');
        
        // Populate stop dropdowns and focus map
        populateStopDropdowns(content);
        focusMapOnDay(content);
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
        dayContainer.classList.add('collapsed');
        
        // Clear dropdowns and show/focus on destination pin
        clearStopDropdowns();
        clearMap();
        const destination = document.querySelector('.trip-header h1').textContent.trim();
        focusMapOnDestination(destination);
    }
}

// New function to focus map on stops of the expanded day
function focusMapOnDay(dayContentElement) {
    const stops = dayContentElement.querySelectorAll('.stop-item');
    currentDayStops = []; // Clear previous day's stops
            if (stops.length > 0) {
        // Clear existing markers and route
        clearMap();
        
        // Process stops
        const bounds = new google.maps.LatLngBounds();
        
        stops.forEach((stop, index) => {
                    const location = stop.querySelector('.stop-address').textContent;
                                    const stopName = stop.querySelector('.stop-name').textContent;
                                    const stopTime = stop.querySelector('.stop-time').textContent;
            
            // Store stop data
            currentDayStops.push({
                name: stopName,
                address: location,
                time: stopTime
            });
            
            if (location) {
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ address: location }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const position = results[0].geometry.location;
                        bounds.extend(position);
                        
                        // Add marker
                        const marker = new google.maps.Marker({
                            position: position,
                            map: map,
                            title: stopName
                        });
                        markers.push(marker);
                        
                        // Add info window
                        const infoWindow = new google.maps.InfoWindow({
                            content: `<div class='custom-gm-infowindow'>
                                <div class='infowindow-title'>${stopName}</div>
                                <div class='infowindow-address'>${location}</div>
                                <div class='infowindow-time'>${stopTime ? 'Time: ' + stopTime : ''}</div>
                            </div>`
                        });
                        marker.addListener('click', () => {
                            infoWindow.open(map, marker);
                        });
                        
                        // Add stop label
                        const label = new google.maps.Marker({
                            position: position,
                            map: map,
                            label: {
                                text: `${index + 1}`,
                                color: '#fff',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            },
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 15,
                                fillColor: '#dd2525',
                                fillOpacity: 1,
                                strokeWeight: 0
                            },
                            zIndex: 500 // Ensure label is above the pin
                        });
                        markers.push(label);
                        
                        // If this is the last stop processed, fit bounds
                        if (index === stops.length - 1) {
                            map.fitBounds(bounds);
                        }
                    }
                });
            }
        });
    }
}

function clearMap() {
    // Clear markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Clear route
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }
    activeRoute = null;
    // Clear route options display
    document.getElementById('route-options-display').innerHTML = '';
    // Clear selected stops info
    document.getElementById('selected-stops-info').innerHTML = '';
}

// New function to populate stop dropdowns
function populateStopDropdowns(dayContentElement) {
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');
    const stops = dayContentElement.querySelectorAll('.stop-item');
    
    // Clear previous options
    startStopSelect.innerHTML = '<option value=\"\">Choose Stop 1</option>';
    endStopSelect.innerHTML = '<option value=\"\">Choose Stop 2</option>'; // Updated text
    
    stops.forEach((stop, index) => {
        const stopName = stop.querySelector('.stop-name').textContent;
        const option = `<option value=\"${index}\">${stopName}</option>`;
        startStopSelect.innerHTML += option;
        endStopSelect.innerHTML += option;
    });
}

// New function to clear stop dropdowns
function clearStopDropdowns() {
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');
    startStopSelect.innerHTML = '<option value=\"\">Choose Stop 1</option>';
    endStopSelect.innerHTML = '<option value=\"\">Choose Stop 2</option>'; // Updated text
    document.getElementById('selected-stops-info').innerHTML = ''; // Clear selected stops info
}

// New function to handle dropdown changes and trigger route options fetch
function handleStopSelectChange() {
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');

    if (startStopSelect.value !== '' && endStopSelect.value !== '') {
        getRouteOptions();
        displaySelectedStopsInfo(); // Display selected stop names and times
    } else {
         document.getElementById('route-options-display').innerHTML = ''; // Clear options if selection is incomplete
         document.getElementById('selected-stops-info').innerHTML = ''; // Clear selected stops info
    }
}

// New function to display selected stop names and times
function displaySelectedStopsInfo() {
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');
    const selectedStopsInfoDiv = document.getElementById('selected-stops-info');

    const startStopIndex = parseInt(startStopSelect.value);
    const endStopIndex = parseInt(endStopSelect.value);

    if (startStopIndex >= 0 && endStopIndex >= 0 && currentDayStops.length > 0) {
        const startStop = currentDayStops[startStopIndex];
        const endStop = currentDayStops[endStopIndex];

        selectedStopsInfoDiv.innerHTML = `
            ${startStop.name} &rarr; ${endStop.name}<br>
            ${startStop.time ? startStop.time : 'N/A'} &rarr; ${endStop.time ? endStop.time : 'N/A'}
        `;
                    } else {
        selectedStopsInfoDiv.innerHTML = '';
    }
}

// New function to get route options between selected stops
async function getRouteOptions() {
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');
    const routeOptionsDisplay = document.getElementById('route-options-display');
    
    const startStopIndex = startStopSelect.value;
    const endStopIndex = endStopSelect.value;
    
    if (startStopIndex === '' || endStopIndex === '') {
        alert('Please select both a start and an end stop.');
        return;
    }
    
    if (startStopIndex === endStopIndex) {
        alert('Start and end stops cannot be the same.');
        return;
    }
    
    // Get the stop elements from the currently expanded day
    const expandedDayContent = document.querySelector('.day-container:not(.collapsed) .day-content');
    if (!expandedDayContent) return; // Should not happen if dropdowns are populated
    
    const stops = expandedDayContent.querySelectorAll('.stop-item');
    const startStop = stops[parseInt(startStopIndex)];
    const endStop = stops[parseInt(endStopIndex)];
    
    const origin = startStop.querySelector('.stop-address').textContent;
    const destination = endStop.querySelector('.stop-address').textContent;
    
    if (!origin || !destination) {
        alert('Could not get addresses for selected stops.');
        return;
    }
    
    routeOptionsDisplay.innerHTML = 'Loading route options...';
    
    const travelModes = ['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT'];
    const promises = travelModes.map(mode => getRoute(origin, destination, mode));
    
    const results = await Promise.all(promises);
    
    routeOptionsDisplay.innerHTML = ''; // Clear loading message
    let optionsFound = false;
    let foundRoutes = [];
    
    // First, collect all valid routes
    results.forEach((result, index) => {
        const mode = travelModes[index];
        if (result && result.routes && result.routes.length > 0) {
            const route = result.routes[0]; // Get the first route option
            const leg = route.legs[0]; // Assuming a simple A to B route
            
            // Fix: Skip transit option if it's actually just a walking route
            if (mode === 'TRANSIT' && leg.steps) {
                // Check if all steps are WALKING mode
                const onlyWalking = leg.steps.every(step => step.travel_mode === "WALKING");
                if (onlyWalking) {
                    console.log('Skipping transit option that is actually walking');
                    return; // Skip this result
                }
            }
            
            const duration = leg.duration.text;
            const durationMinutes = Math.round(leg.duration.value / 60);
            let formattedDuration = duration;
            
            // Format duration more consistently (1 hour 7 mins, 32 mins, etc.)
            if (durationMinutes >= 60) {
                const hours = Math.floor(durationMinutes / 60);
                const mins = durationMinutes % 60;
                formattedDuration = `${hours} hour${hours > 1 ? 's' : ''} ${mins} mins`;
            } else {
                formattedDuration = `${durationMinutes} mins`;
            }
            
            const distance = leg.distance.text;
            const speed = calculateSpeed(leg.distance.value, leg.duration.value); // Values are in meters and seconds
            const cost = estimateCost(mode, leg.distance.value, leg.duration.value, route.fare); // Pass fare if available
            
            foundRoutes.push({
                mode,
                speed,
                cost,
                duration: formattedDuration,
                durationValue: leg.duration.value, // For determining best route
                result
            });
            
            optionsFound = true;
        }
    });
    
    // Find the best route (shortest duration)
    let bestRoute = null;
    if (foundRoutes.length > 0) {
        bestRoute = foundRoutes.reduce((prev, current) => 
            prev.durationValue < current.durationValue ? prev : current
        );
    }
    
    // Now display the routes in order, with the best one on top
    if (foundRoutes.length > 0) {
        // First display the best route
        foundRoutes.forEach((route, index) => {
            const isBest = route.mode === bestRoute.mode;
            
            const optionHtml = `
                <div class="route-option ${isBest ? 'selected' : ''}" data-mode="${route.mode}" ${isBest ? 'data-best="true"' : ''}>
                    <span class="mode-icon">${getModeIcon(route.mode)}</span>
                    <span class="route-speed">${route.speed} km/h</span>
                    <span class="route-cost">${route.cost}</span>
                    <span class="route-duration">${route.duration}</span>
                    <button class="display-route-btn" data-mode="${route.mode}" style="display:none;">Show</button>
                </div>
            `;
            
            routeOptionsDisplay.innerHTML += optionHtml;
        });
        
        // Sort the options to ensure best route is first
        const routeOptions = Array.from(routeOptionsDisplay.querySelectorAll('.route-option'));
        routeOptions.sort((a, b) => {
            if (a.hasAttribute('data-best')) return -1;
            if (b.hasAttribute('data-best')) return 1;
            return 0;
        });
        
        // Clear container and add sorted elements
        routeOptionsDisplay.innerHTML = '';
        routeOptions.forEach(option => routeOptionsDisplay.appendChild(option));
    } else {
        routeOptionsDisplay.innerHTML = 'No route options found between the selected stops.';
    }
    
    // Add event listeners to the display route buttons
    document.querySelectorAll('.display-route-btn').forEach(button => {
        button.addEventListener('click', displayRouteOnMap);
    });
    
    // Add event listeners to the route options for selection
    document.querySelectorAll('.route-option').forEach(option => {
        option.addEventListener('click', function() {
            const button = this.querySelector('.display-route-btn');
            if (button) button.click();
        });
    });
}

// New function to get a route for a specific mode
function getRoute(origin, destination, travelMode) {
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode[travelMode]
    };
    
    return new Promise((resolve, reject) => {
        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                resolve(result);
            } else {
                console.warn(`Directions request for ${travelMode} failed: ${status}`);
                resolve(null); // Resolve with null if route not found
            }
        });
    });
}

// New function to calculate speed (in km/h)
function calculateSpeed(distanceInMeters, durationInSeconds) {
    if (durationInSeconds === 0) return 0;
    const distanceInKm = distanceInMeters / 1000;
    const durationInHours = durationInSeconds / 3600;
    return (distanceInKm / durationInHours).toFixed(1);
}

// New function to estimate cost
function estimateCost(travelMode, distanceInMeters, durationInSeconds, fare) {
    // Always prioritize Google-provided fare information when available
    if (fare) {
        console.log(`Using Google-provided fare: ${fare.text}`);
        return fare.text;
    }
    
    // Fallback to our own estimates when Google doesn't provide fare info
    console.log(`No Google fare data, using custom estimates for ${travelMode}`);
    
    // Simple default cost estimation
    const distanceInKm = distanceInMeters / 1000;
    
    // Check if the location might be in the Philippines
    const isPhilippines = checkIfPhilippines();
    
    switch (travelMode) {
        case 'DRIVING':
            if (isPhilippines) {
                // Apply the taxi pricing model to driving instead
                return `₱${(40 + distanceInKm * 13.50).toFixed(2)}`;
            } else {
                // Generic taxi estimate for other countries
                return `$${(3 + distanceInKm * 1).toFixed(2)}`;
            }
        case 'BICYCLING':
            return 'Free';
        case 'TRANSIT':
            return 'Varies';
        case 'WALKING':
            return 'Free';
        default:
            return 'Unknown';
    }
}

// Helper function to check if current location is likely in the Philippines
function checkIfPhilippines() {
    // Try to detect Philippines from address elements on the page
    const expandedDayContent = document.querySelector('.day-container:not(.collapsed) .day-content');
    if (!expandedDayContent) return false;
    
    const addresses = Array.from(expandedDayContent.querySelectorAll('.stop-address'))
        .map(el => el.textContent.toLowerCase());
    
    // Check for Philippines location indicators
    const philippinesKeywords = ['philippines', 'manila', 'cebu', 'quezon', 'davao', 'ph,', 
                                 'makati', 'pasig', 'taguig', 'pasay', 'baguio', 'iloilo'];
    
    // Return true if any address contains Philippines keywords
    return addresses.some(address => 
        philippinesKeywords.some(keyword => address.includes(keyword))
    );
}

// New function to get mode icon (simple example)
function getModeIcon(travelMode) {
    switch (travelMode) {
        case 'DRIVING': return '<i class="fas fa-taxi"></i>';
        case 'BICYCLING': return '<i class="fas fa-biking"></i>';
        case 'TRANSIT': return '<i class="fas fa-train"></i>';
        case 'WALKING': return '<i class="fas fa-walking"></i>';
        default: return '';
    }
}

// New function to display a selected route on the map
function displayRouteOnMap(event) {
    const button = event.target.closest('.display-route-btn');
    const mode = button.dataset.mode;
    const routeOptionDiv = button.closest('.route-option');
    
    // Clear previous route
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }
    activeRoute = null;
    
    // Set different polyline options based on the transport mode
    let polylineOptions;
    switch(mode) {
        case 'WALKING':
            polylineOptions = {
                strokeColor: '#4CAF50', // Green for walking
                strokeWeight: 4,
                strokeOpacity: 0.7,
                strokePattern: [
                    { interval: "10px" } // Dashed line for walking
                ]
            };
            break;
        case 'BICYCLING':
            polylineOptions = {
                strokeColor: '#FF9800', // Orange for biking
                strokeWeight: 4,
                strokeOpacity: 0.7
            };
            break;
        case 'TRANSIT':
            polylineOptions = {
                strokeColor: '#2196F3', // Blue for transit
                strokeWeight: 5,
                strokeOpacity: 0.8
            };
            break;
        case 'DRIVING':
        default:
            polylineOptions = {
                strokeColor: '#dd2525', // Default red
                strokeWeight: 4,
                strokeOpacity: 0.7
            };
    }
    
    // Update renderer with new polyline options
    directionsRenderer.setOptions({
        polylineOptions: polylineOptions,
        suppressMarkers: true // Make sure markers are suppressed
    });
    
    // Get origin and destination again (could store this from getRouteOptions)
    const startStopSelect = document.getElementById('start-stop-select');
    const endStopSelect = document.getElementById('end-stop-select');
    const expandedDayContent = document.querySelector('.day-container:not(.collapsed) .day-content');
    const stops = expandedDayContent.querySelectorAll('.stop-item');
    const startStop = stops[parseInt(startStopSelect.value)];
    const endStop = stops[parseInt(endStopSelect.value)];
    const origin = startStop.querySelector('.stop-address').textContent;
    const destination = endStop.querySelector('.stop-address').textContent;
    
    // Basic request object
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode[mode],
        provideRouteAlternatives: false
    };
    
    // Add transit-specific options if transit mode is selected
    if (mode === 'TRANSIT') {
        // Get current date and time
        const now = new Date();
        
        request.transitOptions = {
            departureTime: now,
            modes: [
                google.maps.TransitMode.BUS,
                google.maps.TransitMode.RAIL,
                google.maps.TransitMode.SUBWAY,
                google.maps.TransitMode.TRAIN,
                google.maps.TransitMode.TRAM
            ],
            routingPreference: google.maps.TransitRoutePreference.FEWER_TRANSFERS
        };
    }
    
    // Show loading state
    routeOptionDiv.style.opacity = "0.7";
    const loadingIndicator = document.createElement('span');
    loadingIndicator.innerHTML = ' <i class="fas fa-spinner fa-spin"></i>';
    loadingIndicator.classList.add('loading-indicator');
    routeOptionDiv.appendChild(loadingIndicator);
    
    directionsService.route(request, (result, status) => {
        // Remove loading indicator
        routeOptionDiv.style.opacity = "1";
        const indicator = routeOptionDiv.querySelector('.loading-indicator');
        if (indicator) indicator.remove();
        
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            activeRoute = result; // Store the displayed route
            
            // Highlight the selected option
            document.querySelectorAll('.route-option').forEach(opt => opt.classList.remove('selected'));
            routeOptionDiv.classList.add('selected');
        } else {
            console.error(`Error displaying route for ${mode}: ${status}`);
            
            if (mode === 'TRANSIT' && status === 'ZERO_RESULTS') {
                alert(`No transit routes available between these locations. Consider trying a different transportation mode.`);
            } else {
                alert(`Could not display route for ${mode}. Status: ${status}`);
            }
        }
    });
}

function getStopOrder(num) {
    switch(num) {
        case 1: return '1';
        case 2: return '2';
        case 3: return '3';
        default: return `${num}`;
    }
}

// Sort stops by time in a specific day container
function sortStops(timeInput) {
    const stopsList = timeInput.closest('.stops');
    sortStopsInContainer(stopsList);
    // Update stop order numbers after sorting
    updateStopOrderNumbers(stopsList);
}

// Sort all stops by time in all day containers
function sortAllStops() {
    const dayContainers = document.querySelectorAll('.day-container');
    dayContainers.forEach(container => {
        const stopsList = container.querySelector('.stops');
        if (stopsList) {
            sortStopsInContainer(stopsList);
            // Update stop order numbers after sorting
            updateStopOrderNumbers(stopsList);
        }
    });
}

// Helper function to sort stops within a container
function sortStopsInContainer(stopsList) {
    const stopItems = Array.from(stopsList.querySelectorAll('li'));
    
    stopItems.sort((a, b) => {
        // Check if the time element is an input or a span
        const timeElementA = a.querySelector('.stop-time');
        const timeElementB = b.querySelector('.stop-time');
        
        // Get time value based on element type
        const timeA = timeElementA.tagName === 'INPUT' ? timeElementA.value : timeElementA.textContent;
        const timeB = timeElementB.tagName === 'INPUT' ? timeElementB.value : timeElementB.textContent;
        
        // Handle potential null/undefined values
        if (!timeA) return 1;
        if (!timeB) return -1;
        
        return timeA.localeCompare(timeB);
    });
    
    // Clear and re-append sorted items
    stopItems.forEach(item => {
        stopsList.appendChild(item);
    });
}

function editStop(button) {
    const stopItem = button.closest('.stop-item');
    const nameElement = stopItem.querySelector('.stop-name');
    const addressElement = stopItem.querySelector('.stop-address');
    const timeElement = stopItem.querySelector('.stop-time');
    
    // Create input fields
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'stop-name';
    nameInput.value = nameElement.textContent;
    nameInput.setAttribute('data-original', nameElement.textContent);
    
    const addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.className = 'stop-address';
    addressInput.value = addressElement.textContent;
    addressInput.setAttribute('data-original', addressElement.textContent);
    
    // Generate a unique ID for the address input for autocomplete
    const randomId = 'edit-address-' + Math.random().toString(36).substring(2, 10);
    addressInput.id = randomId;
    
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'stop-time';
    timeInput.value = timeElement.textContent;
    timeInput.setAttribute('data-original', timeElement.textContent);
    
    // Replace elements with inputs
    nameElement.replaceWith(nameInput);
    addressElement.replaceWith(addressInput);
    timeElement.replaceWith(timeInput);
    
    // Show/hide buttons
    button.style.display = 'none';
    stopItem.querySelector('.save-stop-btn').style.display = 'inline-flex';
    
    // Add editing class
    stopItem.classList.add('editing');
    
    // Initialize Google Places Autocomplete
    setTimeout(() => {
        const autocomplete = new google.maps.places.Autocomplete(addressInput, {
            types: ['establishment', 'geocode']
        });
        
        // Set bias to current map viewport for better results
        if (map) {
            autocomplete.bindTo('bounds', map);
        }
        
        // When a place is selected from the dropdown
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                console.log("No details available for this place");
                return;
            }
            
            // If there's a name but the stop name field is empty, fill it
            if (place.name && nameInput && !nameInput.value.trim()) {
                nameInput.value = place.name;
            }
            
            // Set the address field value to formatted address
            if (place.formatted_address) {
                addressInput.value = place.formatted_address;
            }
            
            // If the map is available, center it on the selected place
            if (map && place.geometry.location) {
                map.setCenter(place.geometry.location);
                map.setZoom(15);
                
                // Add a temporary marker to show the selected place
                const marker = new google.maps.Marker({
                    position: place.geometry.location,
                    map: map,
                    animation: google.maps.Animation.DROP,
                    title: place.name
                });
                
                // Store in markers array so it can be cleared later
                markers.push(marker);
            }
        });
    }, 100);
    
    // Focus the name input
    nameInput.focus();
}

function saveStop(button) {
    const stopItem = button.closest('.stop-item');
    const nameInput = stopItem.querySelector('.stop-name');
    const addressInput = stopItem.querySelector('.stop-address');
    const timeInput = stopItem.querySelector('.stop-time');
    
    // Validate inputs
    if (!nameInput.value.trim() || !addressInput.value.trim() || !timeInput.value) {
        alert('Please fill in all fields');
        return;
    }
    
    // Get the day number and create form data
    const stopsList = stopItem.closest('.stops');
    const dayMatch = stopsList.id.match(/stops-day-(\d+)/);
    const dayNumber = dayMatch ? parseInt(dayMatch[1]) : 1;
    const tripId = window.location.pathname.split('/').pop();
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Check for original values (from edit mode)
    const originalTitle = nameInput.getAttribute('data-original');
    const originalLocation = addressInput.getAttribute('data-original');
    const originalDescription = timeInput.getAttribute('data-original');
    
    // If we have original values, delete the original item first
    const deleteOriginal = originalTitle && originalLocation && originalDescription;
    
    const saveNewItem = () => {
        // Log what we're sending
        console.log('Saving itinerary item:', {
            day: dayNumber - 1, // Convert from 1-based UI to 0-based backend
            title: nameInput.value.trim(),
            location: addressInput.value.trim(),
            description: timeInput.value,
            tripId
        });
        
        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        
        // Try URLSearchParams approach with proper encoding
        const params = new URLSearchParams();
        params.append('day', dayNumber - 1); // Convert from 1-based UI to 0-based backend
        params.append('title', nameInput.value.trim());
        params.append('location', addressInput.value.trim());
        params.append('description', timeInput.value);
        
        // Use fetch with proper headers
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };
        
        // Add CSRF header if available
        if (csrfToken && csrfHeader) {
            headers[csrfHeader] = csrfToken;
        }
        
        fetch(`/user/trip/${tripId}/saveItineraryAjax`, {
            method: 'POST',
            headers: headers,
            body: params.toString(),
            credentials: 'same-origin' // Important for CSRF to work
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Server error (${response.status}): ${text}`);
                });
            }
            return response.text();
        })
        .then(data => {
            console.log('Save successful:', data);
            
            // Create span elements to replace inputs
            const nameSpan = document.createElement('span');
            nameSpan.className = 'stop-name';
            nameSpan.textContent = nameInput.value.trim();
            
            const addressSpan = document.createElement('span');
            addressSpan.className = 'stop-address';
            addressSpan.textContent = addressInput.value.trim();
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'stop-time';
            timeSpan.textContent = timeInput.value;
            
            // Replace inputs with spans
            nameInput.replaceWith(nameSpan);
            addressInput.replaceWith(addressSpan);
            timeInput.replaceWith(timeSpan);
            
            // Update buttons
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.disabled = false;
            button.style.display = 'none';
            
            const editButton = stopItem.querySelector('.edit-stop-btn');
            if (editButton) { // Add check to ensure the edit button exists
                editButton.style.display = 'inline-flex';
            } else {
                console.warn('Edit button not found in stop item');
            }
            
            // Remove editing class
            stopItem.classList.remove('editing');
            
            // Sort stops by time
            sortStops(timeSpan);
            
            // Update progress
            updateItineraryProgress();
            
            // Update calendar if it exists
            if (typeof updateCalendarWithItinerary === 'function') {
                updateCalendarWithItinerary();
            }
        })
        .catch(error => {
            console.error('Error saving itinerary item:', error);
            alert(`Failed to save: ${error.message}`);
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.disabled = false;
        });
    };
    
    // If editing an existing item, delete the original first
    if (deleteOriginal) {
        console.log('Deleting original item before saving updated version:', {
            day: dayNumber - 1, // Convert from 1-based UI to 0-based backend
            title: originalTitle,
            location: originalLocation, 
            description: originalDescription
        });
        
        // Create a consistent format for delete operation
        const deleteParams = new URLSearchParams();
        deleteParams.append('day', dayNumber - 1); // Convert from 1-based UI to 0-based backend
        deleteParams.append('title', originalTitle);
        deleteParams.append('location', originalLocation);
        deleteParams.append('description', originalDescription);
        
        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        
        // Use fetch with proper headers
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };
        
        // Add CSRF header if available
        if (csrfToken && csrfHeader) {
            headers[csrfHeader] = csrfToken;
        }
        
        // Delete the original item first, then save the new one
        fetch(`/user/trip/${tripId}/deleteItinerary`, {
            method: 'POST',
            headers: headers,
            body: deleteParams.toString(),
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Server error (${response.status}): ${text}`);
                });
            }
            return response.text();
        })
        .then(() => {
            console.log('Original item deleted, saving new item');
            // Wait a moment before saving to ensure the delete is fully processed
            setTimeout(saveNewItem, 300);
        })
        .catch(error => {
            console.error('Error removing original item:', error);
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.disabled = false;
            alert(`Failed to update item: ${error.message}`);
        });
    } else {
        // Just save the new item
        saveNewItem();
    }
}

function removeItem(button) {
    const stopItem = button.closest('.stop-item');
    const stopsList = stopItem.closest('.stops');
    const dayMatch = stopsList.id.match(/stops-day-(\d+)/);
    const dayNumber = dayMatch ? parseInt(dayMatch[1]) : 1;
    const tripId = window.location.pathname.split('/').pop();
    
    // Get the stop details
    const title = stopItem.querySelector('.stop-name').textContent;
    const location = stopItem.querySelector('.stop-address').textContent;
    const description = stopItem.querySelector('.stop-time').textContent;
    
    // Ask for confirmation
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
        return;
    }
    
    console.log('Removing itinerary item:', {
        day: dayNumber - 1, // Convert from 1-based UI to 0-based backend
        title: title,
        location: location,
        description: description,
        tripId: tripId
    });
    
    // Create form data using URLSearchParams for consistency
    const deleteParams = new URLSearchParams();
    deleteParams.append('day', dayNumber - 1); // Convert from 1-based UI to 0-based backend
    deleteParams.append('title', title);
    deleteParams.append('location', location);
    deleteParams.append('description', description);
    
    // Get CSRF token
    const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
    const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
    
    // Show loading state
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Use fetch with proper headers
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    
    // Add CSRF header if available
    if (csrfToken && csrfHeader) {
        headers[csrfHeader] = csrfToken;
    }
    
    // Send delete request
    fetch(`/user/trip/${tripId}/deleteItinerary`, {
        method: 'POST',
        headers: headers,
        body: deleteParams.toString(),
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`Server error (${response.status}): ${text}`);
            });
        }
        return response.text();
    })
    .then(() => {
        console.log('Successfully removed item');
        // Remove the stop item from the DOM
        const listItem = stopItem.closest('li');
        if (listItem) {
            listItem.remove();
        } else {
            stopItem.remove();
        }
        
        // Update progress
        updateItineraryProgress();
        
        // Update calendar if it exists
        if (typeof updateCalendarWithItinerary === 'function') {
            updateCalendarWithItinerary();
        }
    })
    .catch(error => {
        console.error('Error removing itinerary item:', error);
        alert(`Failed to remove item: ${error.message}`);
        // Reset button
        button.disabled = false;
        button.innerHTML = originalHTML;
    });
}

// packing list functions
function addPackingItem() {
    // Show the input container
    const inputContainer = document.getElementById('packing-input-container');
    inputContainer.style.display = 'flex';
    
    // Focus on the input field
    const nameInput = document.getElementById('packing-item-name');
    nameInput.value = '';
    nameInput.focus();
    
    // Hide the add button temporarily
    const addButton = document.getElementById('add-packing-item');
    addButton.style.display = 'none';
}

function cancelAddPackingItem() {
    // Hide the input container
    const inputContainer = document.getElementById('packing-input-container');
    inputContainer.style.display = 'none';
    
    // Show the add button again
    const addButton = document.getElementById('add-packing-item');
    addButton.style.display = 'flex';
}

function saveNewPackingItem() {
    const nameInput = document.getElementById('packing-item-name');
    
    // Validate input
    if (!nameInput.value.trim()) {
        alert("Please enter an item name");
        return;
    }
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Show loading indicator
    const saveBtn = document.querySelector('.packing-input-buttons .save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Send to backend using fetchWithCsrf helper
    fetchWithCsrf(`/user/trip/${tripId}/savePackingItem`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(nameInput.value)}&checked=false`
    })
    .then(response => response.text())
    .then(() => {
        // Create new item
        let item = document.createElement("li");
        item.className = "packing-item";
        item.innerHTML = `
            <div class="packing-item-content">
                <input type="checkbox" onchange="updatePackingItemStatus(this)">
                <span class="item-name">${nameInput.value}</span>
            </div>
            <div class="packing-item-actions">
                <button class="edit-btn" onclick="editPackingItem(this)" title="Edit">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="delete-btn" onclick="deletePackingItem(this)" title="Delete">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add to list
        const packingList = document.getElementById("packing-list");
        packingList.appendChild(item);
        
        // Clear input and hide container
        nameInput.value = '';
        
        // Reset button
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i>';
        
        // Hide the input container
        const inputContainer = document.getElementById('packing-input-container');
        inputContainer.style.display = 'none';
        
        // Show the add button again
        const addButton = document.getElementById('add-packing-item');
        addButton.style.display = 'flex';
        
        // Update progress
        updatePackingProgress();
    })
    .catch(error => {
        console.error('Error adding packing item:', error);
        alert('Failed to add packing item. Please try again.');
        
        // Reset button
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    });
}

function editPackingItem(button) {
    const packingItem = button.closest('.packing-item');
    const nameSpan = packingItem.querySelector('.item-name');
    const originalName = nameSpan.textContent;
    
    // Replace with input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-item-input';
    input.value = originalName;
    nameSpan.replaceWith(input);
    
    // Focus input
    input.focus();
    
    // Add save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.setAttribute('title', 'Save');
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    saveBtn.onclick = function() { savePackingItem(this, originalName); };
    
    const editBtn = packingItem.querySelector('.edit-btn');
    editBtn.replaceWith(saveBtn);
    
    // Add a class to indicate item is being edited
    packingItem.classList.add('editing');
}

function savePackingItem(button, originalName) {
    const packingItem = button.closest('.packing-item');
    const input = packingItem.querySelector('.edit-item-input');
    const checkbox = packingItem.querySelector('input[type="checkbox"]');
    
    // Validate
    if (!input.value.trim()) {
        alert("Item name cannot be empty");
        return;
    }
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Send to backend using fetchWithCsrf helper
    fetchWithCsrf(`/user/trip/${tripId}/updatePackingItem`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(input.value)}&checked=${checkbox.checked}&oldName=${encodeURIComponent(originalName)}`
    })
    .then(response => response.text())
    .then(() => {
        // Replace input with span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = input.value;
        input.replaceWith(nameSpan);
        
        // Replace save button with edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.setAttribute('title', 'Edit');
        editBtn.innerHTML = '<i class="fas fa-pen"></i>';
        editBtn.onclick = function() { editPackingItem(this); };
        
        const saveBtn = packingItem.querySelector('.save-btn');
        saveBtn.replaceWith(editBtn);
        
        // Remove editing class
        packingItem.classList.remove('editing');
    })
    .catch(error => {
        console.error('Error updating packing item:', error);
        alert('Failed to update packing item. Please try again.');
        // Reset button
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-check"></i>';
    });
}

function deletePackingItem(button) {
    const packingItem = button.closest('.packing-item');
    const nameElement = packingItem.querySelector('.item-name');
    const itemName = nameElement.textContent;
    
    if (!confirm(`Are you sure you want to remove "${itemName}" from your packing list?`)) {
        return;
    }
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Send to backend using fetchWithCsrf helper
    fetchWithCsrf(`/user/trip/${tripId}/deletePackingItem`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(itemName)}`
    })
    .then(response => response.text())
    .then(() => {
        // Remove item with fade-out effect
        packingItem.style.opacity = '0';
        packingItem.style.transition = 'opacity 0.3s';
        
        setTimeout(() => {
            // Remove item after fade-out
            packingItem.remove();
            // Update progress
            updatePackingProgress();
        }, 300);
    })
    .catch(error => {
        console.error('Error deleting packing item:', error);
        alert('Failed to delete packing item. Please try again.');
        // Reset button
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-times"></i>';
    });
}

function updatePackingItemStatus(checkbox) {
    const packingItem = checkbox.closest('.packing-item');
    const nameElement = packingItem.querySelector('.item-name');
    const itemName = nameElement.textContent;
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Send to backend using fetchWithCsrf helper
    fetchWithCsrf(`/user/trip/${tripId}/updatePackingItemStatus`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(itemName)}&checked=${checkbox.checked}`
    })
    .then(response => response.text())
    .then(() => {
        // Update class
        if (checkbox.checked) {
            packingItem.classList.add('checked');
        } else {
            packingItem.classList.remove('checked');
        }
        
        // Update progress
        updatePackingProgress();
    })
    .catch(error => {
        console.error('Error updating packing item status:', error);
        // Revert checkbox state
        checkbox.checked = !checkbox.checked;
        alert('Failed to update packing item status. Please try again.');
    });
}

function updatePackingProgress() {
    const packingItems = document.querySelectorAll('#packing-list .packing-item');
    const checkedItems = document.querySelectorAll('#packing-list .packing-item input[type="checkbox"]:checked');
    
    const progressEl = document.getElementById('packing-progress-text');
    
    if (!progressEl) {
        console.warn('Progress element not found for packing progress update');
        return;
    }
    
    if (packingItems.length > 0) {
        progressEl.innerText = `${checkedItems.length}/${packingItems.length} items packed`;
    } else {
        progressEl.innerText = '0/0 items packed';
    }
}

function deleteDay(button) {
    const dayContainer = button.closest('.day-container');
    const dayNum = parseInt(dayContainer.dataset.day);
    
    if (!confirm(`Are you sure you want to delete Day ${dayNum}?`)) {
        return;
    }
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Send to backend using fetchWithCsrf helper
    fetchWithCsrf(`/user/trip/${tripId}/deleteDay`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `day=${dayNum - 1}`
    })
    .then(response => response.text())
    .then(() => {
        // Remove this day
        dayContainer.remove();
        
        // Update day numbers for all subsequent days
        const itinerary = document.getElementById('itinerary');
        const dayContainers = itinerary.querySelectorAll('.day-container');
        
        dayContainers.forEach((container, index) => {
            const containerDayNum = parseInt(container.dataset.day);
            if (containerDayNum > dayNum) {
                // Update day number
                const newDayNum = containerDayNum - 1;
                container.dataset.day = newDayNum;
                
                // Update day text
                const dayText = container.querySelector('.day-text');
                dayText.textContent = `Day ${newDayNum}`;
                
                // Update stops day ID
                const stopsList = container.querySelector('.stops');
                stopsList.id = `stops-day-${newDayNum}`;
                
                // Update add stop button
                const addStopBtn = container.querySelector('.add-place-btn');
                addStopBtn.setAttribute('onclick', `addStop(this, ${newDayNum})`);
            }
        });
        
        // Update progress
        updateItineraryProgress();
        
        // Update calendar
        if (typeof updateCalendarWithItinerary === 'function') {
            updateCalendarWithItinerary();
        }
    })
    .catch(error => {
        console.error('Error deleting day:', error);
        alert('Failed to delete day. Please try again.');
    });
}

function updateItineraryProgress() {
    const dayContainers = document.querySelectorAll('.day-container');
    const progressEl = document.getElementById('itinerary-progress-text');
    
    if (!progressEl) {
        console.warn('Progress element not found for itinerary progress update');
        return;
    }
    
    if (dayContainers.length > 0) {
        // Count stops
        let stopCount = 0;
        dayContainers.forEach(container => {
            const stops = container.querySelectorAll('.stop-item');
            stopCount += stops.length;
        });
        
        progressEl.innerText = `${dayContainers.length} days, ${stopCount} stops`;
    } else {
        progressEl.innerText = '0 days, 0 stops';
    }
}

function deleteTrip() {
    const tripId = window.location.pathname.split('/').pop();
    const tripName = document.querySelector('.trip-info h1').textContent;
    
    if (!confirm(`Are you sure you want to delete the trip to ${tripName}? This action cannot be undone.`)) {
        return;
    }
    
    // Send to backend using fetchWithCsrf helper
    fetchWithCsrf(`/user/trip/${tripId}/delete`, {
        method: 'POST'
    })
    .then(response => response.text())
    .then(() => {
        // Redirect to homepage
        window.location.href = '/user/homepage';
    })
    .catch(error => {
        console.error('Error deleting trip:', error);
        alert('Failed to delete trip. Please try again.');
    });
}

// Initialize steps on page load
document.addEventListener('DOMContentLoaded', function() {
    // Sort all stops by time on page load
    sortAllStops();
    
    // Initialize the progress indicators
    updatePackingProgress();
    updateItineraryProgress();
    
    // Handle keyboard event for adding packing items
    const packingInput = document.getElementById('packing-item-name');
    if (packingInput) {
        packingInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveNewPackingItem();
            }
        });
    }
});

// Calendar functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get trip dates from the page
    const tripDateText = document.querySelector('.trip-header + p span').textContent;
    const [startDateStr, endDateStr] = tripDateText.split(' - ');
    
    // Parse dates - they are in MM/DD format
    const [startMonth, startDay] = startDateStr.split('/').map(Number);
    const [endMonth, endDay] = endDateStr.split('/').map(Number);
    
    // Create date objects - get the actual current year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Determine the correct year for the trip dates
    // For trips in the future: use current year or next year
    // For trips in the past: use current year or previous year
    // This handles trips that span year boundaries

    // Default to current year
    let startYear = currentYear;
    let endYear = currentYear;
    
    // Current month and day for comparison
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    const currentDay = currentDate.getDate();

    // If start date is earlier in the year than current date, it's likely in the future (next year)
    if (startMonth < currentMonth || (startMonth === currentMonth && startDay < currentDay)) {
        startYear = currentYear + 1;
    }
    
    // If end date is earlier in the year than start date, it spans to next year
    if (endMonth < startMonth || (endMonth === startMonth && endDay < startDay)) {
        endYear = startYear + 1;
    } else {
        endYear = startYear;
    }
    
    // Create the date objects
    const tripStartDate = new Date(startYear, startMonth - 1, startDay);
    const tripEndDate = new Date(endYear, endMonth - 1, endDay);
    
    // If the trip is more than 6 months in the past, adjust years backward
    if ((currentDate - tripStartDate) > 180 * 24 * 60 * 60 * 1000) {
        const yearsToAdjust = Math.floor((currentDate - tripStartDate) / (365 * 24 * 60 * 60 * 1000));
        tripStartDate.setFullYear(tripStartDate.getFullYear() - yearsToAdjust);
        tripEndDate.setFullYear(tripEndDate.getFullYear() - yearsToAdjust);
    }
    
    console.log("Trip dates:", {
        startDate: tripStartDate.toDateString(),
        endDate: tripEndDate.toDateString(),
        currentDate: currentDate.toDateString()
    });
    
    // Get all itinerary items
    const itineraryItems = [];
    const dayContainers = document.querySelectorAll('.day-container');
    dayContainers.forEach(container => {
        const dayNum = parseInt(container.dataset.day, 10);
        const dayDate = new Date(tripStartDate);
        dayDate.setDate(dayDate.getDate() + dayNum - 1);
        
        const stops = container.querySelectorAll('.stop-item');
        stops.forEach(stop => {
            const title = stop.querySelector('.stop-name').textContent;
            const location = stop.querySelector('.stop-address').textContent;
            const description = stop.querySelector('.stop-time').textContent;
            
            itineraryItems.push({
                date: new Date(dayDate),
                title,
                location,
                description
            });
        });
    });
    
    // Calendar state
    let currentCalendarDate = new Date(tripStartDate);
    
    // Initialize calendar
    renderCalendar(currentCalendarDate, tripStartDate, tripEndDate, itineraryItems);
    
    // Event listeners for navigation
    document.getElementById('prev-month').addEventListener('click', function() {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar(currentCalendarDate, tripStartDate, tripEndDate, itineraryItems);
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar(currentCalendarDate, tripStartDate, tripEndDate, itineraryItems);
    });
});

// Function to render the calendar
function renderCalendar(date, tripStartDate, tripEndDate, itineraryItems) {
    const monthYearElement = document.getElementById('calendar-month-year');
    const daysContainer = document.getElementById('calendar-days');
    
    // Clear previous days
    daysContainer.innerHTML = '';
    
    // Set month and year
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthYearElement.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    
    // Get first day of month and number of days
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    // Get the day of the week of the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Create days from previous month to fill first row
    for (let i = 0; i < firstDayOfWeek; i++) {
        const prevMonthDay = new Date(firstDayOfMonth);
        prevMonthDay.setDate(prevMonthDay.getDate() - (firstDayOfWeek - i));
        createDayElement(prevMonthDay, 'other-month', daysContainer, tripStartDate, tripEndDate, itineraryItems);
    }
    
    // Create days for current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        const currentDate = new Date(date.getFullYear(), date.getMonth(), i);
        createDayElement(currentDate, 'current-month', daysContainer, tripStartDate, tripEndDate, itineraryItems);
    }
    
    // Fill the remaining cells with days from the next month
    const totalCells = Math.ceil((firstDayOfWeek + lastDayOfMonth.getDate()) / 7) * 7;
    const remainingCells = totalCells - (firstDayOfWeek + lastDayOfMonth.getDate());
    
    for (let i = 1; i <= remainingCells; i++) {
        const nextMonthDay = new Date(lastDayOfMonth);
        nextMonthDay.setDate(nextMonthDay.getDate() + i);
        createDayElement(nextMonthDay, 'other-month', daysContainer, tripStartDate, tripEndDate, itineraryItems);
    }
}

// Function to create a day element
function createDayElement(date, monthClass, container, tripStartDate, tripEndDate, itineraryItems) {
    const dayElement = document.createElement('div');
    dayElement.classList.add('calendar-day', monthClass);
    dayElement.textContent = date.getDate();
    dayElement.dataset.date = date.toISOString().split('T')[0];
    
    // Check if it's today
    const today = new Date();
    if (date.getDate() === today.getDate() && 
        date.getMonth() === today.getMonth() && 
        date.getFullYear() === today.getFullYear()) {
        dayElement.classList.add('today');
    }
    
    // Check if it's within the trip dates
    if (date >= tripStartDate && date <= tripEndDate) {
        dayElement.classList.add('trip-day');
    }
    
    // Check if there are events on this day
    const eventsOnThisDay = itineraryItems.filter(item => 
        item.date.getDate() === date.getDate() && 
        item.date.getMonth() === date.getMonth() && 
        item.date.getFullYear() === date.getFullYear()
    );
    
    if (eventsOnThisDay.length > 0) {
        dayElement.classList.add('has-events');
        
        // Add click event to show day details
        dayElement.addEventListener('click', function() {
            showDayDetails(date, eventsOnThisDay);
        });
    }
    
    container.appendChild(dayElement);
}

// Function to show day details
function showDayDetails(date, events) {
    // Remove any existing detail view
    const existingDetailView = document.querySelector('.day-detail-view');
    if (existingDetailView) {
        existingDetailView.remove();
    }
    
    // Create detail view
    const detailView = document.createElement('div');
    detailView.classList.add('day-detail-view');
    
    // Format date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = date.toLocaleDateString(undefined, options);
    
    detailView.innerHTML = `
        <h4>${dateStr}</h4>
        <ul>
            ${events.map(event => `
                <li>
                    <strong>${event.title}</strong> - ${event.location}
                    <div>${event.description}</div>
                </li>
            `).join('')}
        </ul>
    `;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.classList.add('btn');
    closeButton.style.marginTop = '10px';
    closeButton.addEventListener('click', function() {
        detailView.remove();
    });
    
    detailView.appendChild(closeButton);
    
    // Add to the calendar container
    document.querySelector('.calendar-container').appendChild(detailView);
    
    // Remove 'active' class from all days and add to the clicked day
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('active');
    });
    document.querySelector(`.calendar-day[data-date="${date.toISOString().split('T')[0]}"]`).classList.add('active');
}

// Update itinerary in calendar when itinerary changes
function updateCalendarWithItinerary() {
    // This function can be called when the itinerary is updated
    // Re-render the calendar with the updated itinerary
    const tripDateText = document.querySelector('.trip-header + p span').textContent;
    const [startDateStr, endDateStr] = tripDateText.split(' - ');
    
    const [startMonth, startDay] = startDateStr.split('/').map(Number);
    const [endMonth, endDay] = endDateStr.split('/').map(Number);
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    let startYear = currentYear;
    let endYear = currentYear;
    
    if (startMonth > currentDate.getMonth() + 1) {
        startYear = currentYear - 1;
        endYear = startMonth > endMonth ? currentYear : currentYear - 1;
    } else if (endMonth < currentDate.getMonth() + 1) {
        endYear = currentYear + 1;
        startYear = endMonth < startMonth ? currentYear : currentYear + 1;
    }
    
    const tripStartDate = new Date(startYear, startMonth - 1, startDay);
    const tripEndDate = new Date(endYear, endMonth - 1, endDay);
    
    // Get updated itinerary items
    const itineraryItems = [];
    const dayContainers = document.querySelectorAll('.day-container');
    dayContainers.forEach(container => {
        const dayNum = parseInt(container.dataset.day, 10);
        const dayDate = new Date(tripStartDate);
        dayDate.setDate(dayDate.getDate() + dayNum - 1);
        
        const stops = container.querySelectorAll('.stop-item');
        stops.forEach(stop => {
            const title = stop.querySelector('.stop-name').textContent;
            const location = stop.querySelector('.stop-address').textContent;
            const description = stop.querySelector('.stop-time').textContent;
            
            itineraryItems.push({
                date: new Date(dayDate),
                title,
                location,
                description
            });
        });
    });
    
    // Get current view month/year
    const monthYearText = document.getElementById('calendar-month-year').textContent;
    const [monthName, year] = monthYearText.split(' ');
    const monthIndex = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(monthName);
    
    const currentCalendarDate = new Date(parseInt(year), monthIndex, 1);
    
    // Re-render the calendar
    renderCalendar(currentCalendarDate, tripStartDate, tripEndDate, itineraryItems);
}

// Function to add a new stop with Google Places Autocomplete
function addStop(button, day) {
    const dayContent = button.closest('.day-content');
    // Make sure we get the stops list within the correct day
    const stopsList = dayContent.querySelector('.stops');
    
    if (!stopsList) {
        console.error('Could not find stops list for day', day);
        return;
    }
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Create new stop item
    const newStop = document.createElement('li');
    const stopCount = stopsList.querySelectorAll('.stop-item').length + 1;
    
    newStop.innerHTML = `
        <div class="stop-item editing">
            <div class="stop-order">${getStopOrder(stopCount)}</div>
            <div class="stop-details">
                <input type="text" class="stop-name" placeholder="Stop Name" />
                <input type="text" class="stop-address" id="stop-address-${day}-${stopCount}" placeholder="Address" />
                <input type="time" class="stop-time" value="12:00" />
            </div>
            <div class="stop-actions">
                <button class="save-stop-btn" onclick="saveStop(this)">
                    <i class="fas fa-check"></i>
                </button>
                <button class="edit-stop-btn" style="display: none;" onclick="editStop(this)">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="delete-btn" onclick="removeItem(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    stopsList.appendChild(newStop);
    
    // Focus on the name input
    const nameInput = newStop.querySelector('.stop-name');
    nameInput.focus();
    
    // Initialize Google Places Autocomplete on the address input
    setTimeout(() => {
        const addressInput = document.getElementById(`stop-address-${day}-${stopCount}`);
        if (addressInput) {
            const autocomplete = new google.maps.places.Autocomplete(addressInput, {
                types: ['establishment', 'geocode']
            });
            
            // Set bias to current map viewport for better results
            if (map) {
                autocomplete.bindTo('bounds', map);
            }
            
            // When a place is selected from the dropdown
            autocomplete.addListener('place_changed', function() {
                const place = autocomplete.getPlace();
                if (!place.geometry) {
                    console.log("No details available for this place");
                    return;
                }
                
                // If there's a name but the stop name field is empty, fill it
                const nameField = addressInput.closest('.stop-details').querySelector('.stop-name');
                if (place.name && nameField && !nameField.value.trim()) {
                    nameField.value = place.name;
                }
                
                // Set the address field value to formatted address
                if (place.formatted_address) {
                    addressInput.value = place.formatted_address;
                }
                
                // If the map is available, center it on the selected place
                if (map && place.geometry.location) {
                    map.setCenter(place.geometry.location);
                    map.setZoom(15);
                    
                    // Add a temporary marker to show the selected place
                    const marker = new google.maps.Marker({
                        position: place.geometry.location,
                        map: map,
                        animation: google.maps.Animation.DROP,
                        title: place.name
                    });
                    
                    // Store in markers array so it can be cleared later
                    markers.push(marker);
                }
            });
        }
    }, 100); // Short delay to ensure DOM is ready
}

// Modify existing functions to update the calendar when itinerary changes
const originalAddStop = addStop;
addStop = function(button, day) {
    originalAddStop(button, day);
    // Update calendar after a short delay to allow for the DOM to update
    setTimeout(updateCalendarWithItinerary, 500);
};

const originalRemoveItem = removeItem;
removeItem = function(element) {
    originalRemoveItem(element);
    setTimeout(updateCalendarWithItinerary, 500);
};

const originalSaveStop = saveStop;
saveStop = function(element) {
    originalSaveStop(element);
    setTimeout(updateCalendarWithItinerary, 500);
};

// Geoapify Map Integration
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    initTripMap();
    
    // Rest of your existing DOMContentLoaded code
    updatePackingProgress();
    updateItineraryProgress();
    
    // Handle keyboard event for adding packing items
    const packingInput = document.getElementById('packing-item-name');
    if (packingInput) {
        packingInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveNewPackingItem();
            }
        });
    }
});

function initTripMap() {
    const mapElement = document.getElementById('trip-map');
    if (!mapElement) return;
    
    // Initialize the map
    map = new google.maps.Map(mapElement, {
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
    
    // Initialize directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#dd2525',
            strokeWeight: 4,
            strokeOpacity: 0.7
        }
    });
    
    // Get destination from the page
    const destination = document.querySelector('.trip-header h1').textContent.trim();
    if (destination) {
        focusMapOnDestination(destination);
    }
}

function focusMapOnDestination(destination) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: destination }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            map.setCenter(location);
            map.setZoom(10);
            
            // Add marker for destination
            const marker = new google.maps.Marker({
                position: location,
                map: map,
                title: destination
            });
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `<div class='custom-gm-infowindow'>
                    <div class='infowindow-title'>${destination}</div>
                    <div class='infowindow-address'>${location}</div>
                </div>`
            });
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
            infoWindow.open(map, marker);
        } else {
            console.warn('Could not geocode destination:', destination);
        }
    });
}

function toggleDay(header) {
    const dayContainer = header.closest('.day-container');
    const content = dayContainer.querySelector('.day-content');
    const chevron = header.querySelector('.fa-chevron-down');
    const dayNumber = dayContainer.dataset.day;
    
    if (dayContainer.classList.contains('collapsed')) {
        // Collapse all other days
        document.querySelectorAll('.day-container').forEach(container => {
            if (container !== dayContainer && !container.classList.contains('collapsed')) {
                const otherContent = container.querySelector('.day-content');
                const otherChevron = container.querySelector('.fa-chevron-down');
                otherContent.style.display = 'none';
                otherChevron.style.transform = 'rotate(-90deg)';
                container.classList.add('collapsed');
            }
        });
        
        // Expand this day
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
        dayContainer.classList.remove('collapsed');
        
        // Populate stop dropdowns and focus map
        populateStopDropdowns(content);
        focusMapOnDay(content);
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
        dayContainer.classList.add('collapsed');
        
        // Clear dropdowns and show/focus on destination pin
        clearStopDropdowns();
        clearMap();
        const destination = document.querySelector('.trip-header h1').textContent.trim();
        focusMapOnDestination(destination);
    }
}

function calculateRoute(waypoints) {
    if (waypoints.length < 2) return;
    
    const request = {
        origin: waypoints[0].location,
        destination: waypoints[waypoints.length - 1].location,
        waypoints: waypoints.slice(1, -1),
        travelMode: google.maps.TravelMode.DRIVING
    };
    
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            } else {
            console.error('Directions request failed:', status);
            }
        });
}

// Update all stop order numbers based on their current sorted position
function updateStopOrderNumbers(stopsList = null) {
    if (stopsList) {
        // Update numbers in a specific stops list
        const stopItems = stopsList.querySelectorAll('.stop-item');
        stopItems.forEach((item, index) => {
            const orderElement = item.querySelector('.stop-order');
            if (orderElement) {
                orderElement.textContent = getStopOrder(index + 1);
            }
        });
    } else {
        // Update all stop numbers in all day containers
        const dayContainers = document.querySelectorAll('.day-container');
        dayContainers.forEach(container => {
            const stopsList = container.querySelector('.stops');
            if (stopsList) {
                const stopItems = stopsList.querySelectorAll('.stop-item');
                stopItems.forEach((item, index) => {
                    const orderElement = item.querySelector('.stop-order');
                    if (orderElement) {
                        orderElement.textContent = getStopOrder(index + 1);
                    }
                });
            }
        });
    }
} 