import React from "react";

interface MerkleRootInputProps {
  merkleRootInput: string;
  merkleRoot: number[];
  setMerkleRootInput: (value: string) => void;
  setMerkleRoot: (value: number[]) => void;
}

export const MerkleRootInput: React.FC<MerkleRootInputProps> = ({
  merkleRootInput,
  merkleRoot,
  setMerkleRootInput,
  setMerkleRoot,
}) => {
  const handleMerkleRootChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMerkleRootInput(e.target.value);
  };

  const parseMerkleRoot = (): number[] => {
    try {
      return merkleRootInput.split(",").map((str) => parseInt(str.trim(), 10));
    } catch (error) {
      console.error("Invalid merkle root input", error);
      return [];
    }
  };

  const updateMerkleRoot = () => {
    const parsed = parseMerkleRoot();
    if (
      parsed.length === 32 &&
      parsed.every((num) => !isNaN(num) && num >= 0 && num <= 255)
    ) {
      setMerkleRoot(parsed);
    } else {
      alert(
        "Invalid merkle root. Please enter 32 comma-separated numbers between 0 and 255."
      );
    }
  };

  return (
    <div>
      <div>
        <label>Merkle Root: </label>
        <input
          type="text"
          value={merkleRootInput}
          onChange={handleMerkleRootChange}
          style={{ width: "400px", margin: "10px" }}
        />
        <button onClick={updateMerkleRoot}>Update Merkle Root</button>
      </div>
      <div>
        <label>Current Merkle Root (Hex): </label>
        <div
          style={{
            margin: "10px",
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {merkleRoot
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")}
        </div>
      </div>
      <div>
        <label>Current Merkle Root (Bytes): </label>
        <div style={{ margin: "10px", fontFamily: "monospace" }}>
          [{merkleRoot.join(", ")}]
        </div>
      </div>
    </div>
  );
};
