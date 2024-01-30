let map;
let infoWindow;
let currentLocationMarker;
let previousSelectedMarker;
let pos;
let speed;
let compassHeading = null; // null by default so that any math will assume 0

async function initMap() {
	// Set cycleways style
	const cyclewaysStyle = new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: "#79c000",
			width: 2,
		}),
	});

	// Styled map
	const key = "RgT5fNTLsVXnsXKz4kG6";

	const source = new ol.source.XYZ({
		url: "https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=" + key,
		tileSize: 512,
	});

	const cyclewaysSource = new ol.source.Vector({
		url: "https://opendata.arcgis.com/api/v3/datasets/440b7424a6284e0b9bf11179b95bf8d1_0/downloads/data?format=geojson&spatialRefId=4326",
		format: new ol.format.GeoJSON(),
	});

	map = new ol.Map({
		target: "map",
		layers: [
			new ol.layer.Tile({
				source: source,
			}),
			new ol.layer.Vector({
				source: cyclewaysSource,
				style: cyclewaysStyle,
				name: "cyclewaysLayer",
			}),
		],
		view: new ol.View({
			center: ol.proj.fromLonLat([-9.142685, 38.736946]),
			zoom: 12,
		}),
		controls: [new ol.control.Rotate(), new ol.control.Attribution()],
	});

	// display popup on click
	map.on("click", evt => {
		const result = map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => ({ feature: feature, layer: layer }));
		if (!result) return;

		let feature = result.feature;
		let layer = result.layer;

		if (layer.get("name") === "stationsLayer") openStationMenu(feature.get("name"));
		else if (layer.get("name") === "placesLayer")
			viewRoute(ol.proj.transform(feature.getGeometry().getCoordinates(), "EPSG:3857", "EPSG:4326"));
	});

	// Get the stations and load them to the map
	await getStations();

	// Get the user location on app open
	getLocation();

	// Start rotation of location dot
	startLocationDotRotation();
}

async function loadStationMarkersFromArray(stationsArray) {
	// Wait for map to finish loading
	while (typeof map !== "object") {
		console.log("map has not loaded");
		await new Promise(resolve => setTimeout(resolve, 200));
	}

	// Wait for map to finish loading
	while (typeof map !== "object") {
		console.log("map has not loaded");
		await new Promise(resolve => setTimeout(resolve, 200));
	}

	let featuresArray = [];

	for (const [featureID, station] of stationsArray.entries()) {
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
				zIndex: featureID,
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
				zIndex: featureID,
			});

		iconFeature.setStyle(iconStyle);

		featuresArray.push(iconFeature);
	}

	if (
		map
			.getLayers()
			.getArray()
			.filter(layer => layer.get("name") === "stationsLayer").length === 0
	) {
		// Add a new layer if there is none
		const vectorSource = new ol.source.Vector({
			features: featuresArray,
		});
		const vectorLayer = new ol.layer.Vector({
			className: "stationsLayer",
			name: "stationsLayer",
			source: vectorSource,
			zIndex: 0,
			//declutter: true
		});

		// Add the layer
		map.addLayer(vectorLayer);
	} else {
		// Get the layer containing the previous current location
		const stationsLayer = map
			.getLayers()
			.getArray()
			.find(layer => layer.get("name") === "stationsLayer");

		// Refresh the features
		stationsLayer.getSource().set("features", featuresArray, true);
	}

	// Hide login menu if it is showing
	if (document.querySelector(".login-menu")) document.querySelector(".login-menu").remove();
}

function zoomIn() {
	map.getView().animate({
		zoom: map.getView().getZoom() + 1,
		duration: 250,
	});
}

function zoomOut() {
	map.getView().animate({
		zoom: map.getView().getZoom() - 1,
		duration: 250,
	});
}

