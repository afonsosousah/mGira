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
	const source = new ol.source.XYZ({
		url: "https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
		maxZoom: 20,
		attributions: ['<a href="https://openstreetmap.org/"><em>© OpenStreetMap contributors</em></a>'],
	});

	const cyclewaysSource = new ol.source.Vector({
		url: "https://opendata.arcgis.com/api/v3/datasets/440b7424a6284e0b9bf11179b95bf8d1_0/downloads/data?format=geojson&spatialRefId=4326",
		format: new ol.format.GeoJSON(),
	});

	const infoLabel = document.createElement("i");
	infoLabel.classList.add("bi", "bi-info");

	const attribution = new ol.control.Attribution({
		collapsible: true,
		label: infoLabel,
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
			center: ol.proj.fromLonLat([-9.142685, 38.736946]), // center in Lisbon
			zoom: 12,
		}),
		controls: [new ol.control.Rotate(), attribution],
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

	/* Run the startup functions */

	// Check if the user is logged in, if not, prompt to login
	const refreshTokenCookie = getCookie("refreshToken");
	if (refreshTokenCookie) {
		user.refreshToken = refreshTokenCookie;
	} else {
		openLoginMenu();
		return;
	}

	// Check if the user has a stored access token
	const accessTokenCookie = getCookie("accessToken");
	if (accessTokenCookie) {
		user.accessToken = accessTokenCookie;
	}

	// Start WebSocket connection
	startWSConnection();

	// Get all user details
	getUserInformation();

	// Check if update info should be shown
	showUpdateInfoIfNeeded();

	// Get the stations and load them to the map
	//await getStations();

	// Get the user location on app open
	getLocation();

	// Start rotation of location dot
	startLocationDotRotation();
}

function mapDotSVG(ratio) {
	// Calculate the Y coordinate at which the top of the "fill" rectangle will be
	// (the filled area is only visible from y=18 to y=430)
	const y = (18 + (1 - ratio) * (430 - 18)).toFixed(0);

	// Create the SVG itself
	const svgString = `
	<svg version="1.1" id="svg1" xmlns="http://www.w3.org/2000/svg" width="330" height="460">
		<defs id="defs1">
				<clipPath clipPathUnits="userSpaceOnUse" id="clipPath2">
					<rect
						style="fill:none;fill-opacity:1;stroke:#000000;stroke-width:1.88976;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1"
						id="rect3" width="330" height="460" x="0" y="${y}" />
				</clipPath>
			</defs>
		<path
			style="display:inline;fill:#e0e0e0;fill-opacity:1;stroke:#79c000;stroke-width:18.7654;stroke-dasharray:none;stroke-opacity:1"
			d="m 150.64877,9.8461145 c 57.16501,-4.258271 111.80887,20.7649535 143.44461,69.5189515 12.7641,19.67082 22.23978,42.693894 25.06946,65.999984 1.34592,11.08539 1.94787,21.74182 1.0531,33 -1.7515,22.03766 -9.10877,42.82477 -18.33856,63 -14.32541,31.31363 -32.31354,60.48767 -51.56003,89 -18.047,26.73535 -37.56418,52.55286 -57.38361,77.99997 -6.85646,8.80334 -27.29104,35.89627 -27.29104,35.89627 0,0 -21.06879,-25.43823 -27.71569,-33.89642 -21.15264,-26.91672 -41.528643,-54.50803 -60.495103,-82.99982 -26.462,-39.75177 -58.07102,-85.91321 -66.12871,-134 -1.3324596,-7.95187 -1.8654696,-15.94962 -1.9170296,-24 -0.0518,-8.09448 0.484,-15.95865 1.2292996,-24 C 17.147547,74.88771 81.088477,15.027725 150.64877,9.8461145"
			id="path1"
		/>
		<path
			style="display:inline;fill:#79c000;fill-opacity:1;stroke:#79c000;stroke-width:18.7654;stroke-dasharray:none;stroke-opacity:1"
			d="m 150.64877,9.8461145 c 57.16501,-4.258271 111.80887,20.7649535 143.44461,69.5189515 12.7641,19.67082 22.23978,42.693894 25.06946,65.999984 1.34592,11.08539 1.94787,21.74182 1.0531,33 -1.7515,22.03766 -9.10877,42.82477 -18.33856,63 -14.32541,31.31363 -32.31354,60.48767 -51.56003,89 -18.047,26.73535 -37.56418,52.55286 -57.38361,77.99997 -6.85646,8.80334 -27.29104,35.89627 -27.29104,35.89627 0,0 -21.06879,-25.43823 -27.71569,-33.89642 -21.15264,-26.91672 -41.528643,-54.50803 -60.495103,-82.99982 -26.462,-39.75177 -58.07102,-85.91321 -66.12871,-134 -1.3324596,-7.95187 -1.8654696,-15.94962 -1.9170296,-24 -0.0518,-8.09448 0.484,-15.95865 1.2292996,-24 C 17.147547,74.88771 81.088477,15.027725 150.64877,9.8461145"
			id="path2"  clip-path="url(#clipPath2)"
		/>
	</svg>`;

	// Create a data URI from the SVG string
	const svgDataURI = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

	return svgDataURI;
}

async function loadStationMarkersFromArray(stationsArray) {
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

			iconStyle = new ol.style.Style({
				image: new ol.style.Icon({
					width: 33,
					height: 46,
					anchor: [0.5, 1],
					anchorXUnits: "fraction",
					anchorYUnits: "fraction",
					src: mapDotSVG(bikeRatio),
				}),
				text: new ol.style.Text({
					text: station.bikes.toString(),
					font: "bold 15px sans-serif",
					offsetX: 0,
					offsetY: -28,
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

		const source = stationsLayer.getSource();

		// Refresh the features
		source.clear();
		source.addFeatures(featuresArray);
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
							zoom: 16,
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
