let orsApiKey = "5b3ce3597851110001cf62482bb7bca6e13347a192fe3b623a2cd57d";
let currentRouteCoordinates;
let dropoffStation;
let finalDestination;

async function calculateFullRoute(fromCoordinates, toCoordinates) {
	// Remove any previous loading animations
	const oldSpinner = document.getElementById("spinner");
	if (oldSpinner) oldSpinner.remove();

	// Loading animation over the map while the route is being calculated
	let loadingElement = document.createElement("img");
	loadingElement.id = "spinner";
	loadingElement.src = "assets/images/mGira_spinning.gif";
	loadingElement.style.top = "calc(35% - 40px)";
	document.body.appendChild(loadingElement);

	// Remove previous layer containing the results, the stations layer and the previous route layer
	map
		.getLayers()
		.getArray()
		.filter(
			layer =>
				layer.get("name") === "placesLayer" ||
				layer.get("name") === "stationsLayer" ||
				layer.get("name") === "routeLayer"
		)
		.forEach(layer => map.removeLayer(layer));

	// Hide cycleways layer
	map
		.getLayers()
		.getArray()
		.find(layer => layer.get("name") === "cyclewaysLayer")
		.setVisible(false);

	// select the stations from which the user should grab the bike and leave the bike
	// from the 3 stations nearer to the starting point and the 3 stations nearer to the ending point
	// make a rough calculation on which of the combinations will result in the less distance (which should take less time)
	let nearestStationsStart = getStationsByDistance(fromCoordinates).slice(0, 3);
	let nearestStationsEnd = getStationsByDistance(toCoordinates).slice(0, 3);

	let bestDistance;
	let grabStation;
	let dropoffStationInternal;

	for (stationStart of nearestStationsStart) {
		for (stationEnd of nearestStationsEnd) {
			const walkingDistanceToStartStation = distance(fromCoordinates, [stationStart.longitude, stationStart.latitude]);
			const cyclingDistanceFromStartToEnd = distance(
				[stationStart.longitude, stationStart.latitude],
				[stationEnd.longitude, stationEnd.latitude]
			);
			const walkingDistanceFromEndStation = distance([stationEnd.longitude, stationEnd.latitude], toCoordinates);

			const totalTripDistance =
				walkingDistanceToStartStation + cyclingDistanceFromStartToEnd + walkingDistanceFromEndStation;

			if (bestDistance && totalTripDistance < bestDistance) {
				bestDistance = totalTripDistance;
				grabStation = stationStart;
				dropoffStationInternal = stationEnd;
			} else if (!bestDistance) {
				bestDistance = totalTripDistance;
				grabStation = stationStart;
				dropoffStationInternal = stationEnd;
			}
		}
	}

	// Store dropoff station as global (to be accesssed in navigation)
	dropoffStation = dropoffStationInternal;

	// Store final destination as global (to be accesssed in navigation)
	finalDestination = toCoordinates;

	let totalDistance = 0; // will be in meters and exact
	let totalTime = 0; // will be in seconds
	let routeSummaryBike;
	let routeSummaryFoot1;
	let routeSummaryFoot2;
	let walkingOnly = false;
	let allCoordinates = [];

	// If the grab station and droppoff station are the same, we should calculate the route on foot
	if (grabStation.code === dropoffStation.code) {
		// Calculate only on foot route

		// Calculate walking route from start to end
		routeSummaryFoot1 = await calculateRoute(fromCoordinates, toCoordinates, false);
		totalDistance += routeSummaryFoot1.distance;
		totalTime += routeSummaryFoot1.duration;
		//routeSummaryBike = routeSummaryFoot1; // we need to set this for the bbox to be set
		allCoordinates.push(...routeSummaryFoot1.coordinates);

		// Set that the route is walking only
		walkingOnly = true;
	} else {
		// Calculate normal Gira route

		// Calculate walking route from start to station
		routeSummaryFoot1 = await calculateRoute(fromCoordinates, [grabStation.longitude, grabStation.latitude], false);
		totalDistance += routeSummaryFoot1.distance;
		totalTime += routeSummaryFoot1.duration;
		allCoordinates.push(...routeSummaryFoot1.coordinates);

		// Now calculate cycling route from start station to end station
		routeSummaryBike = await calculateRoute(
			[grabStation.longitude, grabStation.latitude],
			[dropoffStation.longitude, dropoffStation.latitude],
			true
		);
		totalDistance += routeSummaryBike.distance;
		totalTime += routeSummaryBike.duration * 0.8; // Adjust time because the Gira ebike will be faster than the default on openrouteservice
		allCoordinates.push(...routeSummaryBike.coordinates);

		// Finnaly, calculate walking route from station to end
		routeSummaryFoot2 = await calculateRoute([dropoffStation.longitude, dropoffStation.latitude], toCoordinates, false);
		totalDistance += routeSummaryFoot2.distance;
		totalTime += routeSummaryFoot2.duration;
		allCoordinates.push(...routeSummaryFoot2.coordinates);

		// Add start station point to map
		addStationPointToMap(grabStation, true);

		// Add end station point to map
		addStationPointToMap(dropoffStation, false);
	}

	// Remove the duplicate coordinates arrays inside allCoordinates
	allCoordinates = allCoordinates.filter(((t = {}), a => !(t[a] = a in t))); // explanation https://stackoverflow.com/questions/53452875/find-if-two-arrays-are-repeated-in-array-and-then-select-them

	// Save the coordinates in a global variable to be used in the navigation
	currentRouteCoordinates = allCoordinates;

	// Hide loading animation
	loadingElement.remove();

	// Calculate resulting bbox of all the routes
	const bboxFoot1 = convertBbox(routeSummaryFoot1.bbox);
	const bboxBike = convertBbox(routeSummaryBike?.bbox ?? routeSummaryFoot1.bbox);
	const bboxFoot2 = convertBbox(routeSummaryFoot2?.bbox ?? routeSummaryFoot1.bbox);

	const xMin = Math.min(bboxFoot1[0], bboxBike[0], bboxFoot2[0]);
	const yMin = Math.min(bboxFoot1[1], bboxBike[1], bboxFoot2[1]);
	const xMax = Math.max(bboxFoot1[2], bboxBike[2], bboxFoot2[2]);
	const yMax = Math.max(bboxFoot1[3], bboxBike[3], bboxFoot2[3]);

	const convertedBbox = [xMin, yMin, xMax, yMax];

	if (window.matchMedia("(orientation: portrait)").matches) {
		const offset =
			document.getElementById("placeSearchMenu")?.clientHeight ??
			document.getElementById("stationMenu")?.clientHeight + 30 ??
			0;
		map.getView().fit(convertedBbox, {
			padding: [50, 100, 120 + offset, 100],
			maxZoom: 16.5,
		});
	} else if (window.matchMedia("(orientation: landscape)").matches) {
		const offset =
			document.getElementById("placeSearchMenu")?.clientWidth ??
			document.getElementById("stationMenu")?.clientWidth ??
			0;
		map.getView().fit(convertedBbox, {
			padding: [50, 100, 50, 100 + offset],
			maxZoom: 16.5,
		});
	}

	// Show the start navigation button and route details panel
	const targetElement = document.querySelector("#placeSearchMenu") ?? document.querySelector("#stationMenu");

	// create start Navigation button
	const startNavigationButtonElement = document.createElement("div");
	startNavigationButtonElement.id = "startNavigationButton";
	startNavigationButtonElement.innerHTML = '<i class="bi bi-sign-turn-slight-right"></i>';
	startNavigationButtonElement.addEventListener("click", () => startNavigation(walkingOnly));

	// create route Details panel
	const routeDetailsElement = document.createElement("div");
	routeDetailsElement.id = "routeDetails";
	routeDetailsElement.innerHTML = `
		<i class="bi bi-clock"></i>&nbsp;${parseMillisecondsIntoTripTime(totalTime * 1000)}
		&nbsp;&nbsp;&nbsp;
		<i class="bi bi-signpost"></i>&nbsp;${Math.round((totalDistance / 1000) * 10) / 10}km
	`; // round distance to 1 decimal place

	targetElement.appendChild(startNavigationButtonElement);
	targetElement.appendChild(routeDetailsElement);
}

