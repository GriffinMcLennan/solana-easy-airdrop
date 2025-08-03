import "./App.css";
import { useCreateAirdrop } from "./hooks/useCreateAirdrop";
import { useClaimAirdrop } from "./hooks/useClaimAirdrop";

const MERKLE_ROOT = [
  53, 9, 147, 191, 167, 219, 140, 104, 245, 10, 37, 110, 101, 7, 193, 153, 60,
  13, 140, 44, 99, 201, 137, 46, 16, 237, 225, 14, 83, 49, 64, 158,
];

function App() {
  const createAirdrop = useCreateAirdrop();
  const claimAirdrop = useClaimAirdrop();

  return (
    <>
      <div>
        <p>Airdrop url</p>
        <button onClick={() => createAirdrop(MERKLE_ROOT, 20)}>
          create airdrop
        </button>
        <button onClick={() => claimAirdrop(MERKLE_ROOT)}>claim airdrop</button>
      </div>
    </>
  );
}

export default App;
