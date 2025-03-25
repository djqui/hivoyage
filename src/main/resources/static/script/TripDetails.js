// itinerary functions
function addItineraryDay() {
    const itinerary = document.getElementById("itinerary");
    const dayNum = itinerary.children.length + 1;

    let dayDiv = document.createElement("div");
    dayDiv.innerHTML = `
        <h3>Day ${dayNum} <button onclick="addStop(this)">+ Add Stop</button></h3>
        <ul class="stops"></ul>
    `;
    itinerary.appendChild(dayDiv);
}

function addStop(button) {
    const stopsList = button.parentElement.nextElementSibling;
    let stopItem = document.createElement("li");
    stopItem.innerHTML = `<input type="text" placeholder="Stop name"> <button onclick="removeItem(this)">x</button>`;
    stopsList.appendChild(stopItem);
}

function removeItem(button) {
    button.parentElement.remove();
}

// packing list functions

function addPackingItem() {
    const input = document.getElementById("packing-item");
    if (input.value.trim() !== "") {
        const packingList = document.getElementById("packing-list");
        let listItem = document.createElement("li");
        listItem.innerHTML = `<input type="checkbox"> ${input.value} <button onclick="removeItem(this)">x</button>`;
        packingList.appendChild(listItem);
        input.value = "";
    }
}