let map;
let infoWindow;
let currentLocationMarker;
let previousSelectedMarker;
let pos;
let gpsHeading;

async function initMap() {
	// Initialize the Map, centered on Lisbon
	map = new ol.Map({
		target: "map",
		layers: [
			new ol.layer.Tile({
				source: new ol.source.OSM(),
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
			let filled;
			if (station.bikes === 0) {
				filled = 0;
			} else if (station.bikes / station.docks <= 0.15) {
				filled = 15;
			} else if (station.bikes / station.docks <= 0.3) {
				filled = 30;
			} else if (station.bikes / station.docks <= 0.5) {
				filled = 50;
			} else if (station.bikes / station.docks <= 0.8) {
				filled = 80;
			} else {
				filled = 100;
			}

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
		featureID += 1;
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

				updatePositionAndRotationWhenNavigating();

				const iconFeature = new ol.Feature({
					geometry: new ol.geom.Point(ol.proj.fromLonLat(pos)),
					name: "Current location",
				});

				let iconStyle;

				if (navigationMode === "bike") {
					iconStyle = new ol.style.Style({
						image: new ol.style.Icon({
							anchor: [0.5, 0.5],
							anchorXUnits: "fraction",
							anchorYUnits: "fraction",
							src: "assets/images/topDownBike.png",
						}),
					});
				} else {
					iconStyle = new ol.style.Style({
						image: new ol.style.Icon({
							anchor: [0.5, 0.5],
							anchorXUnits: "fraction",
							anchorYUnits: "fraction",
							src: "assets/images/mapLocationDot.png",
						}),
					});
				}

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
							anchor: [0.5, 0.5],
							anchorXUnits: "fraction",
							anchorYUnits: "fraction",
							src: "assets/images/mapLocationDot.png",
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
		console.log(false ? error.message : "Error: Your browser doesn't support geolocation.");
	}
}
