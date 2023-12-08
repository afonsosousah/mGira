let navigationActive = false;
let navigationMode = null;
let deviceOrientation = "portrait"

function startNavigation (walkingOnly = false) {
    navigationActive = true;

    // Navigation on-foot from user location to nearest station
    navigationMode == "foot";

    // Request fullscreen
    document.body.requestFullscreen()

    // Zoom in to an approppriate level
    map.getView().setZoom(17);

    // Add the Navigation Information Panel
    let navInfoPanelElement = document.createElement('div');
    navInfoPanelElement.id = 'navigationInfoPanelPortrait';
    navInfoPanelElement.innerHTML = 
    `
    <img src="assets/images/mGira_big_white.png" alt="big logo">
    <div id="endNavigationButton" onclick="stopNavigation()">Terminar viagem</div>
    `.trim();
    document.body.appendChild(navInfoPanelElement);

    // Append the buttons
    if (!walkingOnly)
        appendElementToBodyFromHTML(`<div id="onBikeButton" onclick="onBikeNavigation()">Estou na bicicleta</div>`);

    // Update the map style to fill the screen
    mapElement = document.getElementById('map');
    mapElement.style.height = '100%';
    mapElement.style.bottom = '0';
    mapElement.firstChild.style.borderRadius = '0';
    mapElement.style.zIndex = '10';

    // Start the FULLTILT DeviceOrientation listeners 
    var promise = FULLTILT.getDeviceOrientation({'type': 'world'});
    promise.then(function(orientationControl) {

        orientationControl.listen(function() {
            // Get the current *screen-adjusted* device orientation angles
            var currentOrientation = orientationControl.getScreenAdjustedEuler(); 

            // Update the map rotation and location
            updateRotationWhenNavigating(currentOrientation);
        });

    });
}

function onBikeNavigation() {
    navigationMode = "bike";

    // Tell the user that there is navigation going, so he needs to rotate the screen
    appendElementToBodyFromHTML(`
    <div class="rotate-screen-notice" id="rotateScreenNotice">
        <div id="phone">
        </div>
        <div id="message">
            Rode o seu dispositivo
        </div>
    </div>
    `);

    // Add the Navigation Information Panel
    let navInfoPanelElement = document.createElement('div');
    navInfoPanelElement.id = 'navigationInfoPanel';
    navInfoPanelElement.innerHTML = 
    `
    <img src="assets/images/mGira_big_white.png" alt="big logo">
    <span id="tripCost">0.00€</span>
    <span id="tripTime">00:00:00</span>
    <div id="endNavigationButton" onclick="stopNavigation()">Terminar viagem</div>
    `.trim();
    document.body.appendChild(navInfoPanelElement);

    // Append the button
    appendElementToBodyFromHTML(`<div id="reachedFinalStation" onclick="finalOnFootNavigation()">Cheguei à estação!</div>`);

    // Update the map style to fill the screen
    mapElement = document.getElementById('map');
    mapElement.style.height = '100%';
    mapElement.style.bottom = '0';
    mapElement.firstChild.style.borderRadius = '0';
    mapElement.style.zIndex = '15';
}

function finalOnFootNavigation() {
    navigationMode = "foot";

    // Remove all the on bike navigation elements
    navigationElements = Array.from(document.querySelectorAll('*')).filter(e=> getComputedStyle(e).zIndex == 16);
    for(element of navigationElements) {
        element.remove();
    }

    // Remove the on bike button
    if (document.getElementById("onBikeButton"))
        document.getElementById("onBikeButton").remove();

    // Update the map style to fill the screen
    mapElement = document.getElementById('map');
    mapElement.style.height = '100%';
    mapElement.style.bottom = '0';
    mapElement.firstChild.style.borderRadius = '0';
    mapElement.style.zIndex = '10';

    // Tell the user that there is navigation going, so he needs to rotate the screen
    appendElementToBodyFromHTML(`
    <div class="rotate-screen-notice" id="rotateScreenNotice">
        <div id="phone">
        </div>
        <div id="message">
            Rode o seu dispositivo
        </div>
    </div>
    `);
}

function stopNavigation() {
    navigationActive = false;
    navigationMode = null;

    // Request fullscreen
    document.exitFullscreen();

    // Remove all the navigation elements
    navigationElements = Array.from(document.querySelectorAll('*')).filter(e=> getComputedStyle(e).zIndex == 11 || getComputedStyle(e).zIndex == 16);
    for(element of navigationElements) {
        element.remove();
    }

    // Set map to default
    mapElement = document.getElementById('map');
    mapElement.style.height = '92%';
    mapElement.style.bottom = '0';
    mapElement.firstChild.style.borderRadius = '20px 20px 0 0';
    mapElement.style.zIndex = '0';

    orientationChangeHandler(window.matchMedia("(orientation: portrait)"));
}

function updateRotationWhenNavigating(currentOrientation) {
    if (navigationActive) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // Convert to the OpenLayers format
                pos = [
                    position.coords.longitude,
                    position.coords.latitude
                ];
   
                var compassHeading = 360 - currentOrientation.alpha; // Calculate the current compass heading that the user is 'looking at' (in degrees)
    
                // Pan to location
                var view = map.getView();
                if (navigationMode == "bike") {
                    view.centerOn(ol.proj.fromLonLat(pos), map.getSize(), [map.getSize()[0]/2, map.getSize()[1] - 75]);
                    view.setRotation(-(Math.PI / 180) * compassHeading);
                } else {
                    view.centerOn(ol.proj.fromLonLat(pos), map.getSize(), [map.getSize()[0]/2, map.getSize()[1]/2]);
                    view.setRotation(-(Math.PI / 180) * compassHeading);
                }
            },
            (error) => {
                handleLocationError(true, infoWindow, map.getCenter(), error);
            },
            options = {
                enableHighAccuracy: true
            }
        );

    }

}

function orientationChangeHandler (event) {
    if(event.matches) {
        // Portrait mode
        if (navigationActive && navigationMode == "bike") {
            // Tell the user that there is navigation going, so he needs to rotate the screen
            appendElementToBodyFromHTML(`
                <div class="rotate-screen-notice" id="rotateScreenNotice">
                    <div id="phone">
                    </div>
                    <div id="message">
                        Rode o seu dispositivo
                    </div>
                </div>
            `);
        } else {
            // Hide the rotate screen notice
            if (document.getElementById("rotateScreenNotice"))
                document.getElementById("rotateScreenNotice").remove();

            // Update the inner height if the app started in portrait mode
            initialWindowHeight = window.innerHeight;
        }
    } else {
        // Landscape
        if (navigationActive && navigationMode == "bike") {
            // Hide the rotate screen notice
            if(document.querySelector('#rotateScreenNotice'))
                document.querySelector('#rotateScreenNotice').remove();
        }
        else {
            appendElementToBodyFromHTML(`
                <div class="rotate-screen-notice" id="rotateScreenNotice">
                    <div id="phone">
                    </div>
                    <div id="message">
                        Rode o seu dispositivo
                    </div>
                </div>
            `);
        }
    }
};

let portrait = window.matchMedia("(orientation: portrait)");

portrait.addEventListener("change", orientationChangeHandler);

window.addEventListener("load", () => orientationChangeHandler(window.matchMedia("(orientation: portrait)"))); // Initial orientation check