import { createApp } from './app.js';
import { getEnv } from './config/env.js';

const { app } = createApp();
const { port } = getEnv();

app.listen(port, () => {
  console.log(`langgraph-gemini-browser-isolation-poc listening on http://localhost:${port}`);
});
