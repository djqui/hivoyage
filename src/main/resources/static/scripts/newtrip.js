document.addEventListener('DOMContentLoaded', async function() {
    await fetchScheduledDates();
    setupDatePickers();
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const calendarDays = document.getElementById('calendar-days');
    const monthYearDisplay = document.getElementById('calendar-month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    
    let currentDate = new Date();
    let selectedStartDate = null;
    let selectedEndDate = null;
    
    // Initialize calendar
    renderCalendar(currentDate);
    
    // Event listeners for date inputs
    startDateInput.addEventListener('change', function() {
        selectedStartDate = new Date(this.value);
        renderCalendar(currentDate);
    });
    
    endDateInput.addEventListener('change', function() {
        selectedEndDate = new Date(this.value);
        renderCalendar(currentDate);
    });
    
    // Event listeners for calendar navigation
    prevMonthBtn.addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });
    
    nextMonthBtn.addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });
    
    function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // Update month and year display
        monthYearDisplay.textContent = `${getMonthName(month)} ${year}`;
        
        // Clear previous calendar days
        calendarDays.innerHTML = '';
        
        // Get first day of month and total days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const totalDays = lastDay.getDate();
        const startingDay = firstDay.getDay();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarDays.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= totalDays; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const currentDayDate = new Date(year, month, day);
            
            // Add classes based on date status
            if (isDateInRange(currentDayDate, selectedStartDate, selectedEndDate)) {
                dayElement.classList.add('selected');
            }
            
            if (isDateInPast(currentDayDate)) {
                dayElement.classList.add('past');
            }
            
            if (isDateBlocked(currentDayDate)) {
                dayElement.classList.add('blocked-date');
                dayElement.style.pointerEvents = 'none';
                dayElement.style.background = '#eee';
                dayElement.style.color = '#aaa';
                dayElement.title = 'This date is already booked for another trip.';
            }
            
            calendarDays.appendChild(dayElement);
        }
    }
    
    function getMonthName(month) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[month];
    }
    
    function isDateInRange(date, start, end) {
        if (!start || !end) return false;
        return date >= start && date <= end;
    }
    
    function isDateInPast(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    }
});

let scheduledDateRanges = [];

async function fetchScheduledDates() {
    try {
        const response = await fetch(`${CONTEXT_PATH}api/trips/dates`);
        if (!response.ok) throw new Error('Failed to fetch scheduled dates');
        scheduledDateRanges = await response.json();
    } catch (e) {
        console.error('Could not fetch scheduled trip dates:', e);
        scheduledDateRanges = [];
    }
}

function isDateBlocked(date) {
    // date: string in 'YYYY-MM-DD' or Date object
    let d = (typeof date === 'string') ? new Date(date) : date;
    d.setHours(0, 0, 0, 0);
    return scheduledDateRanges.some(range => {
        if (!range.startDate || !range.endDate) return false;
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return d >= start && d <= end;
    });
}

function setupDatePickers() {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    const today = new Date().toISOString().split('T')[0];
    startInput.setAttribute('min', today);
    endInput.setAttribute('min', today);

    function validateDateInput(e) {
        if (isDateBlocked(e.target.value)) {
            alert('This date is already booked for another trip.');
            e.target.value = '';
        }
    }
    startInput.addEventListener('change', validateDateInput);
    endInput.addEventListener('change', validateDateInput);
}

// Initialize Google Places Autocomplete
function initAutocomplete() {
    const destinationInput = document.getElementById('destination');
    const autocomplete = new google.maps.places.Autocomplete(destinationInput, {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry', 'name']
    });
    
    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        if (place.geometry) {
            // Update the input with the formatted address
            destinationInput.value = place.formatted_address;
        }
    });
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initAutocomplete); 