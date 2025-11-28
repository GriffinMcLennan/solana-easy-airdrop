import "./App.css";
import {
  useCreateAirdrop,
  useClaimAirdrop,
} from "@solana-easy-airdrop/react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { MerkleRootInput } from "./components/MerkleRootInput";

const AIRDROP_SERVER_URL =
  import.meta.env.VITE_AIRDROP_SERVER_URL || "http://localhost:5000";

function App() {
  const createAirdrop = useCreateAirdrop();
  const claimAirdrop = useClaimAirdrop({ serverUrl: AIRDROP_SERVER_URL });

  const [merkleRootInput, setMerkleRootInput] = useState("");
  const [merkleRoot, setMerkleRoot] = useState<number[]>([]);
  const [airdropAmount, setAirdropAmount] = useState("");

  return (
    <div className="app-container">
      <div className="header">
        <h1>Solana Easy Airdrop</h1>
        <WalletMultiButton />
      </div>

      <div className="content">
        <div className="section">
          <h2>Create Airdrop</h2>
          <div className="input-group">
            <label htmlFor="airdrop-amount">Airdrop Amount:</label>
            <input
              id="airdrop-amount"
              type="text"
              value={airdropAmount}
              onChange={(e) => setAirdropAmount(e.target.value)}
              placeholder="Enter token amount"
            />
          </div>
          <MerkleRootInput
            merkleRootInput={merkleRootInput}
            merkleRoot={merkleRoot}
            setMerkleRootInput={setMerkleRootInput}
            setMerkleRoot={setMerkleRoot}
          />
          <button
            className="action-button"
            onClick={() => createAirdrop(merkleRoot, Number(airdropAmount))}
            disabled={merkleRoot.length !== 32}
          >
            Create Airdrop
          </button>
        </div>

        <div className="section">
          <h2>Claim Airdrop</h2>
          <button
            className="action-button"
            onClick={() => claimAirdrop(merkleRoot)}
            disabled={merkleRoot.length !== 32}
          >
            Claim Airdrop
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
