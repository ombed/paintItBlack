// Cloudflare Pages runs this before every file under /app/: the gate (lib/gate.mjs).
import { gate } from "../../lib/gate.mjs";

export const onRequest = (context) => gate(context);
