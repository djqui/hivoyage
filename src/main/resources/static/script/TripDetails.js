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
    const packingItems = document.querySelector('.packing-items');
    
    // Check if there's already an item being edited
    if (packingItems.querySelector('.packing-item.editing')) {
        return; // Don't add new item if one is being edited
    }
    
    const newItem = document.createElement('div');
    newItem.className = 'packing-item editing';
    
    newItem.innerHTML = `
        <label class="checkbox-container">
            <input type="checkbox" onchange="updatePackingItemStatus(this)">
            <span class="checkmark"></span>
            <input type="text" class="edit-input" placeholder="Enter item name">
        </label>
        <div class="item-actions">
            <button class="save-btn" onclick="savePackingItem(this)">
                <i class="fas fa-check"></i>
            </button>
            <button class="delete-btn" onclick="deletePackingItem(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    packingItems.appendChild(newItem);
    const input = newItem.querySelector('.edit-input');
    input.focus();
    
    // Add event listener for Enter key
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            savePackingItem(newItem.querySelector('.save-btn'));
        }
    });
}

function editPackingItem(button) {
    const packingItem = button.closest('.packing-item');
    const itemName = packingItem.querySelector('.item-name');
    const itemText = itemName.textContent;
    
    // Create input for editing
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = itemText;
    
    // Replace text with input
    itemName.replaceWith(input);
    
    // Update buttons to show save and delete
    const actionButtons = packingItem.querySelector('.item-actions');
    actionButtons.innerHTML = `
        <button class="save-btn" onclick="savePackingItem(this)">
            <i class="fas fa-check"></i>
        </button>
        <button class="delete-btn" onclick="deletePackingItem(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add editing class
    packingItem.classList.add('editing');
    input.focus();
}

function savePackingItem(button) {
    const packingItem = button.closest('.packing-item');
    const input = packingItem.querySelector('.edit-input');
    const itemText = input.value.trim();
    
    if (itemText === '') {
        alert('Please enter an item name');
        return;
    }
    
    // Check if an item with this name already exists
    const existingItems = document.querySelectorAll('.item-name');
    for (let item of existingItems) {
        if (item.textContent.toLowerCase() === itemText.toLowerCase()) {
            alert('This item already exists in your packing list');
            return;
        }
    }
    
    const tripId = window.location.pathname.split('/').pop();
    const checkbox = packingItem.querySelector('input[type="checkbox"]');
    
    // Create URL-encoded form data
    const formData = new URLSearchParams();
    formData.append('name', itemText);
    formData.append('checked', checkbox.checked);
    
    fetch(`/user/trip/${tripId}/savePackingItem`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text().then(text => text ? JSON.parse(text) : {});
    })
    .then(() => {
        // Create span for item name
        const itemName = document.createElement('span');
        itemName.className = 'item-name';
        itemName.textContent = itemText;
        itemName.dataset.name = itemText;
        
        // Update checkbox data attribute
        checkbox.dataset.name = itemText;
        
        // Replace input with span
        input.replaceWith(itemName);
        
        // Show edit button and delete button
        const actionButtons = packingItem.querySelector('.item-actions');
        actionButtons.innerHTML = `
            <button class="edit-btn" onclick="editPackingItem(this)">
                <i class="fas fa-pen"></i>
            </button>
            <button class="delete-btn" onclick="deletePackingItem(this)">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Remove editing class
        packingItem.classList.remove('editing');
        
        // Update progress
        updatePackingProgress();
    })
    .catch(error => {
        console.error('Error saving packing item:', error);
        // Don't show error if item was actually saved
        if (!document.querySelector(`.item-name[data-name="${itemText}"]`)) {
            alert('Failed to save item. Please try again.');
        }
    });
}

function deletePackingItem(button) {
    const packingItem = button.closest('.packing-item');
    const itemName = packingItem.querySelector('.item-name')?.textContent;
    
    // If there's no item name, it's a new unsaved item
    if (!itemName) {
        packingItem.remove();
        updatePackingProgress();
        return;
    }
    
    // Confirm before deleting saved items
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    const tripId = window.location.pathname.split('/').pop();
    
    fetch(`/user/trip/${tripId}/deletePackingItem`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(itemName)}`
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        packingItem.remove();
        updatePackingProgress();
    })
    .catch(error => {
        console.error('Error deleting packing item:', error);
        alert('Failed to delete item. Please try again.');
    });
}

function updatePackingItemStatus(checkbox) {
    const packingItem = checkbox.closest('.packing-item');
    const itemName = checkbox.dataset.name;
    
    // If there's no item name yet (new item being added), just return
    if (!itemName) return;
    
    const tripId = window.location.pathname.split('/').pop();
    
    // Create URL-encoded form data
    const formData = new URLSearchParams();
    formData.append('name', itemName);
    formData.append('checked', checkbox.checked);
    
    fetch(`/user/trip/${tripId}/updatePackingItemStatus`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    })
    .then(response => {
        if (!response.ok) {
            checkbox.checked = !checkbox.checked; // Revert the checkbox state
            throw new Error('Network response was not ok');
        }
        updatePackingProgress();
    })
    .catch(error => {
        console.error('Error updating packing item status:', error);
        alert('Failed to update item status. Please try again.');
    });
}

function updatePackingProgress() {
    const totalItems = document.querySelectorAll('.packing-item:not(.editing)').length;
    const checkedItems = document.querySelectorAll('.packing-item:not(.editing) input[type="checkbox"]:checked').length;
    const progressText = document.getElementById('packing-progress-text');
    progressText.textContent = `${checkedItems}/${totalItems} items packed`;
}

// Initialize packing progress on page load
document.addEventListener('DOMContentLoaded', function() {
    updatePackingProgress();
});

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
