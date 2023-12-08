let orsApiKey = "REMOVED FOR GITHUB";

async function calculateFullRoute(fromCoordinates, toCoordinates) {

    // Loading animation over the map while the route is being calculated
    let loadingElement = document.createElement('div');
    loadingElement.className = 'lds-ring';
    loadingElement.innerHTML = '<div></div><div></div><div></div><div></div>';
    loadingElement.style.top = 'calc(35% - 40px)';
    document.body.appendChild(loadingElement);

    // Remove previous layer containing the results, the stations layer and the previous route layer
    map.getLayers().getArray()
    .filter(layer => layer.get('name') === "placesLayer" || layer.get('name') === "stationsLayer" || layer.get('name') === "routeLayer")
    .forEach(layer => map.removeLayer(layer));

    // select the stations from which the user should grab the bike and leave the bike
    // from the 3 stations nearer to the starting point and the 3 stations nearer to the ending point
    // make a rough calculation on which of the combinations will result in the less distance (which should take less time)
    let nearestStationsStart = getStationsByDistance(fromCoordinates).slice(0,3);
    let nearestStationsEnd = getStationsByDistance(toCoordinates).slice(0,3);

    let bestDistance;
    let grabStation;
    let dropoffStation;

    for(stationStart of nearestStationsStart) {
        for(stationEnd of nearestStationsEnd) {
            walkingDistanceToStartStation = distance(fromCoordinates[1], fromCoordinates[0], stationStart.latitude, stationStart.longitude);
            cyclingDistanceFromStartToEnd = distance(stationStart.latitude, stationStart.longitude, stationEnd.latitude, stationEnd.longitude);
            walkingDistanceFromEndStation = distance(stationEnd.latitude, stationEnd.longitude, toCoordinates[1], toCoordinates[0]);

            totalTripDistance = walkingDistanceToStartStation + cyclingDistanceFromStartToEnd + walkingDistanceFromEndStation

            if(bestDistance && totalTripDistance < bestDistance) {
                bestDistance = totalTripDistance;
                grabStation = stationStart;
                dropoffStation = stationEnd;
            } else if (!bestDistance) {
                bestDistance = totalTripDistance;
                grabStation = stationStart;
                dropoffStation = stationEnd;
            }
        }
    }

    let totalDistance = 0; // will be in meters and exact
    let totalTime = 0; // will be in seconds
    let routeSummaryBike;
    let walkingOnly = false;

    // If the grab station and droppoff station are the same, we should calculate the route on foot
    if (grabStation.code == dropoffStation.code) {
        // Calculate only on foot route

        // Calculate walking route from start to end
        routeSummary = await calculateRoute(fromCoordinates, toCoordinates, false);
        totalDistance += routeSummary.distance;
        totalTime += routeSummary.duration;
        routeSummaryBike = routeSummary; // we need to set this for the bbox to be set

        // Set that the route is walking only
        walkingOnly = true;
    } else {
        // Calculate normal Gira route

        // Calculate walking route from start to station
        routeSummary = await calculateRoute(fromCoordinates, [grabStation.longitude, grabStation.latitude], false);
        totalDistance += routeSummary.distance;
        totalTime += routeSummary.duration;

        // Now calculate cycling route from start station to end station
        routeSummaryBike = await calculateRoute([grabStation.longitude, grabStation.latitude], [dropoffStation.longitude, dropoffStation.latitude], true);
        totalDistance += routeSummaryBike.distance;
        totalTime += routeSummaryBike.duration * 0.8; // Adjust time because the Gira ebike will be faster than the default on openrouteservice

        // Finnaly, calculate walking route from station to end
        routeSummary = await calculateRoute([dropoffStation.longitude, dropoffStation.latitude], toCoordinates, false);
        totalDistance += routeSummary.distance;
        totalTime += routeSummary.duration;

        // Add start station point to map
        addStationPointToMap(grabStation, true);

        // Add end station point to map
        addStationPointToMap(dropoffStation, false);
    }

    // Hide loading animation
    loadingElement.remove();

    // Set the bbox
    let coords1 = ol.proj.fromLonLat([routeSummaryBike.bbox[0], routeSummaryBike.bbox[1]]);
    let coords2 = ol.proj.fromLonLat([routeSummaryBike.bbox[2], routeSummaryBike.bbox[3]]);
    let converted_bbox = [coords1[0], coords1[1], coords2[0], coords2[1]];
    map.getView().fit(converted_bbox, {size:map.getSize(), padding: [50, 50, 50, 50], maxZoom: 14, minZoom: 1});

    // Show the start navigation button and route details panel
    if(document.querySelector('#placeSearchMenu')) {
        let placeSearchMenuElement = document.querySelector('#placeSearchMenu');

        let startNavigationButtonElement = document.createElement('div');
        startNavigationButtonElement.id = 'startNavigationButton';
        startNavigationButtonElement.innerHTML = '<i class="bi bi-sign-turn-slight-right"></i>'

        startNavigationButtonElement.addEventListener('click', function () {
            startNavigation(walkingOnly);
        });

        let routeDetailsElement = document.createElement('div');
        routeDetailsElement.id = 'routeDetails';
        routeDetailsElement.innerHTML = `${new Date(totalTime * 1000).toISOString().slice(11, 19)}  ${Math.round(totalDistance/1000 * 10) / 10}km`; // round distance to 1 decimal place

        placeSearchMenuElement.appendChild(startNavigationButtonElement);
        placeSearchMenuElement.appendChild(routeDetailsElement);
    }
    
};

