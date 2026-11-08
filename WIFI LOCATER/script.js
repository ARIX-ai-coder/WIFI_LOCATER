
const locationBtn = document.getElementById("locationBtn");

let map = null;
let userMarker = null;

locationBtn.addEventListener("click", () => {

    if (!navigator.geolocation) {
        document.getElementById("deviceStatus").textContent =
            "Geolocation is not supported.";
        return;
    }

    document.getElementById("deviceStatus").textContent =
        "Detecting your location...";

    locationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(

        (position) => {

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            document.getElementById("deviceStatus").textContent =
                "Your location detected!";

            document.getElementById("coordinates").textContent =
                `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

            // Create map only once
            if (!map) {

                map = L.map("map").setView(
                    [latitude, longitude], 16
                );

                L.tileLayer(
                    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    {
                        attribution: "&copy; OpenStreetMap contributors"
                    }
                ).addTo(map);

            } else {

                map.setView([latitude, longitude], 16);

            }

            // Update location marker
            if (userMarker) {
                userMarker.setLatLng([latitude, longitude]);
            } else {
                userMarker = L.marker(
                    [latitude, longitude]
                ).addTo(map);
            }

            userMarker.bindPopup("Your Device Location").openPopup();

            locationBtn.disabled = false;

        },

        (error) => {

            document.getElementById("deviceStatus").textContent =
                "Location unavailable. Check browser permission.";

            locationBtn.disabled = false;

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }

    );

});

