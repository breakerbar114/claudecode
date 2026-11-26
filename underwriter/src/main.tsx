import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { STATIC } from "./lib/api";
import "./styles.css";

if (!STATIC) {
  // Running from our own server (not the claude.ai page): act like an installed app.
  document.documentElement.classList.add("pwa");
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