function getLocation(zoom = true) {
	// Try HTML5 geolocation.
	if (navigator.geolocation) {
		navigator.geolocation.watchPosition(
			async position => {
				// Convert to the OpenLayers format
				pos = [position.coords.longitude, position.coords.latitude];
				speed = position.coords.speed ?? 0;

				let speedKMH = (speed * 60 * 60) / 1000;
				if (document.getElementById("speed")) document.getElementById("speed").innerHTML = speedKMH.toFixed(0); // convert m/s to km/h

				const iconFeature = new ol.Feature({
					geometry: new ol.geom.Point(ol.proj.fromLonLat(pos)),
					name: "Current location",
				});

				const iconStyle = new ol.style.Style({
					image: new ol.style.Icon({
						width: 40,
						height: 40,
						anchor: [0.5, 0.5],
						anchorXUnits: "fraction",
						anchorYUnits: "fraction",
						src: "assets/images/gps_dot.png",
						rotation: compassHeading + map.getView().getRotation(), // have map rotation into account
					}),
				});

				iconFeature.setStyle(iconStyle);
				const vectorSource = new ol.source.Vector({
					features: [iconFeature],
				});

				const vectorLayer = new ol.layer.Vector({
					name: "currentLocationLayer",
					source: vectorSource,
					zIndex: 99,
				});

				if (
					map
						.getLayers()
						.getArray()
						.filter(layer => layer.get("name") === "currentLocationLayer").length === 0
				) {
					// Add the layer
					map.addLayer(vectorLayer);
				} else {
					// Get the layer containing the previous current location
					const currentLocationLayer = map
						.getLayers()
						.getArray()
						.find(layer => layer.get("name") === "currentLocationLayer");

					// Refresh the feature
					let feature = currentLocationLayer.getSource().getFeatures()[0];
					feature.setStyle(iconStyle);
					feature.getGeometry().setCoordinates(ol.proj.fromLonLat(pos));
				}
			},
			error => console.log(error ? error : "Error: Your browser doesn't support geolocation."),
			{
				enableHighAccuracy: true,
			}
		);

		// Pan to location only once when position has been set
		if (zoom) {
			checkPos = () => {
				if (!pos) setTimeout(checkPos, 0);
				else {
					// Draw the new location dot only once
					const iconFeature = new ol.Feature({
						geometry: new ol.geom.Point(ol.proj.fromLonLat(pos)),
						name: "Current location",
					});

					let iconStyle = new ol.style.Style({
						image: new ol.style.Icon({
							width: 40,
							height: 40,
							anchor: [0.5, 0.5],
							anchorXUnits: "fraction",
							anchorYUnits: "fraction",
							src: "assets/images/gps_dot.png",
							rotation: compassHeading + map.getView().getRotation(), // have map rotation into account
						}),
					});

					iconFeature.setStyle(iconStyle);
					const vectorSource = new ol.source.Vector({
						features: [iconFeature],
					});

					const vectorLayer = new ol.layer.Vector({
						name: "currentLocationLayer",
						source: vectorSource,
						zIndex: 99,
					});

					if (
						map
							.getLayers()
							.getArray()
							.filter(layer => layer.get("name") === "currentLocationLayer").length === 0
					) {
						// Add the layer
						map.addLayer(vectorLayer);
					} else {
						// Get the layer containing the previous current location
						const currentLocationLayer = map
							.getLayers()
							.getArray()
							.filter(layer => layer.get("name") === "currentLocationLayer")[0];

						// Refresh the feature
						let feature = currentLocationLayer.getSource().getFeatures()[0];
						feature.setStyle(iconStyle);
						feature.getGeometry().setCoordinates(ol.proj.fromLonLat(pos));
					}

					// Pan to location only once
					if (map.getView().getZoom() < 13.5) {
						// Pan to location
						const view = map.getView();
						view.animate({
							center: ol.proj.fromLonLat(pos),
							zoom: 17,
							duration: 100,
						});
					} else {
						// Pan to location
						const view = map.getView();
						view.animate({
							center: ol.proj.fromLonLat(pos),
							zoom: map.getView().getZoom(), // use the current zoom
							duration: 100,
						});
					}
				}
			};

			checkPos();
		}
	} else {
		// Browser doesn't support Geolocation
		console.log("Error: Your browser doesn't support geolocation.");
	}
}

