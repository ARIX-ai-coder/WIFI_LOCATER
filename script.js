import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
const firebaseConfig = {
    apiKey: "AIzaSyAXbpzMVPUo2J1viYegkx3-H0F16Qi5WwQ",
    authDomain: "wifi-locater-arix.firebaseapp.com",
    databaseURL: "https://wifi-locater-arix-default-rtdb.firebaseio.com",
    projectId: "wifi-locater-arix",
    storageBucket: "wifi-locater-arix.firebasestorage.app",
    messagingSenderId: "1063034166777",
    appId: "1:1063034166777:web:6d35a1bcdd8971fd11f128"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const database = getDatabase(app);

let firebaseUser = null;

signInAnonymously(auth)
    .then((userCredential) => {
        firebaseUser = userCredential.user;
        console.log("ARIX Firebase Connected!");
        console.log("User ID:", firebaseUser.uid);
    })
    .catch((error) => {
        console.error("Firebase Error:", error);
    });
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

// ARIX LOCATION SHARING

let activeShareCode = null;

const startSharingBtn = document.getElementById("startSharingBtn");
const stopSharingBtn = document.getElementById("stopSharingBtn");

startSharingBtn.addEventListener("click", async () => {
    if (!firebaseUser) {
        alert("Firebase login not ready. Please wait.");
        return;
    }

    if (!navigator.geolocation) {
        alert("Location is not supported by this browser.");
        return;
    }

    startSharingBtn.disabled = true;
    document.getElementById("shareStatus").textContent =
        "Requesting location permission...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const codeBytes = new Uint8Array(16);
                crypto.getRandomValues(codeBytes);

                const code = Array.from(codeBytes)
                    .map(byte => byte.toString(16).padStart(2, "0"))
                    .join("");

                const now = Date.now();

                await set(ref(database, "shares/" + code), {
                    ownerUid: firebaseUser.uid,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    createdAt: now,
                    expiresAt: now + 10 * 60 * 1000
                });

                activeShareCode = code;

                document.getElementById("shareStatus").textContent =
                    "Location sharing is active for 10 minutes.";

                document.getElementById("shareCode").textContent =
                    "Sharing Code: " + code;

                stopSharingBtn.disabled = false;

            } catch (error) {
                console.error(error);
                document.getElementById("shareStatus").textContent =
                    "Could not start sharing. Check Firebase rules.";
            }

            startSharingBtn.disabled = false;
        },

        (error) => {
            document.getElementById("shareStatus").textContent =
                "Location permission denied or unavailable.";

            startSharingBtn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
});

stopSharingBtn.addEventListener("click", async () => {
    if (!activeShareCode) return;

    try {
        await remove(ref(database, "shares/" + activeShareCode));

        activeShareCode = null;

        document.getElementById("shareStatus").textContent =
            "Location sharing stopped.";

        document.getElementById("shareCode").textContent =
            "Sharing Code: --";

        stopSharingBtn.disabled = true;

    } catch (error) {
        console.error(error);
        alert("Could not stop sharing. Please try again.");
    }
});
// ARIX JOIN LOCATION SHARING

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;

    const toRad = (value) => value * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

document.getElementById("joinSharingBtn")
    .addEventListener("click", async () => {

        const code = document.getElementById("joinCodeInput")
            .value.trim();

        const status = document.getElementById("joinStatus");
        const distanceText = document.getElementById("sharedDistance");

        if (!/^[a-f0-9]{32}$/.test(code)) {
            status.textContent = "Invalid sharing code.";
            return;
        }

        if (!firebaseUser) {
            status.textContent = "Firebase login is not ready.";
            return;
        }

        status.textContent = "Checking sharing code...";

        try {
            const snapshot = await get(ref(database, "shares/" + code));

            if (!snapshot.exists()) {
                status.textContent = "Code invalid or sharing expired.";
                return;
            }

            const shared = snapshot.val();

            if (shared.expiresAt <= Date.now()) {
                status.textContent = "Sharing has expired.";
                return;
            }

            if (!navigator.geolocation) {
                status.textContent = "GPS is not supported.";
                return;
            }

            status.textContent = "Requesting your GPS permission...";

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const distance = calculateDistance(
                        position.coords.latitude,
                        position.coords.longitude,
                        shared.lat,
                        shared.lng
                    );

                    distanceText.textContent =
                        "Distance: " + distance.toFixed(2) + " km";

                    status.textContent =
                        "Shared location found successfully!";
                },
                () => {
                    status.textContent =
                        "Please allow GPS permission to calculate distance.";
                },
                { enableHighAccuracy: true, timeout: 15000 }
            );

        } catch (error) {
            console.error(error);
            status.textContent = "Unable to access shared location.";
        }
    });