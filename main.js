import express from "express";
import cors from "cors";
import React from "react";
import { renderToString } from "react-dom/server";

const app = express();

app.use(cors());

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
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
        margin: 0,
        padding: "36px 48px",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center"
      }
    },
    React.createElement(
      "form",
      {

         style: {
          width: "58%",
          maxWidth: "780px",
          minWidth: "360px",
          height: "66vh",
          minHeight: "420px",
          padding: "20px",
          backgroundColor: "rgba(10, 28, 58, 0.65)",
          border: "2px solid #29b6f6",
          borderRadius: "20px",
          display: "flex",
          alignItems: "flex-end",
          gap: "12px"
        }
        
      },
      React.createElement("input", {
        type: "text",
        placeholder: "Type your message...",
        style: {
          flex: 1,
          height: "48px",
          padding: "0 18px",
          fontSize: "15px"
        }
      }),
      React.createElement(
        "button",
        {
          type: "submit",
          style: {
            height: "48px",
            padding: "0 20px",
            fontSize: "15px",
            cursor: "pointer"
          }
        },
        "Send"
      )
    )
  );
}


//gets the text box
app.get("/", (req, res) => {
  res.send(renderToString(React.createElement(TextBoxPage)));
});


//creates the text box
app.get("/chat", (req, res) => {
  res.send(renderToString(React.createElement(TextBoxPage)));
});



app.listen(3000, () => {
  console.log("Tesla Bot running at http://localhost:3000");
});
