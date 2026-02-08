import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupExpiredStorage } from "./lib/storage-utils";

// Clean up any expired pending analysis data on app startup
cleanupExpiredStorage();

createRoot(document.getElementById("root")!).render(<App />);
