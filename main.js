// node --watch main.js   (or: npm run dev)
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToString } from "react-dom/server";
import { respond, respondToNode, startConversation, createState } from "./teslaEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, "chat_history.json");
const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_LENGTH = 500;
const NODE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// TEMPORARY: one shared conversation state (name, rude-strike count, ended flag).
// Step 6 replaces this, and chat_history.json, with per-conversation storage.
let sessionState = createState();

const app = express();

app.use(cors());
app.use(express.json());
// Only the public/ folder is served (background.png etc.), NOT the whole project.
app.use(express.static(path.join(__dirname, "public")));

// Global styles: reset margins, border-box sizing, visible keyboard focus ring (NFR-03).
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  #user-input:focus-visible,
  #send-btn:focus-visible,
  #new-chat-btn:focus-visible,
  .chip:focus-visible {
    outline: 3px solid #ffffff;
    outline-offset: 2px;
  }
  .chip:hover { background-color: rgba(24, 168, 197, 0.6); }
`;

// sets background image
function TextBoxPage() {
  return React.createElement(
    "div",
    {
      style: {
        backgroundImage: "url('/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "left bottom",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        margin: 0,
        padding: "20px",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center"
      }
    },
    React.createElement(
      "div",
      {
        style: {
          width: "50%",
          maxWidth: "780px",
          minWidth: "240px",
          height: "66vh",
          minHeight: "420px",
          padding: "20px",
          backgroundColor: "rgba(10, 28, 58, 0.65)",
          border: "2px solid #29b6f6",
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "flex-end"
          }
        },
        React.createElement(
          "button",
          {
            id: "new-chat-btn",
            type: "button",
            style: {
              padding: "6px 14px",
              fontSize: "13px",
              fontFamily: "sans-serif",
              cursor: "pointer",
              color: "#ffffff",
              backgroundColor: "rgba(24, 168, 197, 0.35)",
              border: "1px solid #29b6f6",
              borderRadius: "14px"
            }
          },
          "New Conversation"
        )
      ),
      React.createElement("div", {
        id: "chat-history",
        role: "log",
        "aria-live": "polite",
        "aria-label": "Conversation with Nikola Tesla",
        style: {
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          paddingRight: "6px"
        }
      }),
      React.createElement(
        "form",
        {
          id: "chat-form",
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }
        },
        React.createElement("input", {
          id: "user-input",
          type: "text",
          placeholder: "Type your message...",
          "aria-label": "Message Nikola Tesla",
          autoComplete: "off",
          maxLength: MAX_MESSAGE_LENGTH,
          style: {
            flex: 1,
            minWidth: 0,
            height: "48px",
            padding: "0 18px",
            fontSize: "15px",
            color: "#ffffff",
            backgroundColor: "rgba(10, 28, 58, 0.65)",
            border: "2px solid #29b6f6",
            borderRadius: "20px"
          }
        }),
        React.createElement(
          "button",
          {
            id: "send-btn",
            type: "submit",
            "aria-label": "Send message",
            style: {
              height: "48px",
              padding: "0 16px",
              fontSize: "15px",
              cursor: "pointer",
              color: "#fafafa",
              backgroundColor: "rgba(24, 168, 197, 0.72)",
              border: "2px solid #29b6f6",
              borderRadius: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }
          },
          "➤"
        )
      )
    ),
    React.createElement("script", {
      dangerouslySetInnerHTML: {
        __html: `
          const form = document.getElementById('chat-form');
          const input = document.getElementById('user-input');
          const historyBox = document.getElementById('chat-history');
          const newChatBtn = document.getElementById('new-chat-btn');
          let chipBox = null;

          function scrollToBottom() {
            historyBox.scrollTop = historyBox.scrollHeight;
          }

          function showMessage(text, sender = 'user', source = null) {
            const msg = document.createElement('div');
            const isTesla = sender === 'tesla';

            msg.textContent = text;
            msg.style.alignSelf = isTesla ? 'flex-start' : 'flex-end';
            msg.style.maxWidth = '80%';
            msg.style.padding = '10px 14px';
            msg.style.borderRadius = '14px';
            msg.style.fontSize = '14px';
            msg.style.fontFamily = 'sans-serif';
            msg.style.lineHeight = '1.4';
            msg.style.color = '#ffffff';
            msg.style.backgroundColor = isTesla
              ? 'rgba(34, 62, 106, 0.85)'
              : 'rgba(24, 168, 197, 0.85)';
            msg.style.border = isTesla ? '1px solid #29b6f6' : 'none';
            msg.style.wordWrap = 'break-word';

            // Source reference under factual replies (FR-09). Only https links are used.
            if (source && source.url && source.url.indexOf('https://') === 0) {
              const link = document.createElement('a');
              link.href = source.url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = 'Source: ' + source.title;
              link.style.display = 'block';
              link.style.marginTop = '6px';
              link.style.fontSize = '12px';
              link.style.color = '#9fe3ff';
              msg.appendChild(link);
            }

            historyBox.appendChild(msg);
            scrollToBottom();
          }

          function clearFollowUps() {
            if (chipBox) {
              chipBox.remove();
              chipBox = null;
            }
          }

          // Suggested next topics as clickable buttons (FR-02, FR-03, FR-05)
          function showFollowUps(followUps) {
            clearFollowUps();
            if (!followUps || followUps.length === 0) return;

            chipBox = document.createElement('div');
            chipBox.style.display = 'flex';
            chipBox.style.flexWrap = 'wrap';
            chipBox.style.gap = '8px';
            chipBox.style.alignSelf = 'flex-start';

            followUps.forEach((f) => {
              const chip = document.createElement('button');
              chip.type = 'button';
              chip.className = 'chip';
              chip.textContent = f.label;
              chip.style.padding = '6px 12px';
              chip.style.fontSize = '13px';
              chip.style.fontFamily = 'sans-serif';
              chip.style.cursor = 'pointer';
              chip.style.color = '#ffffff';
              chip.style.backgroundColor = 'rgba(24, 168, 197, 0.35)';
              chip.style.border = '1px solid #29b6f6';
              chip.style.borderRadius = '14px';
              chip.addEventListener('click', () => send({ nodeId: f.id }, f.label));
              chipBox.appendChild(chip);
            });

            historyBox.appendChild(chipBox);
            scrollToBottom();
          }

          // Sends typed text ({ message }) or a clicked suggestion ({ nodeId })
          async function send(payload, displayText) {
            clearFollowUps();
            showMessage(displayText, 'user');

            try {
              const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              if (!res.ok) {
                console.error('Server error:', res.status);
                return;
              }
              const data = await res.json();
              if (data && data.reply) {
                showMessage(data.reply, 'tesla', data.source);
                showFollowUps(data.followUps);
              }
            } catch (err) {
              console.error('Fetch failed:', err);
            }
          }

          fetch('/api/history')
            .then((res) => res.json())
            .then((messages) => {
              historyBox.innerHTML = '';
              chipBox = null;
              messages.forEach((m) => showMessage(m.text, m.sender || 'user', m.source));
              const last = messages[messages.length - 1];
              if (last && last.sender === 'tesla') showFollowUps(last.followUps);
              scrollToBottom();
            });

          newChatBtn.addEventListener('click', async () => {
            try {
              const res = await fetch('/api/new-chat', { method: 'POST' });
              if (!res.ok) {
                console.error('New chat error:', res.status);
                return;
              }
              const data = await res.json();
              historyBox.innerHTML = '';
              chipBox = null;
              if (data && data.greeting) {
                showMessage(data.greeting, 'tesla');
                showFollowUps(data.followUps);
              }
            } catch (err) {
              console.error('New chat request failed:', err);
            }
          });

          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            send({ message: text }, text);
          });
        `
      }
    })
  );
}

// Wraps the React output in a full HTML document (doctype, lang, viewport, title, global CSS)
function renderPage() {
  const body = renderToString(React.createElement(TextBoxPage));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nikola Tesla - Interactive Conversation</title>
  <style>${GLOBAL_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

function loadHistorySafe() {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(HISTORY_FILE, "utf-8").trim();
  if (!raw) {
    fs.writeFileSync(HISTORY_FILE, "[]", "utf-8");
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function saveHistory(messages) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2), "utf-8");
}

// What is stored in the history file for one of Tesla's messages
function botEntryFrom(result) {
  return {
    sender: "tesla",
    text: result.reply,
    nodeId: result.nodeId,
    followUps: result.followUps,
    source: result.source
  };
}

// Starts a fresh conversation: new state, greeting saved as the only message
function beginNewConversation() {
  const start = startConversation();
  sessionState = start.state;
  const messages = [botEntryFrom(start)];
  saveHistory(messages);
  return { start, messages };
}

// gets the text box
app.get("/", (req, res) => {
  res.send(renderPage());
});

// creates the text box
app.get("/chat", (req, res) => {
  res.send(renderPage());
});

// gets the chat history (starts a conversation if the history is empty)
app.get("/api/history", (req, res) => {
  try {
    let messages = loadHistorySafe();
    if (messages.length === 0) {
      messages = beginNewConversation().messages;
    }
    res.json(messages);
  } catch (err) {
    console.error("History read error:", err);
    res.status(500).json({ error: "Could not read chat history" });
  }
});

// Accepts either { message: "typed text" } or { nodeId: "tesla-coil" } (a clicked suggestion)
app.post("/api/chat", (req, res) => {
  try {
    const { message, nodeId } = req.body ?? {};
    let result;
    let userText;

    if (nodeId !== undefined) {
      if (typeof nodeId !== "string" || !NODE_ID_PATTERN.test(nodeId)) {
        return res.status(400).json({ error: "Invalid conversation choice." });
      }
      result = respondToNode(nodeId, sessionState);
      if (!result) {
        return res.status(400).json({ error: "Unknown conversation choice." });
      }
      userText = result.choiceLabel ?? nodeId;
    } else {
      userText = typeof message === "string" ? message.trim() : "";
      if (!userText) {
        return res.status(400).json({ error: "Message is required." });
      }
      if (userText.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
      }
      result = respond(userText, sessionState);
    }

    sessionState = result.state;

    const userEntry = { sender: "user", text: userText };
    const botEntry = botEntryFrom(result);

    const history = loadHistorySafe();
    history.push(userEntry, botEntry);
    saveHistory(history);

    res.status(201).json({
      reply: result.reply,
      nodeId: result.nodeId,
      followUps: result.followUps,
      source: result.source,
      ended: result.ended,
      userEntry,
      botEntry
    });
  } catch (err) {
    console.error("Chat route error:", err);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

app.post("/api/new-chat", (req, res) => {
  try {
    const { start, messages } = beginNewConversation();
    res.status(201).json({ greeting: start.reply, followUps: start.followUps, messages });
  } catch (err) {
    console.error("New chat error:", err);
    res.status(500).json({ error: "Failed to start new conversation" });
  }
});

app.listen(PORT, () => {
  console.log(`Tesla Bot running at http://localhost:${PORT}`);
});