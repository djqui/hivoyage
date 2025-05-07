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

    // Initialize the itinerary progress
    updateItineraryProgress();
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
    const dayNum = itinerary.children.length + 1;
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
        // Focus map on the stops of this day
        const stops = content.querySelectorAll('.stop-item');
        console.log('toggleDay: Found', stops.length, 'stops for day', dayNumber);
        const mapElement = document.getElementById('trip-map');
        if (mapElement && mapElement.map) {
            const map = mapElement.map;
            // Clear all markers and routes
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.GeoJSON) {
                    map.removeLayer(layer);
                }
            });
            if (stops.length > 0) {
                // Show and focus on stops for this day
                const bounds = L.latLngBounds([]);
                let stopPromises = [];
                stops.forEach(stop => {
                    const location = stop.querySelector('.stop-address').textContent;
                    if (location) {
                        console.log('toggleDay: Geocoding location:', location);
                        const stopPromise = fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(location)}&apiKey=${MapConfig.apiKey}`)
                            .then(response => response.json())
                            .then(data => {
                                console.log('toggleDay: Geocode response for', location, data);
                                if (data.features && data.features.length > 0) {
                                    const [lon, lat] = data.features[0].geometry.coordinates;
                                    bounds.extend([lat, lon]);
                                    // Add marker for this stop (default icon)
                                    const marker = L.marker([lat, lon]).addTo(map);
                                    const stopName = stop.querySelector('.stop-name').textContent;
                                    const stopTime = stop.querySelector('.stop-time').textContent;
                                    marker.bindPopup(`<b>${stopName}</b><br>${location}<br><i>Time: ${stopTime}</i>`);
                                    console.log('toggleDay: Added marker for', stopName, lon, lat);
                                    // Add stop order/time label
                                    const stopIndex = Array.from(stops).indexOf(stop);
                                    let labelText = `Stop ${stopIndex + 1}`;
                                    if (stopTime) labelText += `: ${stopTime}`;
                                    L.marker([lat, lon], {
                                        icon: L.divIcon({
                                            className: 'stop-label',
                                            html: `<div class="stop-label-content">${labelText}</div>`,
                                            iconSize: [80, 20],
                                            iconAnchor: [40, 20]
                                        })
                                    }).addTo(map);
                                    return { lat, lon };
                                } else {
                                    console.warn('toggleDay: No geocode results for', location);
                                }
                                return null;
                            })
                            .catch(error => {
                                console.error('toggleDay: Error geocoding location:', location, error);
                                return null;
                            });
                        stopPromises.push(stopPromise);
                    }
                });
                Promise.all(stopPromises)
                    .then(results => {
                        const validStops = results.filter(r => r !== null);
                        console.log('toggleDay: validStops:', validStops.length);
                        if (validStops.length > 0) {
                            map.fitBounds(bounds, { padding: [50, 50] });
                            console.log('toggleDay: fitBounds to stops');
                        }
                        if (validStops.length >= 2) {
                            // Draw route between stops
                            const waypoints = validStops.map(stop => `${stop.lat},${stop.lon}`);
                            const routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${waypoints.join('|')}&mode=drive&apiKey=${MapConfig.apiKey}`;
                            console.log('toggleDay: Routing waypoints:', waypoints);
                            console.log('toggleDay: Routing URL:', routeUrl);
                            fetch(routeUrl)
                                .then(response => response.json())
                                .then(data => {
                                    console.log('toggleDay: Routing API response:', data);
                                    if (data.features && data.features.length > 0) {
                                        L.geoJSON(data, {
                                            style: {
                                                color: 'red',
                                                weight: 4,
                                                opacity: 0.7
                                            }
                                        }).addTo(map);
                                    } else {
                                        console.warn('toggleDay: No route features returned from API');
                                    }
                                })
                                .catch(error => console.error('toggleDay: Error fetching route:', error));
                        }
                    });
            } else {
                // No stops: show and focus on destination pin
                const destination = document.querySelector('.trip-header h1').textContent.trim();
                fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&apiKey=${MapConfig.apiKey}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.features && data.features.length > 0) {
                            const [lon, lat] = data.features[0].geometry.coordinates;
                            map.setView([lat, lon], 10);
                            L.marker([lat, lon]).addTo(map).bindPopup(`<b>${destination}</b>`).openPopup();
                            console.log('toggleDay: Showed destination marker', lon, lat);
                        } else {
                            console.warn('toggleDay: No geocode results for destination', destination);
                        }
                    });
            }
        }
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
        dayContainer.classList.add('collapsed');
        // When collapsing, show and focus on destination pin
        const mapElement = document.getElementById('trip-map');
        if (mapElement && mapElement.map) {
            const map = mapElement.map;
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.GeoJSON) {
                    map.removeLayer(layer);
                }
            });
            const destination = document.querySelector('.trip-header h1').textContent.trim();
            fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&apiKey=${MapConfig.apiKey}`)
                .then(response => response.json())
                .then(data => {
                    if (data.features && data.features.length > 0) {
                        const [lon, lat] = data.features[0].geometry.coordinates;
                        map.setView([lat, lon], 10);
                        L.marker([lat, lon]).addTo(map).bindPopup(`<b>${destination}</b>`).openPopup();
                        console.log('toggleDay: Showed destination marker (collapse)', lon, lat);
                    } else {
                        console.warn('toggleDay: No geocode results for destination (collapse)', destination);
                    }
                });
        }
    }
}

function focusMapOnDayStops(dayNumber) {
    const stops = document.querySelectorAll(`.day-container[data-day="${dayNumber}"] .stop-item`);
    if (stops.length === 0) return;

    const map = document.getElementById('trip-map').map;
    if (!map) return;

    // Clear existing markers and routes
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.GeoJSON) {
            map.removeLayer(layer);
        }
    });

    const bounds = L.latLngBounds([]);
    let hasValidCoordinates = false;
    let stopPromises = [];

    stops.forEach(stop => {
        const location = stop.querySelector('.stop-address').textContent;
        if (location) {
            // Use Geoapify to geocode the location
            const stopPromise = fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(location)}&apiKey=${MapConfig.apiKey}`)
                .then(response => response.json())
                .then(data => {
                    if (data.features && data.features.length > 0) {
                        const [lon, lat] = data.features[0].geometry.coordinates;
                        bounds.extend([lat, lon]);
                        hasValidCoordinates = true;
                        
                        // Add marker for this stop
                        const marker = L.marker([lat, lon]).addTo(map);
                        const stopName = stop.querySelector('.stop-name').textContent;
                        const stopTime = stop.querySelector('.stop-time').textContent;
                        marker.bindPopup(`<b>${stopName}</b><br>${location}<br><i>Time: ${stopTime}</i>`);
                        
                        // Add stop order/time label
                        const stopIndex = Array.from(stops).indexOf(stop);
                        let labelText = `Stop ${stopIndex + 1}`;
                        if (stopTime) labelText += `: ${stopTime}`;
                        L.marker([lat, lon], {
                            icon: L.divIcon({
                                className: 'stop-label',
                                html: `<div class="stop-label-content">${labelText}</div>`,
                                iconSize: [80, 20],
                                iconAnchor: [40, 20]
                            })
                        }).addTo(map);
                        
                        return { lat, lon };
                    }
                    return null;
                })
                .catch(error => {
                    console.error('Error geocoding location:', error);
                    return null;
                });
            
            stopPromises.push(stopPromise);
        }
    });

    // When all stops are geocoded, draw the route and fit bounds
    Promise.all(stopPromises)
        .then(results => {
            const validStops = results.filter(r => r !== null);
            if (validStops.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        });
}