async function calculateRoute(fromCoordinates, toCoordinates, cycling=true) {
    let orsDirections = new Openrouteservice.Directions({ api_key: orsApiKey});

    try {
        let response = await orsDirections.calculate({
            coordinates: [fromCoordinates, toCoordinates],
            profile: cycling ? 'cycling-regular' : 'foot-walking',
            extra_info: ['waytype', 'steepness'],
            format: 'geojson'
        })

        // Load GeoJSON route to map
        const styles = {
            'Point': new ol.style.Style({
              image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({color: '#79C000'}),
                stroke: new ol.style.Stroke({color: '#231F20', width: 1}),
              }),
            }),
            'LineString': new ol.style.Style({
              stroke: new ol.style.Stroke({
                color: cycling ? '#79C000' : '#231F20',
                width: 8,
              }),
            })
        };
          
        const styleFunction = function (feature) {
            return styles[feature.getGeometry().getType()];
        };
    
        let vectorLayer = new ol.layer.Vector({
            name: "routeLayer",
            source: new ol.source.Vector({
                features: new ol.format.GeoJSON({dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'}).readFeatures(response)
            }),
            style: styleFunction
        })

        map.addLayer(vectorLayer);

        let summary = response.features[0].properties.summary;
        return { distance: summary.distance, duration: summary.duration, bbox: response.bbox };

    } catch (err) {
        console.log(err)
        console.log("An error occurred: " + err.status)
        console.error(await err.response.json())
    }
}

// Calculate the distance between two points in meters (given the latitude/longitude of those points).
function distance(lat1, lon1, lat2, lon2) {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    else {
        var radlat1 = Math.PI * lat1/180;
        var radlat2 = Math.PI * lat2/180;
        var theta = lon1-lon2;
        var radtheta = Math.PI * theta/180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180/Math.PI;
        dist = dist * 60 * 1.1515;
        dist = dist * 1.609344 * 1000
        return dist;
    }
}

function getStationsByDistance(currentLocation) {
    // Copy the stattions array
    let temp_stationsArray = stationsArray;

    // Remove all the empty stations
    temp_stationsArray = temp_stationsArray.filter(obj => {
        return obj.bikes != 0;
    });

    // Calculate the distance for all the stations
    for(let station of temp_stationsArray) {
        station.distance = distance(currentLocation[1], currentLocation[0], station.latitude, station.longitude);
    }

    // Sort by distance
    temp_stationsArray.sort(function(a,b) {
        return a.distance - b.distance;
    });

    return temp_stationsArray;
}


