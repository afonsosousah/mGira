// Current version number
const currentVersion = "0.0.5";

// Changelog HTML
const changelogHTML = `
Notas da versão ${currentVersion}<br>
<ul>
	<li>Atualização dos endpoints da API (obrigado Rod e ttmx)</li>
	<li>Agradecimento especial ao Rodrigo Leitão pelo apoio no projeto</li>
    <li>Definição de distância necessária até estação (obrigado filipe-maia)</li>
	<li>Marcadores da estações enchem com percentagem real (obrigado DanielAgostinho)</li>
	<li>Novo ecrã landscape em viagem</li>
	<li>Marcadores das estações atualizam automaticamente</li>
	<li>Modo landscape</li>
	<li>Reroteamento automático</li>
	<li>Novo ícone para PWA</li>
	<li>Pequenas melhorias visuais</li>
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
