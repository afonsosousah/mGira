// Custom styled alert with OK option
function createCustomAlert(message) {
	if (document.getElementById("modalContainer")) return;

	mObj = document.createElement("div");
	mObj.id = "modalContainer";

	alertObj = mObj.appendChild(document.createElement("div"));
	alertObj.id = "alertBox";

	msg = alertObj.appendChild(document.createElement("p"));
	msg.innerHTML = message;

	btn = alertObj.appendChild(document.createElement("div"));
	btn.id = "closeBtn";
	btn.appendChild(document.createTextNode("OK"));
	//btn.focus();
	btn.addEventListener("click", () => {
		document.getElementById("modalContainer").remove();
	});

	document.body.appendChild(mObj);

	if (document.getElementById("userSettings"))
		mObj.style.height = document.getElementById("userSettings").clientHeight + "px";
}

function createCustomYesNoPrompt(message, yesHandler, noHandler, yesText = "Sim", noText = "Não") {
	if (document.getElementById("modalContainer")) return;

	mObj = document.createElement("div");
	mObj.id = "modalContainer";

	alertObj = mObj.appendChild(document.createElement("div"));
	alertObj.id = "alertBox";

	msg = alertObj.appendChild(document.createElement("p"));
	msg.innerHTML = message;

	btn = alertObj.appendChild(document.createElement("div"));
	btn.id = "yesBtn";
	btn.appendChild(document.createTextNode(yesText));
	btn.addEventListener("click", () => {
		yesHandler();
		document.getElementById("modalContainer").remove();
	});

	btn = alertObj.appendChild(document.createElement("div"));
	btn.id = "noBtn";
	btn.appendChild(document.createTextNode(noText));
	btn.addEventListener("click", () => {
		noHandler();
		document.getElementById("modalContainer").remove();
	});

	document.body.appendChild(mObj);
}

function createCustomTextPrompt(message, yesHandler, noHandler, yesText = "Enviar", noText = "Ignorar") {
	if (document.getElementById("modalContainer")) return;

	mObj = document.createElement("div");
	mObj.id = "modalContainer";

	alertObj = mObj.appendChild(document.createElement("div"));
	alertObj.id = "alertBox";

	input = alertObj.appendChild(document.createElement("input"));
	input.id = "customTextPromptInput";
	input.placeholder = message;

	btn = alertObj.appendChild(document.createElement("div"));
	btn.id = "yesBtn";
	btn.appendChild(document.createTextNode(yesText));
	btn.addEventListener("click", () => {
		yesHandler();
		document.getElementById("modalContainer").remove();
	});

	btn = alertObj.appendChild(document.createElement("div"));
	btn.id = "noBtn";
	btn.appendChild(document.createTextNode(noText));
	btn.addEventListener("click", () => {
		noHandler();
		document.getElementById("modalContainer").remove();
	});

	document.body.appendChild(mObj);
}
