const $ = (sel) => document.querySelector(sel);

const chatEl = $("#chat");
let placeholder = $("#placeholder");
const appEl = $(".container");
const statusEl = $("#status");
const recordBtn = $("#recordBtn");
const clearBtn = $("#clearBtn");
const textInput = $("#textInput");
const sendBtn = $("#sendBtn");
const themeToggle = $("#themeToggle");
const themeColorMeta = $('meta[name="theme-color"]');

function updateTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
  themeToggle.title = isDark ? "Ativar modo claro" : "Ativar modo escuro";
  themeColorMeta.content = isDark ? "#18181B" : "#f3f7fc";
}

updateTheme(localStorage.getItem("webchat-theme") === "dark" ? "dark" : "light");

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  updateTheme(nextTheme);
  localStorage.setItem("webchat-theme", nextTheme);
});

let isListening = false;
let speechRecognition = null;

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = "status" + (type ? " " + type : "");
}

function addMessage(text, role) {
  if (placeholder) {
    placeholder.remove();
    placeholder = null;
    appEl.classList.add("has-messages");
  }
  const div = document.createElement("div");
  div.className = "message " + role;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function renderAssistantMessage(container, fullText, cursor) {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let lastIndex = 0;
  let match;

  container.innerHTML = "";

  while ((match = thinkRegex.exec(fullText)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(
        document.createTextNode(fullText.slice(lastIndex, match.index))
      );
    }
    const details = document.createElement("details");
    details.className = "think-box";
    details.open = false;
    const summary = document.createElement("summary");
    summary.textContent = "Raciocinio";
    details.appendChild(summary);
    const div = document.createElement("div");
    div.className = "think-content";
    div.textContent = match[1];
    details.appendChild(div);
    container.appendChild(details);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < fullText.length) {
    container.appendChild(
      document.createTextNode(fullText.slice(lastIndex))
    );
  }

  if (cursor) container.appendChild(cursor);
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Reconhecimento de voz nao disponivel neste navegador. Use o teclado.", "error");
    recordBtn.disabled = true;
    return null;
  }
  const sr = new SpeechRecognition();
  sr.lang = "pt-BR";
  sr.continuous = false;
  sr.interimResults = false;
  sr.maxAlternatives = 1;

  sr.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    setStatus("Processando...", "processing");
    addMessage(transcript, "user");
    sendToModel(transcript);
  };

  sr.onerror = (event) => {
    isListening = false;
    recordBtn.setAttribute("aria-label", "Falar");
    recordBtn.title = "Falar";
    recordBtn.classList.remove("listening");
    if (event.error === "no-speech") {
      setStatus("Nenhum fala detectada. Tente novamente.");
    } else if (event.error === "aborted") {
      setStatus("Gravacao interrompida.");
    } else {
      setStatus("Erro: " + event.error, "error");
    }
  };

  sr.onend = () => {
    isListening = false;
    recordBtn.setAttribute("aria-label", "Falar");
    recordBtn.title = "Falar";
    recordBtn.classList.remove("listening");
  };

  return sr;
}

function startListening() {
  if (!speechRecognition) {
    speechRecognition = initSpeechRecognition();
    if (!speechRecognition) return;
  }
  try {
    speechRecognition.start();
    isListening = true;
    recordBtn.setAttribute("aria-label", "Parar gravação");
    recordBtn.title = "Parar gravação";
    recordBtn.classList.add("listening");
    setStatus("Escutando...", "listening");
  } catch (err) {
    setStatus("Erro ao iniciar gravacao", "error");
  }
}

function stopListening() {
  if (speechRecognition) {
    speechRecognition.stop();
  }
  isListening = false;
  recordBtn.setAttribute("aria-label", "Falar");
  recordBtn.title = "Falar";
  recordBtn.classList.remove("listening");
}

recordBtn.addEventListener("click", () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

clearBtn.addEventListener("click", () => {
  chatEl.replaceChildren();
  placeholder = document.createElement("div");
  placeholder.className = "placeholder";
  placeholder.id = "placeholder";
  placeholder.textContent = "Nenhuma mensagem ainda.";
  chatEl.appendChild(placeholder);
  appEl.classList.remove("has-messages");
  setStatus("Pronto. Pressione o microfone para falar.");
});

async function sendToModel(text) {
  const msgEl = addMessage("", "assistant");
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  msgEl.appendChild(cursor);

  setStatus("Gerando resposta...", "processing");
  recordBtn.disabled = true;
  sendBtn.disabled = true;
  textInput.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Erro " + response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              renderAssistantMessage(msgEl, fullText, cursor);
              chatEl.scrollTop = chatEl.scrollHeight;
            }
            if (data.done) {
              cursor.remove();
            }
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") {
              throw e;
            }
          }
        }
      }
    }
    cursor.remove();
    setStatus("Pronto. Pressione o microfone para falar.");
  } catch (err) {
    cursor.remove();
    msgEl.textContent = "[Erro: " + err.message + "]";
    setStatus("Erro ao gerar resposta", "error");
  } finally {
    recordBtn.disabled = false;
    sendBtn.disabled = false;
    textInput.disabled = false;
    textInput.focus();
  }
}

sendBtn.addEventListener("click", () => {
  const text = textInput.value.trim();
  if (!text) return;
  addMessage(text, "user");
  textInput.value = "";
  sendToModel(text);
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

document.querySelectorAll(".suggestion").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    textInput.value = suggestion.dataset.prompt;
    sendBtn.click();
  });
});

navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => console.log("microfone ok"))
    .catch(err => console.log(err));