async function recalculateFullRoute(fromCoordinates, toCoordinates) {
	// Loading animation over the map while the route is being calculated
	let loadingElement = document.createElement("img");
	loadingElement.id = "spinner";
	loadingElement.src = "assets/images/mGira_spinning.gif";
	loadingElement.style.top = "calc(35% - 40px)";
	document.body.appendChild(loadingElement);

	// Remove previous layer containing the results, the stations layer and the previous route layer
	map
		.getLayers()
		.getArray()
		.filter(
			layer =>
				layer.get("name") === "placesLayer" ||
				layer.get("name") === "stationsLayer" ||
				layer.get("name") === "routeLayer"
		)
		.forEach(layer => map.removeLayer(layer));

	// Hide cycleways layer
	map
		.getLayers()
		.getArray()
		.find(layer => layer.get("name") === "cyclewaysLayer")
		.setVisible(false);

	// select the stations from which the user should grab the bike and leave the bike
	// from the 3 stations nearer to the starting point and the 3 stations nearer to the ending point
	// make a rough calculation on which of the combinations will result in the less distance (which should take less time)
	let nearestStationsStart = getStationsByDistance(fromCoordinates).slice(0, 3);
	let nearestStationsEnd = getStationsByDistance(toCoordinates).slice(0, 3);

	let bestDistance;
	let grabStation;
	let dropoffStationInternal;

	for (stationStart of nearestStationsStart) {
		for (stationEnd of nearestStationsEnd) {
			const walkingDistanceToStartStation = distance(fromCoordinates, [stationStart.longitude, stationStart.latitude]);
			const cyclingDistanceFromStartToEnd = distance(
				[stationStart.longitude, stationStart.latitude],
				[stationEnd.longitude, stationEnd.latitude]
			);
			const walkingDistanceFromEndStation = distance([stationEnd.longitude, stationEnd.latitude], toCoordinates);

			const totalTripDistance =
				walkingDistanceToStartStation + cyclingDistanceFromStartToEnd + walkingDistanceFromEndStation;

			if (bestDistance && totalTripDistance < bestDistance) {
				bestDistance = totalTripDistance;
				grabStation = stationStart;
				dropoffStationInternal = stationEnd;
			} else if (!bestDistance) {
				bestDistance = totalTripDistance;
				grabStation = stationStart;
				dropoffStationInternal = stationEnd;
			}
		}
	}

	// Store dropoff station as global (to be accesssed in navigation)
	dropoffStation = dropoffStationInternal;

	// Store final destination as global (to be accesssed in navigation)
	finalDestination = toCoordinates;

	let totalDistance = 0; // will be in meters and exact
	let totalTime = 0; // will be in seconds
	let routeSummaryBike;
	let routeSummary;
	let walkingOnly = false;
	let allCoordinates = [];

	// If the grab station and droppoff station are the same, we should calculate the route on foot
	if (grabStation.code === dropoffStation.code) {
		// Calculate only on foot route

		// Calculate walking route from start to end
		routeSummary = await calculateRoute(fromCoordinates, toCoordinates, false);
		totalDistance += routeSummary.distance;
		totalTime += routeSummary.duration;
		routeSummaryBike = routeSummary; // we need to set this for the bbox to be set
		allCoordinates.push(...routeSummary.coordinates);

		// Set that the route is walking only
		walkingOnly = true;
	} else {
		// Calculate normal Gira route

		if (navigationMode !== "bike") {
			// Calculate walking route from start to station
			routeSummary = await calculateRoute(fromCoordinates, [grabStation.longitude, grabStation.latitude], false);
			totalDistance += routeSummary.distance;
			totalTime += routeSummary.duration;
			allCoordinates.push(...routeSummary.coordinates);

			// Now calculate cycling route from start station to end station
			routeSummaryBike = await calculateRoute(
				[grabStation.longitude, grabStation.latitude],
				[dropoffStation.longitude, dropoffStation.latitude],
				true
			);
			totalDistance += routeSummaryBike.distance;
			totalTime += routeSummaryBike.duration * 0.8; // Adjust time because the Gira ebike will be faster than the default on openrouteservice
			allCoordinates.push(...routeSummaryBike.coordinates);
		} else {
			// Calculate cycling route from current location to end station
			routeSummaryBike = await calculateRoute(
				fromCoordinates,
				[dropoffStation.longitude, dropoffStation.latitude],
				true
			);
			totalDistance += routeSummaryBike.distance;
			totalTime += routeSummaryBike.duration * 0.8; // Adjust time because the Gira ebike will be faster than the default on openrouteservice
			allCoordinates.push(...routeSummaryBike.coordinates);
		}

		// Finnaly, calculate walking route from station to end
		routeSummary = await calculateRoute([dropoffStation.longitude, dropoffStation.latitude], toCoordinates, false);
		totalDistance += routeSummary.distance;
		totalTime += routeSummary.duration;
		allCoordinates.push(...routeSummary.coordinates);

		// Add start station point to map
		if (navigationMode !== "bike") addStationPointToMap(grabStation, true);

		// Add end station point to map
		addStationPointToMap(dropoffStation, false);
	}

	// Remove the duplicate coordinates arrays inside allCoordinates
	allCoordinates = allCoordinates.filter(((t = {}), a => !(t[a] = a in t))); // explanation https://stackoverflow.com/questions/53452875/find-if-two-arrays-are-repeated-in-array-and-then-select-them

	// Save the coordinates in a global variable to be used in the navigation
	currentRouteCoordinates = allCoordinates;

	// Hide loading animation
	loadingElement.remove();
}

