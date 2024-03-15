let theme = "light";

function detectTheme() {
	if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
		setTheme("dark");
	}
}

function setTheme(newTheme) {
	theme = newTheme;

	if (theme === "light") {
	} else if (theme === "dark") {
		// Change map theme
		if (map) {
			const source = new ol.source.XYZ({
				url: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
				maxZoom: 20,
				attributions: ['<a href="https://openstreetmap.org/"><em>© OpenStreetMap contributors</em></a>'],
			});

			const baseLayer = map
				.getLayers()
				.getArray()
				.filter(layer => layer.get("name") === "baseLayer")[0];

			baseLayer.setSource(source);
		}
	}
}
