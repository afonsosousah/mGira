

// Current version number
const currentVersion = "0.0.3";

// Changelog HTML
const changelogHTML = `
Nova versão 0.0.3!<br>
<ul>
    <li>Mudança da UI</li>
    <li>Suporte para botão voltar atrás nativo (obrigado DanielAgostinho)</li>
    <li>Pedidos e error handling melhorados (obrigado rodrigoleitao)</li>
    <li>Proxy já não é utilizado no login na API da EMEL (obrigado j0dd)</li>
    <li>Melhorias no sistema de navegação (já não utiliza a bússola do dispositivo)</li>
</ul>
`;


function showUpdateInfoIfNeeded() {
    setTimeout(() => {
        // Set the cookie expiry to 1 year after today.
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Check version to show update notes
        const userVersion = getCookie("version");
        if (userVersion) {
            if (userVersion !== "0.0.3") {
                alert(changelogHTML);
                document.cookie = "version=" + currentVersion + "; expires=" + expiryDate.toGMTString();
            }
        } else {
            alert(changelogHTML);
            document.cookie = "version=" + currentVersion + "; expires=" + expiryDate.toGMTString();
        }
    }, 1500);
}