async function calculateRoute(fromCoordinates, toCoordinates, cycling = true) {
	let orsDirections = new Openrouteservice.Directions({ api_key: orsApiKey });

	try {
		let response = await orsDirections.calculate({
			coordinates: [fromCoordinates, toCoordinates],
			profile: cycling ? "cycling-regular" : "foot-walking",
			extra_info: ["waytype", "steepness"],
			format: "geojson",
		});

		// Set styles of map features
		const styles = {
			cycling: new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: "#79C000",
					width: 8,
					width: 4,
				}),
				zIndex: 0,
			}),
			walking: new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: "#231F20",
					width: 8,
					lineDash: [3, 9],
					width: 4,
				}),
				zIndex: 1,
			}),
		};
		const styleFunction = feature => styles[feature.type];

		// Load GeoJSON route to map

		// get existing routeLayer
		const routeLayer = map
			.getLayers()
			.getArray()
			.find(layer => layer.get("name") === "routeLayer");

		// convert the features
		const routeFeature = new ol.format.GeoJSON({
			dataProjection: "EPSG:4326",
			featureProjection: "EPSG:3857",
		}).readFeatures(response)[0];

		// set feature type
		routeFeature.type = cycling ? "cycling" : "walking";

		// check if there is already a routeLayer to load to
		if (routeLayer) {
			// Add the new features to the existing layer
			routeLayer.getSource().addFeatures([routeFeature]);
		} else {
			// Add a new layer
			const vectorLayer = new ol.layer.Vector({
				name: "routeLayer",
				source: new ol.source.Vector({
					features: [routeFeature],
				}),
				style: styleFunction,
			});
			map.addLayer(vectorLayer);
		}

		// return useful information
		let summary = response.features[0].properties.summary;
		return {
			distance: summary.distance ?? 0,
			duration: summary.duration ?? 0,
			bbox: response.bbox,
			coordinates: response.features[0].geometry.coordinates,
		};
	} catch (err) {
		console.log(err);
		console.log("An error occurred: " + err.status);
		console.error(await err.response.json());
	}
}

