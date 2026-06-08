import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import { OpenRouter } from "@openrouter/sdk";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

const PREFERRED_MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free", 
  "openai/gpt-oss-120b", 
  "google/gemma-4-31b"
];

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const openrouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY 
});

/**
 * Validates and constructs the chat request payload object for OpenRouter SDK
 */
function validateAndGetChatPayload(modelId: string | undefined | null, messages: any[] | undefined | null) {
  // 4. Catch undefined/null values early
  if (!modelId) {
    throw new Error("Validation Error: modelId is undefined or null.");
  }
  if (!messages) {
    throw new Error("Validation Error: messages array is undefined or null.");
  }

  // 1. Initialize and validate that chatRequest is properly initialized as an object before sending
  const chatRequest: any = {
    model: modelId,
    messages: messages
  };

  if (!chatRequest || typeof chatRequest !== 'object') {
    throw new Error("Validation Error: chatRequest must be a properly initialized object.");
  }

  // 2. Ensure all required fields are present
  if (!chatRequest.model || typeof chatRequest.model !== "string") {
    throw new Error("Validation Error: chatRequest is missing required field: model (string).");
  }
  if (!chatRequest.messages) {
    throw new Error("Validation Error: chatRequest is missing required field: messages.");
  }

  // 5. Validate the messages array exists and has at least one message
  if (!Array.isArray(chatRequest.messages)) {
    throw new Error("Validation Error: chatRequest.messages must be an array.");
  }
  if (chatRequest.messages.length === 0) {
    throw new Error("Validation Error: chatRequest.messages must contain at least one message.");
  }

  // Validate individual message structures
  for (let i = 0; i < chatRequest.messages.length; i++) {
    const msg = chatRequest.messages[i];
    if (!msg || typeof msg !== 'object') {
      throw new Error(`Validation Error: Message at index ${i} is not a valid object.`);
    }
    if (!msg.role || !msg.content || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      throw new Error(`Validation Error: Message at index ${i} must have 'role' and 'content' as string values.`);
    }
  }

  // 6. Check that the API key/token is being passed correctly
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === "") {
    throw new Error("Validation Error: OPENROUTER_API_KEY is not configured or empty.");
  }

  // 7. Ensure the request payload is valid JSON before sending
  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(chatRequest);
    if (!serializedPayload || serializedPayload === "{}") {
      throw new Error("JSON serialization returned an empty or invalid payload.");
    }
  } catch (jsonError: any) {
    throw new Error(`Validation Error: chatRequest cannot be formatted to valid JSON. Reason: ${jsonError.message}`);
  }

  // 1. Check if the final payload successfully parses back - a sanity check for validity
  try {
    JSON.parse(serializedPayload);
  } catch {
    throw new Error("Validation Error: Formatted payload is not valid JSON.");
  }

  // 3. Add logging to show what the chatRequest object contains before it's sent
  console.log("------------------ OPENROUTER CHAT REQUEST PAYLOAD ------------------");
  console.log("Model ID:", modelId);
  console.log("Payload:", JSON.stringify(chatRequest, null, 2));
  console.log("--------------------------------------------------------------------");

  return { chatRequest };
}

async function requestAIAssistance(prompt: string, systemInstruction = "You are a helpful assistant. If you produce any tables in your markdown output, always limit them to a maximum of 3 data rows. Do not include any meta-commentary, notes, or descriptions about the length or limitations of the content (e.g., do not say 'The table respects the three-row limit' or 'limited to 3 rows').") {
  const messagePayload = [
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt }
  ];

  for (const modelId of PREFERRED_MODELS) {
    try {
      console.log(`Attempting request with model: ${modelId}`);
      
      const payload = validateAndGetChatPayload(modelId, messagePayload);
      const response = await openrouter.chat.send(payload);

      // Verify the response from SDK is valid
      if (!response) {
        throw new Error("Received empty response from OpenRouter SDK.");
      }
      if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
        throw new Error("Invalid response format: 'choices' array is empty or missing.");
      }
      if (!response.choices[0].message || typeof response.choices[0].message.content !== 'string') {
        throw new Error("Invalid response format: 'choices[0].message.content' is missing or not a string.");
      }

      return { summary: response.choices[0].message.content, modelUsed: modelId };

    } catch (error: any) {
      console.warn(`Model ${modelId} failed. Moving to next... | Reason: ${error.message}`);
      continue; 
    }
  }

  try {
    console.warn("All preferred models failed. Triggering ultimate fallback: openrouter/free");
    
    const payload = validateAndGetChatPayload("openrouter/free", messagePayload);
    const fallbackResponse = await openrouter.chat.send(payload);

    if (!fallbackResponse) {
      throw new Error("Received empty response from OpenRouter SDK on fallback.");
    }
    if (!fallbackResponse.choices || !Array.isArray(fallbackResponse.choices) || fallbackResponse.choices.length === 0) {
      throw new Error("Invalid fallback response format: 'choices' array is empty or missing.");
    }
    if (!fallbackResponse.choices[0].message || typeof fallbackResponse.choices[0].message.content !== 'string') {
      throw new Error("Invalid fallback response format: 'choices[0].message.content' is missing or not a string.");
    }

    return { summary: fallbackResponse.choices[0].message.content, modelUsed: "openrouter/free" };

  } catch (finalError: any) {
    console.error("Critical AI Engine Failure:", finalError);
    throw new Error(`The AI services are currently unreachable. Please check your connection or try again later. Details: ${finalError.message}`);
  }
}

