// Current version number
const currentVersion = "0.0.5-alpha";

// Changelog HTML
const changelogHTML = `
Nova versão 0.0.5!<br>
<ul>
    <li>Ainda não há um changelog.</li>
</ul>
`;

function showUpdateInfoIfNeeded() {
	setTimeout(() => {
		// Set the cookie expiry to 1 year after today.
		const expiryDate = new Date();
		expiryDate.setFullYear(expiryDate.getFullYear() + 1);

		// Check version to show update notes
		const userVersion = getCookie("version");
		if (userVersion !== currentVersion) {
			alert(changelogHTML);
			createCookie("version", currentVersion, expiryDate);
		}
	}, 1500);
}
