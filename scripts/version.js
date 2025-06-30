// Current version number
const currentVersion = "0.1.2";

// Changelog HTML
const changelogHTML = `
Notas da versão ${currentVersion}<br>
<ul>
	<li>Correções de autenticação com Firebase e tokens de sessão</li>
	<li>Melhorias na experiência de localização e zoom no mapa</li>
	<li>Atualização do mapa para refletir alterações mais recentes</li>
	<li>Correção de problemas de visualização de estações e reservas</li>
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
			alert(changelogHTML, `<i class="bi bi-newspaper"></i>`);
			createCookie("version", currentVersion, expiryDate);
		}
	}, 1500);
}
