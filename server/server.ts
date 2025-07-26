import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { AirdropController } from './airdrop';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const airdropController = new AirdropController();

// simple health check
app.get('/', (req: Request, res: Response) => {
    res.send('Airdrop server running');
});

app.get('/api/airdrop/:rootHex/:address', (req: Request, res: Response) => {
    const { rootHex, address } = req.params;

    if (!rootHex) {
        return res.status(400).json({ error: 'Missing rootHex' });
    }
    if (!address) {
        return res.status(400).json({ error: 'Missing address' });
    }

    try {
        const claim = airdropController.getUserClaim(rootHex, address);
        const proof = airdropController.generateProof(rootHex, claim.leaf_index);
        res.json({ claim, proof });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`⚡️ Server listening on http://localhost:${port}`);
});
