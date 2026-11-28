// node --watch main.js
import express from "express";
import cors from "cors";
import fs from "fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { getTeslaReply, getTeslaGreeting } from "./teslaEngine.js";

const app = express();

app.use(cors());
app.use(express.json());
// Serve files in the repo folder so /background.png loads in the browser
app.use(express.static("."));

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
          autoComplete: "off",
          style: {
            flex: 1,
            minWidth: 0,
            height: "48px",
            padding: "0 18px",
            fontSize: "15px",
            color: "#ffffff",
            backgroundColor: "rgba(10, 28, 58, 0.65)",
            border: "2px solid #29b6f6",
            borderRadius: "20px",
            outline: "none"
          }
        }),
        React.createElement(
          "button",
          {
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

          function scrollToBottom() {
            historyBox.scrollTop = historyBox.scrollHeight;
          }

          function showMessage(text, sender = 'user') {
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

            historyBox.appendChild(msg);
            scrollToBottom();
          }

          fetch('/api/history')
            .then((res) => res.json())
            .then((messages) => {
              historyBox.innerHTML = '';
              messages.forEach((m) => showMessage(m.text, m.sender || 'user'));
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
              if (data && data.greeting) {
                showMessage(data.greeting, 'tesla');
              }
            } catch (err) {
              console.error('New chat request failed:', err);
            }
          });

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            showMessage(text, 'user');
            input.value = '';

            try {
              const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
              });
              if (!res.ok) {
                console.error('Server error:', res.status);
                return;
              }
              const data = await res.json();
              if (data && data.reply) {
                showMessage(data.reply, 'tesla');
              }
            } catch (err) {
              console.error('Fetch failed:', err);
            }
          });
        `
      }
    })
  );
}

function loadHistorySafe() {
  if (!fs.existsSync("./chat_history.json")) {
    fs.writeFileSync("./chat_history.json", "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync("./chat_history.json", "utf-8").trim();
  if (!raw) {
    fs.writeFileSync("./chat_history.json", "[]", "utf-8");
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

// gets the text box
app.get("/", (req, res) => {
  res.send(renderToString(React.createElement(TextBoxPage)));
});

// creates the text box
app.get("/chat", (req, res) => {
  res.send(renderToString(React.createElement(TextBoxPage)));
});

// gets the chat history
app.get("/api/history", (req, res) => {
  try {
    const messages = loadHistorySafe();
    res.json(messages);
  } catch (err) {
    console.error("History read error:", err);
    res.status(500).json({ error: "Could not read chat history" });
  }
});

app.post("/api/history", (req, res) => {
  try {
    const messages = loadHistorySafe();
    messages.push({ text: req.body.text });
    fs.writeFileSync("./chat_history.json", JSON.stringify(messages, null, 2));
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("History write error:", err);
    res.status(500).json({ error: "Could not save chat history" });
  }
});

app.post("/api/chat", (req, res) => {
  try {
    const userMessage = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!userMessage) {
      return res.status(400).json({ error: "Message is required." });
    }

    const replyText = getTeslaReply(userMessage);
    const history = loadHistorySafe();

    const userEntry = { sender: "user", text: userMessage };
    const botEntry = { sender: "tesla", text: replyText };

    history.push(userEntry, botEntry);
    fs.writeFileSync("./chat_history.json", JSON.stringify(history, null, 2));

    res.status(201).json({ reply: replyText, userEntry, botEntry });
  } catch (err) {
    console.error("Chat route error:", err);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

app.post("/api/new-chat", (req, res) => {
  try {
    const greetingText = getTeslaGreeting();
    const initialHistory = [{ sender: "tesla", text: greetingText }];
    fs.writeFileSync("./chat_history.json", JSON.stringify(initialHistory, null, 2));
    res.status(201).json({ greeting: greetingText, messages: initialHistory });
  } catch (err) {
    console.error("New chat error:", err);
    res.status(500).json({ error: "Failed to start new conversation" });
  }
});

app.listen(3000, () => {
  console.log("Tesla Bot running at http://localhost:3000");
});
