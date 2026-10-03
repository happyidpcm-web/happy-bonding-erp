import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

localStorage.removeItem("hb_brevo_api_key");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