function startLocationDotRotation() {
	let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

	let handler = e => {
		// Get current compass heading in degrees
		let currentOrientation;
		if (typeof e.webkitCompassHeading === "undefined") {
			currentOrientation = -(e.alpha + (e.beta * e.gamma) / 90);
			currentOrientation -= Math.floor(currentOrientation / 360) * 360; // Wrap into range [0,360].
		} else currentOrientation = e.webkitCompassHeading;

		// Calculate the current compass heading that the user is 'looking at' (in radians) (global)
		compassHeading = -(Math.PI / 180) * (360 - currentOrientation);

		// Adjust heading if device is on landscape
		if (window.matchMedia("(orientation: landscape)").matches) compassHeading += (Math.PI / 180) * 90;

		if (!pos) return;

		// Set rotation of map dot
		const iconFeature = new ol.Feature({
			geometry: new ol.geom.Point(ol.proj.fromLonLat(pos)),
			name: "Current location",
		});

		const iconStyle = new ol.style.Style({
			image: new ol.style.Icon({
				width: 40,
				height: 40,
				anchor: [0.5, 0.5],
				anchorXUnits: "fraction",
				anchorYUnits: "fraction",
				src: "assets/images/gps_dot.png",
				rotation: compassHeading + map.getView().getRotation(), // have map rotation into account
			}),
		});

		iconFeature.setStyle(iconStyle);
		const vectorSource = new ol.source.Vector({
			features: [iconFeature],
		});

		const vectorLayer = new ol.layer.Vector({
			name: "currentLocationLayer",
			source: vectorSource,
			zIndex: 99,
		});

		if (
			map
				.getLayers()
				.getArray()
				.filter(layer => layer.get("name") === "currentLocationLayer").length === 0
		) {
			// Add the layer
			map.addLayer(vectorLayer);
		} else {
			// Get the layer containing the previous current location
			const currentLocationLayer = map
				.getLayers()
				.getArray()
				.find(layer => layer.get("name") === "currentLocationLayer");

			// Refresh the feature
			let feature = currentLocationLayer.getSource().getFeatures()[0];
			feature.setStyle(iconStyle);
			feature.getGeometry().setCoordinates(ol.proj.fromLonLat(pos));
		}
	};

	if (isIOS) {
		// create function for prompting user
		const promptUserForPermission = () => {
			createCustomYesNoPrompt(
				"Nos dispositivos Apple, é necessária permissão do utilizador para aceder à bússola do dispositivo.",
				() => {
					// User clicked OK
					DeviceOrientationEvent.requestPermission()
						.then(response => {
							if (response === "granted") {
								window.addEventListener("deviceorientation", e => requestAnimationFrame(() => handler(e)), true);
							} else {
								alert("A orientação não irá funcionar corretamente!");
							}
						})
						.catch(() => alert("Bússola não suportada"));
				},
				// User clicked Ignore
				() => alert("A orientação não irá funcionar corretamente!"),
				"Ok",
				"Ignorar"
			);
		};

		// If the in initial requestPermission fails, it means the user hasn't given permission previously
		// and we should prompt the user to do so (UI interaction is needed)
		DeviceOrientationEvent.requestPermission()
			.then(response => {
				if (response === "granted") {
					window.addEventListener("deviceorientation", e => requestAnimationFrame(() => handler(e)), true);
				} else {
					// Let the user give permission if he has previously rejected it
					promptUserForPermission();
				}
			})
			// Permission had not been given before
			.catch(() => promptUserForPermission());
	} else {
		window.addEventListener("deviceorientationabsolute", e => requestAnimationFrame(() => handler(e)), true);
	}
}
