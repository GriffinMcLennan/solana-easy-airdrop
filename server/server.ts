import express, {type Request, type Response } from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// simple health check
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

// example API route
app.get('/api/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong' });
});

// start server
app.listen(port, () => {
  console.log(`⚡️ Server listening on http://localhost:${port}`);
});
