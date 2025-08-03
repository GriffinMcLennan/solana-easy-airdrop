import "./App.css";
import { useCreateAirdrop } from "./hooks/useCreateAirdrop";
import { useClaimAirdrop } from "./hooks/useClaimAirdrop";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { MerkleRootInput } from "./components/MerkleRootInput";

const AIRDROP_AMOUNT = 20_000;

function App() {
  const createAirdrop = useCreateAirdrop();
  const claimAirdrop = useClaimAirdrop();

  const [merkleRootInput, setMerkleRootInput] = useState("");
  const [merkleRoot, setMerkleRoot] = useState([
    53, 9, 147, 191, 167, 219, 140, 104, 245, 10, 37, 110, 101, 7, 193, 153, 60,
    13, 140, 44, 99, 201, 137, 46, 16, 237, 225, 14, 83, 49, 64, 158,
  ]);

  return (
    <div>
      <WalletMultiButton />
      <p>Airdrop url</p>
      <MerkleRootInput
        merkleRootInput={merkleRootInput}
        merkleRoot={merkleRoot}
        setMerkleRootInput={setMerkleRootInput}
        setMerkleRoot={setMerkleRoot}
      />
      <button onClick={() => createAirdrop(merkleRoot, AIRDROP_AMOUNT)}>
        create airdrop
      </button>
      <button onClick={() => claimAirdrop(merkleRoot)}>claim airdrop</button>
    </div>
  );
}

export default App;