// Cascading Fallback AI Handler
app.post("/api/ai/summarize", async (req: any, res: any) => {
  const { text, mode } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server." });
  }

  const prompt = mode === 'brief'
    ? `Provide a brief summary of approximately 150-200 words for the following text, highlighting only the most central theme and most critical takeaway. IMPORTANT: If you generate any Markdown table, the table must contain a maximum of 3 data rows. Do not add any explanatory text, notes, or meta remarks about the limits, layout, or counts of rows.\n\n${text.substring(0, 50000)}`
    : `Summarize the following text comprehensively, extracting key concepts, methodology, and structural highlights. IMPORTANT: If you generate any Markdown table, the table must contain a maximum of 3 data rows. Do not add any explanatory text, notes, or meta remarks about the limits, layout, or counts of rows.\n\n${text.substring(0, 50000)}`;

  try {
    const result = await requestAIAssistance(prompt);
    return res.json(result);
  } catch (err: any) {
    return res.status(503).json({ error: err.message });
  }
});

async function requestAIChat(messages: any[]) {
  // Ensure the system prompt enforces the 1000 word limit and 3-row limit
  const systemFound = messages.some(m => m.role === 'system');
  if (!systemFound) {
    messages.unshift({ 
      role: 'system', 
      content: 'You are a helpful and intelligent assistant. Limit your responses to 1000 words maximum. If you produce any tables in your markdown output, always limit them to a maximum of 3 data rows.' 
    });
  }

  // Vision generally works better on some specific openrouter models or gemini models depending on what's configured,
  // but OpenRouter /free auto router will try to route.
  // We add 'google/gemini-1.5-flash' to models just in case vision is used because it supports multi-modal.
  const CHAT_MODELS = [
    "openai/gpt-4o-mini",
    "nousresearch/hermes-3-llama-3.1-405b:free"
  ];

  for (const modelId of CHAT_MODELS) {
    try {
      console.log(`Attempting chat request with model: ${modelId}`);
      
      const payload = validateAndGetChatPayload(modelId, messages);
      const response = await openrouter.chat.send(payload);

      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error("Invalid response format.");
      }
      return { message: response.choices[0].message.content, modelUsed: modelId };
    } catch (error: any) {
      console.warn(`Model ${modelId} failed. Reason: ${error.message}`);
      continue; 
    }
  }

  try {
    const payload = validateAndGetChatPayload("openrouter/free", messages);
    const fallbackResponse = await openrouter.chat.send(payload);

    if (!fallbackResponse || !fallbackResponse.choices || fallbackResponse.choices.length === 0) {
      throw new Error("Invalid fallback response format.");
    }
    return { message: fallbackResponse.choices[0].message.content, modelUsed: "openrouter/free" };
  } catch (finalError: any) {
    throw new Error(`The AI services are not able to process this file format or request. Details: ${finalError.message}`);
  }
}

// Chat Generator Handler
app.post("/api/ai/chat", async (req: any, res: any) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server." });
  }

  try {
    const result = await requestAIChat(messages);
    return res.json(result);
  } catch (err: any) {
    return res.status(503).json({ error: "This file is not supported!" });
  }
});
app.post("/api/ai/flashcards", async (req: any, res: any) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server." });
  }

  const prompt = `Generate an array of exactly 8 highly educational study flashcards based on the following text. Each flashcard should target an important concept, term, or section. Use markdown inside the question and answer fields for formatting, like bolding key vocabulary or creating bullet points where appropriate. IMPORTANT: If any table is generated in any of the answers or questions, the table must contain a maximum of 3 data rows.
Return ONLY a raw, serialized JSON array containing objects with keys "question" and "answer". Do NOT include any markdown block formatting (do NOT include \`\`\`json or \`\`\`), do NOT put any intro or outro text. 

Here is the document text:
${text.substring(0, 30000)}`;

  try {
    const result = await requestAIAssistance(prompt, "You are an expert tutor that always responds strictly with raw JSON payloads. If any tables are generated, limit them to a maximum of 3 data rows.");
    
    // Attempt to extract JSON array if the model wrapped it anyway
    let rawText = result.summary.trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```/, "").replace(/```$/, "").trim();
    }
    
    // Verify it is parsable JSON
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) {
      throw new Error("Model response did not parse into a valid JSON array.");
    }

    return res.json({ flashcards: parsed, modelUsed: result.modelUsed });
  } catch (err: any) {
    console.error("Flashcards API Error:", err);
    return res.status(503).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
