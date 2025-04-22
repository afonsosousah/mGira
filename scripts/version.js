// Current version number
const currentVersion = "0.1.1";

// Changelog HTML
const changelogHTML = `
Notas da versão ${currentVersion}<br>
<ul>
	<li>Pequenas correções gerais</li>
	<li>Ciclovias atualizadas</li>
	<li>Atualização dos endpoints</li>
	<li>Adicionado um modo de programador nas definições</li>
	<li>Pedido de orientação em iOS movido para ser menos intrusivo</li>
	<li>Problemas de zoom ao iniciar a app corrigidos</li>
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
