import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { SolanaProvider } from "./providers/solanaProvider.tsx";
import { AirdropProgramProvider } from "./providers/AirdropProgramProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SolanaProvider>
      <AirdropProgramProvider>
        <App />
      </AirdropProgramProvider>
    </SolanaProvider>
  </StrictMode>
);
