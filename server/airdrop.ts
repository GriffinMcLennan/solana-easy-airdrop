import fs from "fs";
import path from "path";

interface ClaimEntry {
    amount: string;
    leaf_index: number;
}

interface AirdropRaw {
    merkle_root: string;
    merkle_tree: string[];
    claims: Record<string, ClaimEntry>;
}

type AirdropsData = Record<string, { claims: Record<string, ClaimEntry>; merkleTree: string[] }>;

export class AirdropController {
    private airdrops: AirdropsData;

    constructor() {
        this.airdrops = {};
        const dir = path.resolve(__dirname, "airdrop_jsons");

        for (const fn of fs.readdirSync(dir)) {
            if (!fn.endsWith(".json")) continue;
            const raw = fs.readFileSync(path.join(dir, fn), "utf-8");
            const data = JSON.parse(raw) as AirdropRaw;

            // merkle_root is already a hex string, use it directly as a key
            const rootHex = data.merkle_root;

            this.airdrops[rootHex] = {
                claims: data.claims,
                merkleTree: data.merkle_tree,
            };
        }
    }

    public getUserClaim(rootHex: string, address: string): ClaimEntry {
        const airdrop = this.airdrops[rootHex];
        if (!airdrop) {
            throw new Error(`Airdrop with merkle root ${rootHex} not found`);
        }

        const claim = airdrop.claims[address];

        if (!claim) {
            throw new Error(`User ${address} not found in airdrop ${rootHex}`);
        }

        return claim;
    }

    public generateProof(rootHex: string, leafIndex: number): string[] {
        const airdrop = this.airdrops[rootHex];
        if (!airdrop) {
            throw new Error(`Airdrop with merkle root ${rootHex} not found`);
        }

        const tree = airdrop.merkleTree;
        const proof: string[] = [];
        let index = leafIndex;

        while (index > 1) {
            const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
            proof.push(tree[siblingIndex]);
            index = Math.floor(index / 2);
        }

        return proof;
    }
}