async function searchPlace() {
    let query = document.getElementById('searchBar').value;

    if (query.length > 2) {
        console.log(query);

        const Geocode = new Openrouteservice.Geocode({ api_key: orsApiKey})

        // hide the placeSearchMenu if it is showing and put map to normal
        if (document.querySelector('#placeSearchMenu')) {
            mapElement = document.getElementById('map');
            mapElement.style.height = '92%';
            mapElement.style.bottom = '0';
            document.querySelector('#placeSearchMenu').remove();
        }

        // show the bottom panel from the start so that the request delay is less noticeable
        let menu = document.createElement("div");
        menu.className = "place-search-menu";
        menu.id = "placeSearchMenu";
        document.body.appendChild(menu);

        // resize map
        mapElement = document.getElementById('map');
        mapElement.style.height = '50%';
        mapElement.style.bottom = '42%';

        // Remove previous layer containing the previous results, the stations layer and the route layer
        map.getLayers().getArray()
        .filter(layer => layer.get('name') === "placesLayer" || layer.get('name') === "stationsLayer" || layer.get('name') === "routeLayer")
        .forEach(layer => map.removeLayer(layer));

        // show loading animation
        menu.innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`;

        try {
            let response = await Geocode.geocode({
                text: query,
                boundary_bbox: [[38.689932, -9.229717],[38.805336, -9.091187]],
                boundary_country: ["PT"]
            })
            // set the inner HTML after the animation has started
            menu.innerHTML = 
            `
                <ul id="placeList">
                    <!-- Populate with the list here -->
                </ul>
                <div id="cancelButton" onclick="hidePlaceSearchMenu()">Cancelar</div>
            `.trim();

            let featuresArray = [];

            // Fit all the places to the map
            let coords1 = ol.proj.fromLonLat([response.bbox[0], response.bbox[1]]);
            let coords2 = ol.proj.fromLonLat([response.bbox[2], response.bbox[3]]);
            let converted_bbox = [coords1[0], coords1[1], coords2[0], coords2[1]];
            map.getView().fit(converted_bbox, {size:map.getSize(), padding: [40, 40, 40, 40], maxZoom: 16});

            // get the results
            for(let result of response.features) {
                resultElement = document.createElement("li");
                resultElement.className = "place-search-element";

                let position = result.geometry.coordinates

                resultElement.innerHTML = 
                `
                    ${result.properties.name}
                `.trim();

                resultElement.addEventListener('click', function(){ viewRoute(position) });
                resultElement.addEventListener('mouseout', function() {

                    let pixels = map.getPixelFromCoordinate(ol.proj.fromLonLat(position));

                    // correct to the point
                    pixels[1] -= 25;
                    pixels[0] -= 10;


                    const result = map.forEachFeatureAtPixel(pixels, function (feature, layer) {
                        return {feature: feature, layer: layer };
                    });
                    if (!result) {
                        return;
                    }

                    const iconStyle = new ol.style.Style({
                        image: new ol.style.Icon({
                            anchor: [0.5, 50],
                            anchorXUnits: 'fraction',
                            anchorYUnits: 'pixels',
                            src: 'assets/images/mapDotPlace.png',
                        }),
                    });

                    result.feature.setStyle(iconStyle);
                });
                resultElement.addEventListener('mouseover', function() {

                    let pixels = map.getPixelFromCoordinate(ol.proj.fromLonLat(position));

                    // correct to the point
                    pixels[1] -= 25;
                    pixels[0] -= 10;


                    const result = map.forEachFeatureAtPixel(pixels, function (feature, layer) {
                        return {feature: feature, layer: layer };
                    });
                    if (!result) {
                        return;
                    }

                    const iconStyle = new ol.style.Style({
                        image: new ol.style.Icon({
                            anchor: [0.5, 50],
                            anchorXUnits: 'fraction',
                            anchorYUnits: 'pixels',
                            src: 'assets/images/mapDotPlace_black.png',
                        }),
                    });

                    result.feature.setStyle(iconStyle);
                });

                if (!document.querySelector('#placeList')) {
                    return;
                }

                document.getElementById("placeList").appendChild(resultElement);

                const iconFeature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat(position)),
                    name: result.properties.name
                });
            
                const iconStyle = new ol.style.Style({
                image: new ol.style.Icon({
                    anchor: [0.5, 50],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'pixels',
                    src: 'assets/images/mapDotPlace.png',
                }),
                });
                
                iconFeature.setStyle(iconStyle);
        
                featuresArray.push(iconFeature);
            }

            // Add result points to map
            const vectorSource = new ol.source.Vector({
                features: featuresArray,
            });
            
            const vectorLayer = new ol.layer.Vector({
                name: 'placesLayer',
                source: vectorSource
            });
        
            map.addLayer(vectorLayer);
            
            // if there are no results, put a message saying that
            if(document.getElementById("placeList") && document.getElementById("placeList").childElementCount == 0)
                document.getElementById("placeList").innerHTML = "Nenhum lugar encontrado.";

        } catch (err) {
            console.log(err)
            /*console.log("An error occurred: " + err.status)
            console.error(await err.response.json())*/
        }

    } else {
        // hide the placeSearchMenu if it is showing and put map to normal
        if (document.querySelector('#placeSearchMenu')) {
            hidePlaceSearchMenu()
        }
    }
}

function hidePlaceSearchMenu() {
    // Hide the place search menu
    document.getElementById('placeSearchMenu').remove()

    // Set the map back to default
    mapElement = document.getElementById('map');
    mapElement.style.height = '92%';
    mapElement.style.bottom = '0';
    document.getElementById('searchBar').value = '';

    // Hide the loading animation if it is showing
    if (document.querySelector(".lds-ring"))
        document.querySelector(".lds-ring").remove();

    // Remove the results layer
    map.getLayers().getArray()
    .filter(layer => layer.get('name') === "placesLayer" || layer.get('name') === "stationsLayer" || layer.get('name') === "routeLayer")
    .forEach(layer => map.removeLayer(layer));

    // Add back the stations layer
    get_stations();
}

function viewRoute(toCoordinates) {
    // Remove the stationsLayer from the map
    map.getLayers().getArray()
    .filter(layer => layer.get('name') === "stationsLayer")
    .forEach(layer => map.removeLayer(layer));

    getLocation(false);

    checkPos = function (toCoordinates) {
        if(typeof pos == "undefined" || typeof pos == "null")
            setTimeout(checkPos.bind(null, toCoordinates), 0);
        else {
            // Calculate and display the route on the map when we have the user position
            calculateFullRoute(pos, toCoordinates)
        }
    }

    checkPos(toCoordinates);
}

function addStationPointToMap(station, start=true) {
    
    let position = [station.longitude, station.latitude]

    const iconFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(position)),
        name: station.serialNumber
    });

    let width;

    if (start) {
        if (station.bikes == 0) {
            width = 10;
        } else if (12 + station.bikes * 0.2 < 18) {
            width = 12 + station.bikes * 0.2;
        } else {
            width = 18;
        }
    } else {
        if ((station.docks - station.bikes) == 0) {
            width = 10;
        } else if (12 + (station.docks - station.bikes) * 0.2 < 18) {
            width = 12 + (station.docks - station.bikes) * 0.2;
        } else {
            width = 18;
        }
    }

    const iconStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: width,
            fill: new ol.style.Fill({
                color: "#79C000",
            }),
            stroke: new ol.style.Stroke({
                color: "#FFFFFF",
                width: 1,
            }),
        }),
        text: new ol.style.Text({
            text: start ? station.bikes.toString() : (station.docks - station.bikes).toString(),
            font: "bold 12px sans-serif",
            offsetX: 0,
            textAlign: "center",
            fill: new ol.style.Fill({
                color: "#FFFFFF"
            }),
        })
    });
    
    iconFeature.setStyle(iconStyle);

    const vectorSource = new ol.source.Vector({
        features: [iconFeature],
    });
    
    const vectorLayer = new ol.layer.Vector({
        name: 'stationsLayer',
        source: vectorSource,
        zIndex: 10
    });

    map.addLayer(vectorLayer);
}