function addStop(button, dayNum) {
    const stopsList = document.getElementById(`stops-day-${dayNum}`);
    const stopCount = stopsList.children.length + 1;
    const stopOrder = getStopOrder(stopCount);
    
    let stopItem = document.createElement("li");
    stopItem.innerHTML = `
        <div class="stop-item editing">
            <div class="stop-order">${stopOrder}</div>
            <div class="stop-details">
                <input type="text" class="stop-name" placeholder="Stop name" required>
                <input type="text" class="stop-address" placeholder="Address" required>
                <input type="time" class="stop-time" required>
            </div>
            <div class="stop-actions">
                <button class="edit-stop-btn" style="display: none" onclick="editStop(this)">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="save-stop-btn" onclick="saveStop(this)">
                    <i class="fas fa-check"></i>
                </button>
                <button class="delete-btn" onclick="removeItem(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    stopsList.appendChild(stopItem);
    
    // Focus the name input
    stopItem.querySelector('.stop-name').focus();
    updateItineraryProgress();
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
            day: dayNumber - 1,
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
        params.append('day', dayNumber - 1);
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
            editButton.style.display = 'inline-flex';
            
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
            day: dayNumber - 1,
            title: originalTitle,
            location: originalLocation, 
            description: originalDescription
        });
        
        const formData = new FormData();
        formData.append('day', dayNumber - 1);
        formData.append('title', originalTitle);
        formData.append('location', originalLocation);
        formData.append('description', originalDescription);
        
        // Delete the original item first, then save the new one
        fetchWithCsrf(`/user/trip/${tripId}/deleteItinerary`, {
            method: 'POST',
            body: formData
        })
        .then(() => {
            console.log('Original item deleted, saving new item');
            saveNewItem();
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
        day: dayNumber - 1,
        title: title,
        location: location,
        description: description,
        tripId: tripId
    });
    
    // Create form data
    const formData = new FormData();
    formData.append('day', dayNumber - 1);
    formData.append('title', title);
    formData.append('location', location);
    formData.append('description', description);
    
    // Get CSRF token
    const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
    const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
    
    // Show loading state
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Send delete request with CSRF token
    fetchWithCsrf(`/user/trip/${tripId}/deleteItinerary`, {
        method: 'POST',
        body: formData
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
        // Remove the stop item
        stopItem.parentElement.remove();
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

// Modify existing functions to update the calendar when itinerary changes
const originalAddStop = addStop;
addStop = function(element, day) {
    originalAddStop(element, day);
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
    
    // Get destination from the page
    const destination = document.querySelector('.trip-header h1').textContent.trim();
    if (!destination) return;
    
    // Initialize the map centered on a default location
    const map = L.map('trip-map').setView([0, 0], 2);
    
    // Store the map instance on the DOM element for global access
    mapElement.map = map;
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add map legend
    addMapLegend(map);
    
    // By default, just focus on the destination
        focusMapOnDestination(map, destination);
}

function addMapLegend(map) {
    // Create a custom legend control
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <h4>Map Legend</h4>
            <div class="legend-item">
                <i class="fas fa-map-marker-alt" style="color: #3388ff;"></i>
                <span>Destination/Stops</span>
            </div>
            <div class="legend-item">
                <div class="line-sample" style="background-color: #dd2525; height: 4px;"></div>
                <span>Route</span>
            </div>
            <div class="legend-item">
                <div class="stop-label-sample">Stop 1: 9:00</div>
                <span>Stops ordered by time</span>
            </div>
        `;
        return div;
    };
    
    legend.addTo(map);
}