const degToRad = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
// Calculate the distance between two points in meters (given the latitude/longitude of those points).
function distance(point1, point2) {
	// Points are in [lon, lat] format
	const [lon1, lat1] = point1;
	const [lon2, lat2] = point2;
	if (lat1 === lat2 && lon1 === lon2) {
		return 0;
	} else {
		// Differences in coordinates
		const deltaLat = (lat2 - lat1) * degToRad;
		const deltaLon = (lon2 - lon1) * degToRad;

		// Haversine formula
		const haversineFormula =
			Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
			Math.cos(lat1 * degToRad) * Math.cos(lat2 * degToRad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
		const angularDistance = 2 * Math.atan2(Math.sqrt(haversineFormula), Math.sqrt(1 - haversineFormula));

		// Distance in kilometers
		const distance = EARTH_RADIUS_KM * angularDistance;

		return distance * 1000;
	}
}

function getStationsByDistance(currentLocation) {
	// Copy the stattions array
	let tempStationsArray = stationsArray;

	// Remove all the empty stations
	tempStationsArray = tempStationsArray.filter(obj => obj.bikes !== 0);

	// Calculate the distance for all the stations
	for (let station of tempStationsArray) {
		station.distance = distance(currentLocation, [station.longitude, station.latitude]);
	}

	// Sort by distance
	tempStationsArray.sort((a, b) => a.distance - b.distance);

	return tempStationsArray;
}

function showSearchBar() {
	// Stop following user
	followLocation = false;

	// don't show another search bar if one is shown
	if (document.getElementById("searchBarDiv")) return;

	// add search bar to document
	appendElementToBodyFromHTML(`
        <div id="searchBarDiv">
            <div id="searchBarCancelButton" onclick="hidePlaceSearchMenu()"><i class="bi bi-x"></i></div>
            <input type="search" id="searchBar" placeholder="Para onde vais a seguir?"></input>
        </div>
    `);

	// Search after user has stopped writing setup
	let typingTimer; //timer identifier
	let doneTypingInterval = 600; //time in ms
	let searchBar = document.getElementById("searchBar");

	//on keyup, start the countdown
	searchBar.addEventListener("keyup", () => {
		clearTimeout(typingTimer);
		if (searchBar.value) {
			typingTimer = setTimeout(doneTyping, doneTypingInterval);
		} else {
			// hide the placeSearchMenu if it is showing and put map to normal
			if (document.querySelector("#placeSearchMenu")) {
				hidePlaceSearchMenu();
			}
		}
	});

	// user is "finished typing," do something
	function doneTyping() {
		searchPlace();
	}

	// define a custom alert box
	if (document.getElementById) {
		window.alert = message =>
			// set timeout so that if the user clicks on the place where the button is, it doesn't get automatically clicked
			setTimeout(() => createCustomAlert(message), 50);
	}
}

async function searchPlace() {
	let query = document.getElementById("searchBar").value;

	if (query.length > 2) {
		console.log(query);

		const Geocode = new Openrouteservice.Geocode({ api_key: orsApiKey });

		// hide the placeSearchMenu if it is showing and put map to normal
		if (document.querySelector("#placeSearchMenu")) {
			const mapElement = document.getElementById("map");
			mapElement.style.height = "100%";
			mapElement.style.bottom = "0";
			document.querySelector("#placeSearchMenu").remove();
		}

		// show the bottom panel from the start so that the request delay is less noticeable
		const placeSearchMenu = document.createElement("div");
		placeSearchMenu.className = "place-search-menu";
		placeSearchMenu.id = "placeSearchMenu";
		document.body.appendChild(placeSearchMenu);

		// move zoom controls to top, to not be behind the place search menu
		document
			.getElementById("zoomControls")
			.classList.remove(
				"smooth-slide-top-zoom-controls",
				"smooth-slide-bottom-zoom-controls",
				"smooth-slide-up-zoom-controls",
				"smooth-slide-down-zoom-controls"
			); // reset classes
		document.getElementById("zoomControls").classList.add("smooth-slide-top-zoom-controls"); // move zoom controls up

		// Remove previous layer containing the previous results, the stations layer and the route layer
		map
			.getLayers()
			.getArray()
			.filter(
				layer =>
					layer.get("name") === "placesLayer" ||
					layer.get("name") === "stationsLayer" ||
					layer.get("name") === "routeLayer"
			)
			.forEach(layer => map.removeLayer(layer));

		// show loading animation
		placeSearchMenu.innerHTML = `<img src="assets/images/mGira_spinning.gif" id="spinner">`;

		try {
			let response = await Geocode.geocode({
				text: query,
				boundary_bbox: [
					[38.689932, -9.229717],
					[38.805336, -9.091187],
				],
				boundary_country: ["PT"],
				layers: ["venue", "address", "street"],
			});

			//console.log(response);

			// set the inner HTML after the animation has started
			placeSearchMenu.innerHTML = `
                <ul id="placeList">
                    <!-- Populate with the list here -->
                </ul>
            `.trim();

			// if there are no results, put a message saying that
			if (!response || response.features.length === 0) {
				document.getElementById("placeList").innerHTML = "Nenhum lugar encontrado";
				return;
			}

			let featuresArray = [];

			// Fit all the places to the map
			const convertedBbox = convertBbox(response.bbox);

			if (window.matchMedia("(orientation: portrait)").matches) {
				// Wait for the end of animation
				placeSearchMenu.addEventListener("animationend", event => {
					// Check if the animation that ended is the one you are interested in
					if (event.animationName === "smooth-appear") {
						const offset = placeSearchMenu.clientHeight;
						const padding = [100, 100, 100 + offset, 100];
						map.getView().fit(convertedBbox, { padding: padding, maxZoom: 16.5, duration: 200 });
					}
				});
			} else if (window.matchMedia("(orientation: landscape)").matches) {
				const offset = placeSearchMenu.clientWidth;
				const padding = [100, 100, 100, 100 + offset];
				map.getView().fit(convertedBbox, { padding: padding, maxZoom: 16.5 });
			}

			// get the results
			for (let result of response.features) {
				const resultElement = document.createElement("li");
				resultElement.className = "place-search-element";

				let position = result.geometry.coordinates;

				resultElement.innerHTML = `
                    <span class="name">${result.properties.name}</span>
					<span class="detail">${result.properties.street ?? result.properties.neighbourhood}</span>
                `.trim();

				resultElement.addEventListener("click", () => viewRoute(position));
				resultElement.addEventListener("mouseout", () => {
					let pixels = map.getPixelFromCoordinate(ol.proj.fromLonLat(position));

					// correct to the point
					pixels[1] -= 25;
					pixels[0] -= 10;

					const result = map.forEachFeatureAtPixel(pixels, (feature, layer) => ({ feature: feature, layer: layer }));
					if (!result) {
						return;
					}

					const iconStyle = new ol.style.Style({
						image: new ol.style.Icon({
							width: 40,
							height: 50,
							anchor: [0.5, 1],
							anchorXUnits: "fraction",
							anchorYUnits: "fraction",
							src: `assets/images/mapDotPlace.png`,
						}),
					});

					result.feature.setStyle(iconStyle);
				});
				resultElement.addEventListener("mouseover", () => {
					let pixels = map.getPixelFromCoordinate(ol.proj.fromLonLat(position));

					// correct to the point
					pixels[1] -= 25;
					pixels[0] -= 10;

					const result = map.forEachFeatureAtPixel(pixels, (feature, layer) => ({ feature: feature, layer: layer }));
					if (!result) return;

					const iconStyle = new ol.style.Style({
						image: new ol.style.Icon({
							width: 40,
							height: 50,
							anchor: [0.5, 1],
							anchorXUnits: "fraction",
							anchorYUnits: "fraction",
							src: `assets/images/mapDotPlace_black.png`,
						}),
					});

					result.feature.setStyle(iconStyle);
				});

				if (!document.querySelector("#placeList")) {
					return;
				}

				document.getElementById("placeList").appendChild(resultElement);

				const iconFeature = new ol.Feature({
					geometry: new ol.geom.Point(ol.proj.fromLonLat(position)),
					name: result.properties.name,
				});

				const iconStyle = new ol.style.Style({
					image: new ol.style.Icon({
						width: 40,
						height: 50,
						anchor: [0.5, 1],
						anchorXUnits: "fraction",
						anchorYUnits: "fraction",
						src: `assets/images/mapDotPlace.png`,
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
				name: "placesLayer",
				source: vectorSource,
			});

			map.addLayer(vectorLayer);
		} catch (err) {
			console.log(err);
			/*console.log("An error occurred: " + err.status)
            console.error(await err.response.json())*/
		}
	} else {
		// hide the placeSearchMenu if it is showing and put map to normal
		if (document.querySelector("#placeSearchMenu")) {
			hidePlaceSearchMenu();
		}
	}
}

function hidePlaceSearchMenu() {
	// Start following user again
	followLocation = true;

	// Hide search bar
	let searchBar = document.getElementById("searchBarDiv");
	if (searchBar) {
		searchBar.classList.add("slide-back-top");
		setTimeout(() => searchBar.remove(), 500); // remove element after animation end
	} else return;

	// Hide the place search menu
	if (document.getElementById("placeSearchMenu")) document.getElementById("placeSearchMenu").remove();
	else return;

	// Set the map back to default
	mapElement = document.getElementById("map");
	mapElement.style.height = "100%";
	mapElement.style.bottom = "0";

	// move zoom controls back down
	document.getElementById("zoomControls").classList.add("smooth-slide-bottom-zoom-controls");

	// Hide the loading animation if it is showing
	if (document.querySelector("#spinner")) document.querySelector("#spinner").remove();

	// Remove the results layer
	map
		.getLayers()
		.getArray()
		.filter(layer => ["placesLayer", "routeLayer"].includes(layer.get("name")))
		.forEach(layer => map.removeLayer(layer));

	// Add back the stations layer
	loadStationMarkersFromArray(stationsArray);

	// Pan to user location
	getLocation();
}

function viewRoute(toCoordinates) {
	// Remove the stationsLayer from the map
	map
		.getLayers()
		.getArray()
		.filter(layer => layer.get("name") === "stationsLayer")
		.forEach(layer => map.removeLayer(layer));

	getLocation(false);

	checkPos = function (toCoordinates) {
		if (typeof pos === "undefined" || typeof pos === "null") setTimeout(() => checkPos(toCoordinates), 0);
		else {
			// Calculate and display the route on the map when we have the user position
			calculateFullRoute(pos, toCoordinates);
		}
	};

	checkPos(toCoordinates);
}

function addStationPointToMap(station, start = true) {
	let position = [station.longitude, station.latitude];

	const iconFeature = new ol.Feature({
		geometry: new ol.geom.Point(ol.proj.fromLonLat(position)),
		name: station.serialNumber,
	});

	let iconStyle;
	if (station.docks !== 0) {
		const bikeRatio = station.bikes / station.docks;
		const filled =
			station.bikes === 0
				? 0
				: bikeRatio <= 0.15
				? 15
				: bikeRatio <= 0.3
				? 30
				: bikeRatio <= 0.5
				? 50
				: bikeRatio < 1
				? 80
				: 100;

		iconStyle = new ol.style.Style({
			image: new ol.style.Icon({
				width: 40,
				height: 50,
				anchor: [0.5, 1],
				anchorXUnits: "fraction",
				anchorYUnits: "fraction",
				src: `assets/images/mapDot_${filled}.png`,
			}),
			text: new ol.style.Text({
				text: station.bikes.toString(),
				font: "bold 15px sans-serif",
				offsetX: 0,
				offsetY: -30,
				textAlign: "center",
				fill: new ol.style.Fill({
					color: "#FFFFFF",
				}),
			}),
		});
	} else
		iconStyle = new ol.style.Style({
			image: new ol.style.Icon({
				width: 40,
				height: 50,
				anchor: [0.5, 1],
				anchorXUnits: "fraction",
				anchorYUnits: "fraction",
				src: `assets/images/mapDot_Deactivated.png`,
			}),
		});

	iconFeature.setStyle(iconStyle);

	const vectorSource = new ol.source.Vector({
		features: [iconFeature],
	});

	const vectorLayer = new ol.layer.Vector({
		name: "stationsLayer",
		source: vectorSource,
		zIndex: 10,
	});

	map.addLayer(vectorLayer);
}
