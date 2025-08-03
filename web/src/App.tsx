import "./App.css";
import { useCreateAirdrop } from "./hooks/useCreateAirdrop";
import { useClaimAirdrop } from "./hooks/useClaimAirdrop";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { MerkleRootInput } from "./components/MerkleRootInput";

function App() {
  const createAirdrop = useCreateAirdrop();
  const claimAirdrop = useClaimAirdrop();

  const [merkleRootInput, setMerkleRootInput] = useState("");
  const [merkleRoot, setMerkleRoot] = useState([
    53, 9, 147, 191, 167, 219, 140, 104, 245, 10, 37, 110, 101, 7, 193, 153, 60,
    13, 140, 44, 99, 201, 137, 46, 16, 237, 225, 14, 83, 49, 64, 158,
  ]);
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
          >
            Create Airdrop
          </button>
        </div>

        <div className="section">
          <h2>Claim Airdrop</h2>
          <button
            className="action-button"
            onClick={() => claimAirdrop(merkleRoot)}
          >
            Claim Airdrop
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