function addItineraryMarkersToMap(map, destination) {
    const dayContainers = document.querySelectorAll('.day-container');
    if (!dayContainers.length) {
        focusMapOnDestination(map, destination);
        return;
    }
    
    // Array to store all geocoded stops
    const allStops = [];
    let stopPromises = [];
    let firstStopProcessed = false;
    
    // Process each day
    dayContainers.forEach((dayContainer) => {
        const dayNum = dayContainer.dataset.day;
        const stopItems = dayContainer.querySelectorAll('.stop-item');
        
        // Skip days with no stops
        if (!stopItems.length) return;
        
        // Process each stop in this day
        const dayStops = [];
        
        // Convert NodeList to Array to sort by time
        const stopItemsArray = Array.from(stopItems);
        
        // Sort stops by time
        stopItemsArray.sort((a, b) => {
            const timeA = a.querySelector('.stop-time').textContent.trim();
            const timeB = b.querySelector('.stop-time').textContent.trim();
            
            // If both have valid time values, compare them
            if (timeA && timeB) {
                return timeA.localeCompare(timeB);
            }
            // If only one has a time value, prioritize the one with a time
            if (timeA) return -1;
            if (timeB) return 1;
            
            // If neither has a time, keep original order
            return 0;
        });
        
        stopItemsArray.forEach((stop, index) => {
            const locationElement = stop.querySelector('.stop-address');
            if (!locationElement) return;
            
            const location = locationElement.textContent.trim();
            if (!location) return;
            
            const stopName = stop.querySelector('.stop-name').textContent.trim();
            const stopTime = stop.querySelector('.stop-time').textContent.trim();
            
            // Create a promise for geocoding this stop
            const stopPromise = fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(location)}&apiKey=${MapConfig.apiKey}`)
                .then(response => response.json())
                .then(data => {
                    if (data.features && data.features.length > 0) {
                        const feature = data.features[0];
                        const [lon, lat] = feature.geometry.coordinates;
                        
                        // Create stop object
                        const stopObj = {
                            dayNum,
                            index,  // This is now the sorted index
                            name: stopName,
                            location,
                            time: stopTime,
                            coordinates: [lat, lon]
                        };
                        
                        // Add to day stops
                        dayStops.push(stopObj);
                        
                        // Add marker for this stop with time information
                        const marker = L.marker([lat, lon]).addTo(map);
                        const popupContent = stopTime 
                            ? `<b>Day ${dayNum}: ${stopName}</b><br>${location}<br><i>Time: ${stopTime}</i>` 
                            : `<b>Day ${dayNum}: ${stopName}</b><br>${location}`;
                        marker.bindPopup(popupContent);
                        
                        // Focus map on the first stop we process (earliest by day/time)
                        if (!firstStopProcessed) {
                            map.setView([lat, lon], 10);
                            marker.openPopup();
                            firstStopProcessed = true;
                        }
                        
                        // Add stop order/time label
                        const stopIndex = Array.from(stopItems).indexOf(stop);
                        let labelText = `Stop ${stopIndex + 1}`;
                        if (stopTime) labelText += `: ${stopTime}`;
                        L.marker([lat, lon], {
                            icon: L.divIcon({
                                className: 'stop-label',
                                html: `<div class="stop-label-content">${labelText}</div>`,
                                iconSize: [80, 20],
                                iconAnchor: [40, 20]
                            })
                        }).addTo(map);
                        
                        return stopObj;
                    }
                    return null;
                })
                .catch(error => {
                    console.error('Error geocoding stop:', error);
                    return null;
                });
            
            stopPromises.push(stopPromise);
        });
        
        // When all stops for this day are geocoded, add them to the array
        Promise.all(stopPromises)
            .then(results => {
                // Filter out nulls and sort by index (which is already sorted by time)
                const validStops = results.filter(r => r !== null)
                    .filter(s => s.dayNum === dayNum)
                    .sort((a, b) => a.index - b.index);
                
                if (validStops.length > 0) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                    console.log('toggleDay: fitBounds to stops');
                }
            });
    });
}

function drawRouteBetweenStops(map, stops) {
    if (stops.length < 2) return;
    
    const dayNum = stops[0].dayNum;
    const waypoints = stops.map(stop => stop.coordinates.join(','));
    
    // Get color based on day number (cycle through a few colors)
    const colors = ['red', 'blue', 'green', 'purple', 'orange'];
    const color = colors[(dayNum - 1) % colors.length];
    
    // Build the URL for the Geoapify Routing API
    let routeUrl = `https://api.geoapify.com/v1/routing?waypoints=${waypoints.join('|')}&mode=drive&apiKey=${MapConfig.apiKey}`;
    
    // Fetch the route
    fetch(routeUrl)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                // Draw the route on the map
                const route = L.geoJSON(data, {
                    style: {
                        color: color,
                        weight: 4,
                        opacity: 0.7
                    }
                }).addTo(map);
                
                // Add labels for each stop with its time
                stops.forEach((stop, index) => {
                    // Show the stop number and time if available
                    let labelText = `Stop ${index + 1}`;
                    if (stop.time) {
                        labelText += `: ${stop.time}`;
                    }
                    
                    // Add a label
                    L.marker([stop.coordinates[0], stop.coordinates[1]], {
                        icon: L.divIcon({
                            className: 'stop-label',
                            html: `<div class="stop-label-content">${labelText}</div>`,
                            iconSize: [80, 20],
                            iconAnchor: [40, 20]
                        })
                    }).addTo(map);
                });
                
                // Add a label to indicate the day
                const midPoint = Math.floor(stops.length / 2);
                const midStopCoords = stops[midPoint].coordinates;
                L.marker([midStopCoords[0] + 0.01, midStopCoords[1]], {
                    icon: L.divIcon({
                        className: 'route-day-label',
                        html: `<div class="day-label-content">Day ${dayNum}</div>`,
                        iconSize: [60, 20],
                        iconAnchor: [30, 10]
                    })
                }).addTo(map);
            }
        })
        .catch(error => {
            console.error('Error fetching route:', error);
        });
}

// Function to focus map on destination
function focusMapOnDestination(map, destination) {
    fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&apiKey=${MapConfig.apiKey}`)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                const location = data.features[0];
                const [lon, lat] = location.geometry.coordinates;
                
                // Center map on destination
                map.setView([lat, lon], 10);
                
                // Add marker for destination
                const marker = L.marker([lat, lon]).addTo(map);
                marker.bindPopup(`<b>${destination}</b>`).openPopup();
            } else {
                console.warn('Could not geocode destination:', destination);
            }
        })
        .catch(error => {
            console.error('Error geocoding destination:', error);
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