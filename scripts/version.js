// Current version number
const currentVersion = "0.2.0";

// Changelog HTML
const changelogHTML = `
Notas da versão ${currentVersion}<br>
<ul>
	<li>Adicionado um timer de 5 minutos na lista de bicicletas até poder ser iniciada uma nova viagem</li>
	<li>Corrigido um bug que não enviava os comentários de avaliação de uma viagem à EMEL</li>
	<li>Melhorada a aparência do menu de desbloqueio de bicicleta no modo landscape</li>
	<li>Corrigido um bug que fazia o timer de desbloqueio de uma bicicleta animar no sentido contrário em Safari</li>
	<li>Corrigidos alguns erros relacionados com autenticação</li>
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
