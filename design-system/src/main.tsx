import React from "react";
import { createRoot } from "react-dom/client";
import "./ds/styles.css";
import "./showcase/showcase.css";
import { App } from "./showcase/App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
