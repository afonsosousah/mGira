// Current version number
const currentVersion = "0.1.0";

// Changelog HTML
const changelogHTML = `
Notas da versão ${currentVersion}<br>
<ul>
	<li>Menu de histórico de viagens agora carrega gradualmente (obrigado Rodrigo Leitão)</li>
	<li>Melhoria no estilo das classificações das viagens (obrigado Rodrigo Leitão)</li>
	<li>Correção de um erro 401 ao fazer login (obrigado Rodrigo Leitão)</li>
	<li>Adotado o sistema de versões semver para atualizações futuras (obrigado Rodrigo Leitão)</li>
	<li>Corrigido bug do Jundefined (obrigado Roda)</li>
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
