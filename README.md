# SLMs — Webchat com Eduardo Montenegro

Aplicação web de conversação local com IA, onde você conversa com **Eduardo Montenegro** — um personagem de investidor/empresário — via texto ou voz, rodando 100% na sua máquina com um modelo local.

> **Tecnologia:** Node.js + Express + @huggingface/transformers (ONNX) · Modelo padrão: `onnx-community/Qwen3-4B-ONNX`

---

## ✨ Recursos

- **Chat local** — modelo SLM executado no servidor (device: CPU), sem chamadas à nuvem
- **Streaming de respostas** — tokens exibidos em tempo real via SSE
- **Persona customizável** — comportamento e estilo definido em `persona.md`
- **Memória sobre o usuário** — contexto persistente em `memory.json`
- **Entrada por voz** — Web Speech API (`SpeechRecognition`, `pt-BR`) com botão de microfone
- **Blocos de raciocínio** — tags `<think>` renderizadas em caixas expansíveis ("Raciocinio")
- **Interface responsiva** — sidebar de perfil + chat, temas claro/escuro, sugestões de pergunta
- **Cache local de modelos** — downloads ficam em `./models` (sem baixar novamente a cada reinício)

---

## 📁 Estrutura do projeto

```
webchat/
├── webchat.mjs          # Servidor Express + pipeline de geração (backend)
├── persona.md           # System prompt da persona (Eduardo Montenegro)
├── memory.json          # Memória sobre o usuário (hábitos, opiniões, favoritos)
├── package.json
├── pnpm-lock.yaml
├── models/              # Cache dos modelos ONNX (gerado em runtime)
└── webchat/
    ├── index.html       # UI completa (CSS inline + sidebar de perfil)
    ├── app.mjs          # Frontend: chat, streaming, voz, tema
    └── assets/
        ├── eduardo-portrait.jpg
        ├── figma-background.svg
        ├── figma-logo.svg
        └── figma-send.svg
```

---

## 🚀 Como rodar

### Pré-requisitos

- **Node.js** (versão 18+ recomendada)
- **pnpm** `11.15.1` (definido em `devEngines` no `package.json`) — `onFail: download` instala automaticamente se ausente
- Espaço em disco para o modelo (~GBs na primeira execução)
- Microfone (opcional, apenas para entrada por voz)

### Instalação

```bash
pnpm install
```

### Execução

```bash
pnpm webchat
# ou
node webchat.mjs
```

Na primeira vez, o modelo `onnx-community/Qwen3-4B-ONNX` é baixado e salvo em `./models` (pode levar vários minutos). Depois acesse:

```
http://localhost:3000
```

Porta customizável:

```bash
PORT=8080 pnpm webchat
```

---

## ⚙️ Configuração

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor |
| `MODEL` | `onnx-community/Qwen3-4B-ONNX` | Modelo de linguagem (editável em `webchat.mjs`) |

### Persona (`persona.md`)

Define quem o assistente é: nome, idade, personalidade, filosofia, história, família e exemplos de respostas. Edite livremente — o conteúdo é carregado como **system prompt** a cada requisição.

### Memória (`memory.json`)

Contexto persistente sobre o usuário, injetado no system prompt:

```json
{
  "habits": [
    "usa cartões premium",
    "prefere investimentos de longo prazo"
  ],
  "opinions": [
    "não gosta de decisões impulsivas"
  ],
  "favorites": {
    "carro": "Porsche 911",
    "bebida": "café sem açúcar",
    "destino": "Toscana",
    "livro": "Sapiens"
  }
}
```

> ⚠️ O modelo é instruído a *usar essas informações apenas quando relevantes* e a não mencionar que leu arquivos.

---

## 🔌 API

### `POST /api/chat`

**Body:** `{ "text": "Sua mensagem" }`

**Resposta:** `text/event-stream` (Server-Sent Events) com tokens em streaming:

```
data: {"token":"Olá!"}
data: {"token":" Como posso"}
...
data: {"done":true}
```

Erros são enviados como `data: {"error": "..."}`. Parâmetros de geração atuais: `max_new_tokens: 1024`, `do_sample: false` (editáveis em `webchat.mjs`).

### Arquivos estáticos

A pasta `webchat/` é servida em `/` (com fallback para `index.html`).

---

## 🖥️ Frontend

- **Web Speech API** — `window.SpeechRecognition` / `webkitSpeechRecognition`, idioma `pt-BR`. Se indisponível, o botão de microfone é desabilitado com aviso.
- **Tema claro/escuro** — alternância persistida em `localStorage` (`webchat-theme`).
- **Sugestões de pergunta** — 3 prompts pré-definidos (ex.: "Como você ficou rico?").
- **Botão "limpar conversa"** e input com `Enter` para enviar.

---

## 🔧 Tecnologias

| Pacote | Versão | Uso |
|--------|--------|-----|
| `express` | `^5.2.1` | Servidor HTTP e arquivos estáticos |
| `@huggingface/transformers` | `^4.2.0` | Pipeline `text-generation`, `TextStreamer` (ONNX Runtime) |
| `@huggingface/inference` | `^4.13.23` | Cliente de inference (Hugging Face) |
| `typescript` | `^7.0.2` | Dev dependency |

---

## 📝 Licença

Uso pessoal/educacional. Verifique a licença do modelo `onnx-community/Qwen3-4B-ONNX` antes de uso comercial.
