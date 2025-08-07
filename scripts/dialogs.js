// Custom styled alert with OK option
function createCustomAlert(message, title = null) {
	if (document.getElementById("modalContainer")) return;

	const mObj = document.createElement("div");
	mObj.id = "modalContainer";

	const alertObj = mObj.appendChild(document.createElement("div"));
	alertObj.id = "alertBox";

	const titleObj = alertObj.appendChild(document.createElement("span"));
	titleObj.id = "title";
	titleObj.innerText = title ?? "";

	const msg = alertObj.appendChild(document.createElement("p"));
	msg.innerText = message;

	const btn = alertObj.appendChild(document.createElement("div"));
	btn.id = "closeBtn";
	btn.appendChild(document.createTextNode("OK"));
	//btn.focus();
	btn.addEventListener("click", () => document.getElementById("modalContainer").remove());

	document.body.appendChild(mObj);

	if (document.getElementById("userSettings")) {
		mObj.style.height = document.getElementById("userSettings").clientHeight + "px";
		mObj.style.alignItems = "flex-start";
		alertObj.style.marginTop = (document.body.clientHeight - alertObj.clientHeight) / 2 + "px";
	}
}

function createCustomYesNoPrompt(message, yesHandler, noHandler, yesText = "Sim", noText = "Não") {
	if (document.getElementById("modalContainer")) return;

	const mObj = document.createElement("div");
	mObj.id = "modalContainer";

	const alertObj = mObj.appendChild(document.createElement("div"));
	alertObj.id = "alertBox";

	const msg = alertObj.appendChild(document.createElement("p"));
	msg.innerText = message;

	const yesBtn = alertObj.appendChild(document.createElement("div"));
	yesBtn.id = "yesBtn";
	yesBtn.appendChild(document.createTextNode(yesText));
	yesBtn.addEventListener("click", async () => {
		await yesHandler();
		document.getElementById("modalContainer").remove();
	});

	const noBtn = alertObj.appendChild(document.createElement("div"));
	noBtn.id = "noBtn";
	noBtn.appendChild(document.createTextNode(noText));
	noBtn.addEventListener("click", async () => {
		await noHandler();
		document.getElementById("modalContainer").remove();
	});

	document.body.appendChild(mObj);
}

function createCustomTextPrompt(message, yesHandler, noHandler, yesText = "Enviar", noText = "Ignorar") {
	if (document.getElementById("modalContainer")) return;

	const mObj = document.createElement("div");
	mObj.id = "modalContainer";

	const alertObj = mObj.appendChild(document.createElement("div"));
	alertObj.id = "alertBox";

	const input = alertObj.appendChild(document.createElement("textarea"));
	input.id = "customTextPromptInput";
	input.placeholder = message;
	input.spellcheck = false;

	const yesBtn = alertObj.appendChild(document.createElement("div"));
	yesBtn.id = "yesBtn";
	yesBtn.appendChild(document.createTextNode(yesText));
	yesBtn.addEventListener("click", () => {
		yesHandler();
		document.getElementById("modalContainer").remove();
	});

	const noBtn = alertObj.appendChild(document.createElement("div"));
	noBtn.id = "noBtn";
	noBtn.appendChild(document.createTextNode(noText));
	noBtn.addEventListener("click", () => {
		noHandler();
		document.getElementById("modalContainer").remove();
	});

	document.body.appendChild(mObj);
}
