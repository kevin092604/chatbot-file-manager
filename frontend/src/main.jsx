import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Amplify } from "aws-amplify";
import { amplifyConfig } from "./auth/amplifyConfig";
import "./index.css";
import App from "./App.jsx";

if (import.meta.env.VITE_AUTH_MOCK !== "true") {
  Amplify.configure(amplifyConfig);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
