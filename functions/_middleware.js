// Cloudflare Pages runs this before every request: the site's pages pass, everything else
// meets the gate (lib/gate.mjs).
import { site } from "../lib/gate.mjs";

export const onRequest = (context) => site(context);
