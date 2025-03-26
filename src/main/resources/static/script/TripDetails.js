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
}

function toggleDay(header) {
    const dayContainer = header.closest('.day-container');
    const content = dayContainer.querySelector('.day-content');
    const chevron = header.querySelector('.fa-chevron-down');
    
    if (dayContainer.classList.contains('collapsed')) {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
        dayContainer.classList.remove('collapsed');
    } else {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
        dayContainer.classList.add('collapsed');
    }
}

function addStop(button, dayNum) {
    const stopsList = document.getElementById(`stops-day-${dayNum}`);
    const stopCount = stopsList.children.length + 1;
    const stopOrder = getStopOrder(stopCount);
    
    let stopItem = document.createElement("li");
    stopItem.innerHTML = `
        <div class="stop-item">
            <div class="stop-order">${stopOrder}</div>
            <div class="stop-details">
                <input type="text" class="stop-name" placeholder="Stop name" required>
                <input type="text" class="stop-address" placeholder="Address" required>
                <input type="time" class="stop-time" required>
            </div>
            <div class="stop-actions">
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
}

function getStopOrder(num) {
    switch(num) {
        case 1: return 'First Stop';
        case 2: return 'Second Stop';
        case 3: return 'Third Stop';
        default: return `${num}th Stop`;
    }
}

function sortStops(timeInput) {
    const stopsList = timeInput.closest('.stops');
    const stopItems = Array.from(stopsList.querySelectorAll('.stop-item'));
    
    stopItems.sort((a, b) => {
        const timeA = a.querySelector('.stop-time').value;
        const timeB = b.querySelector('.stop-time').value;
        return timeA.localeCompare(timeB);
    });
    
    // Clear and re-append sorted items
    stopItems.forEach(item => {
        stopsList.appendChild(item.parentElement);
    });
}

function editStop(button) {
    const stopItem = button.closest('.stop-item');
    const nameElement = stopItem.querySelector('.stop-name');
    const addressElement = stopItem.querySelector('.stop-address');
    const timeElement = stopItem.querySelector('.stop-time');
    
    // Store original values
    nameElement.dataset.originalValue = nameElement.textContent;
    addressElement.dataset.originalValue = addressElement.textContent;
    timeElement.dataset.originalValue = timeElement.textContent;
    
    // Create input fields
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'stop-name';
    nameInput.value = nameElement.textContent;
    
    const addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.className = 'stop-address';
    addressInput.value = addressElement.textContent;
    
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'stop-time';
    timeInput.value = timeElement.textContent;
    
    // Replace elements with inputs
    nameElement.replaceWith(nameInput);
    addressElement.replaceWith(addressInput);
    timeElement.replaceWith(timeInput);
    
    // Show/hide buttons
    button.style.display = 'none';
    stopItem.querySelector('.save-stop-btn').style.display = 'inline-flex';
    stopItem.querySelector('.delete-btn').style.display = 'inline-flex';
    
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
    
    const formData = new FormData();
    formData.append('day', dayNumber - 1);
    formData.append('title', nameInput.value.trim());
    formData.append('location', addressInput.value.trim());
    formData.append('description', timeInput.value);
    
    // Send data to backend
    fetch(`/user/trip/${tripId}/saveItinerary`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        
        // Create text elements
        const nameElement = document.createElement('h4');
        nameElement.className = 'stop-name';
        nameElement.textContent = nameInput.value;
        
        const addressElement = document.createElement('p');
        addressElement.className = 'stop-address';
        addressElement.textContent = addressInput.value;
        
        const timeElement = document.createElement('p');
        timeElement.className = 'stop-time';
        timeElement.textContent = timeInput.value;
        
        // Replace inputs with text elements
        nameInput.replaceWith(nameElement);
        addressInput.replaceWith(addressElement);
        timeInput.replaceWith(timeElement);
        
        // Update buttons
        stopItem.querySelector('.save-stop-btn').style.display = 'none';
        stopItem.querySelector('.edit-stop-btn').style.display = 'inline-flex';
        stopItem.querySelector('.delete-btn').style.display = 'none';
        
        // Remove editing class
        stopItem.classList.remove('editing');
        
        // Sort stops
        sortStops(timeInput);
    })
    .catch(error => {
        console.error('Error saving itinerary:', error);
        alert('Failed to save itinerary item. Please try again.');
    });
}

function removeItem(button) {
    button.parentElement.parentElement.remove();
}

// packing list functions
function addPackingItem() {
    const input = document.getElementById("packing-item");
    if (input.value.trim() !== "") {
        const packingList = document.getElementById("packing-list");
        let listItem = document.createElement("li");
        listItem.innerHTML = `
            <input type="checkbox"> ${input.value} 
            <button onclick="removeItem(this)">x</button>
        `;
        packingList.appendChild(listItem);
        input.value = "";
    }
}

function editItem(button) {
    const listItem = button.parentElement;
    const itemText = listItem.querySelector('.item-text');
    const editInput = listItem.querySelector('.edit-input');
    const editBtn = listItem.querySelector('.edit-btn');
    const saveBtn = listItem.querySelector('.save-btn');

    // Show edit input and save button, hide text and edit button
    itemText.style.display = 'none';
    editInput.style.display = 'inline-block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
}

function saveItem(button) {
    const listItem = button.parentElement;
    const itemText = listItem.querySelector('.item-text');
    const editInput = listItem.querySelector('.edit-input');
    const editBtn = listItem.querySelector('.edit-btn');
    const saveBtn = listItem.querySelector('.save-btn');

    // Update the text and hide edit input and save button
    itemText.textContent = editInput.value;
    itemText.style.display = 'inline-block';
    editInput.style.display = 'none';
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
}

function deleteDay(button) {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this day? All stops will be removed.')) {
        return;
    }

    const dayDiv = button.closest('.day-container');
    const dayNumber = parseInt(dayDiv.dataset.day);
    
    // Get the trip ID from the URL
    const tripId = window.location.pathname.split('/').pop();
    
    // Create form data
    const formData = new FormData();
    formData.append('day', dayNumber - 1); // Convert to 0-based index for backend
    
    // Send delete request to backend
    fetch(`/user/trip/${tripId}/deleteDay`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Remove the deleted day from the DOM
        dayDiv.remove();
        
        // Update the day numbers for remaining days
        const itinerary = document.getElementById('itinerary');
        const dayContainers = itinerary.querySelectorAll('.day-container');
        dayContainers.forEach((container, index) => {
            const newDayNum = index + 1;
            container.dataset.day = newDayNum;
            container.querySelector('.day-text').textContent = `Day ${newDayNum}`;
            container.querySelector('.stops').id = `stops-day-${newDayNum}`;
            
            // Update the addStop button's onclick handler
            const addStopBtn = container.querySelector('button[onclick^="addStop"]');
            addStopBtn.setAttribute('onclick', `addStop(this, ${newDayNum})`);
        });
    })
    .catch(error => {
        console.error('Error deleting day:', error);
        alert('Failed to delete day. Please try again.');
    });
}
