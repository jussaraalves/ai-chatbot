import express from "express";
import { pipeline, TextStreamer } from "@huggingface/transformers";
import { env } from "@huggingface/transformers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = "onnx-community/Qwen3-4B-ONNX";

env.allowLocalModels = true;
env.cacheDir = "./models";

const persona = fs.readFileSync(path.join(__dirname, "persona.md"), "utf-8");
const memory = fs.readFileSync(path.join(__dirname, "memory.json"),"utf-8");

const app = express();
app.use(express.json());

console.log(`Loading model ${MODEL}...`);
const generator = await pipeline("text-generation", MODEL, {
  device: "cpu",
  dtype: "auto",
  progress_callback: (p) => {
    if (p.status === "progress_total") {
      console.log(`Downloading... ${Math.round(p.progress)}%`);
    }
  },
});

console.log("Model loaded. Webchat ready.");

app.post("/api/chat", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const messages = [
  {
    role: "system",
    content: `
${persona}

## Memória sobre o usuário

${memory}

Use essas informações apenas quando forem relevantes.
Não diga que possui memória ou que leu arquivos.
`
  },
  {
    role: "user",
    content: text
  }
];

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
  });

  try {
    await generator(messages, {
      max_new_tokens: 1024,
      do_sample: false,
      streamer,
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    console.error("Generation error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.use(express.static(path.join(__dirname, "webchat")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "webchat", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Webchat at http://localhost:${PORT}`);
  console.log(`Talk to Eduardo Montenegro via microphone or keyboard.`);
});
