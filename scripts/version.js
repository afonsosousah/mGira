// Current version number
const currentVersion = "0.0.4";

// Changelog HTML
const changelogHTML = `
Nova versão 0.0.4!<br>
<ul>
    <li>Novo menu de estatísticas</li>
    <li>Novo menu de histórico de viagens</li>
    <li>Navegação em 3D e bastante melhorada</li>
    <li>Ciclovias mostradas no mapa (obrigado Francisco Zhuo e Tomás Rodrigues)</li>
    <li>Melhorias gerais no código (obrigado Rodrigo Leitão)</li>
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
			document.cookie = "version=" + currentVersion + "; expires=" + expiryDate.toGMTString();
		}
	}, 1500);
}
