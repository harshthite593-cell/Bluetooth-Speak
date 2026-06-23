#!/usr/bin/env node
/**
 * Patches Expo CLI's CorsMiddleware to allow Replit proxy domains.
 *
 * Replit's proxy changes the Host header on incoming requests, causing
 * Expo's CORS check to reject them as "Unauthorized". This patch makes
 * _isLocalHostname() also return true for *.replit.dev domains so that
 * Expo Go can connect through Replit's proxy without errors.
 *
 * Run automatically via postinstall; safe to re-run.
 */

const fs = require("fs");
const path = require("path");

const PNPM_ROOT = path.resolve(__dirname, "..", "node_modules", ".pnpm");

const ORIGINAL = `const _isLocalHostname = (hostname)=>{
    if (hostname === 'localhost') {
        return true;
    }`;

const PATCHED = `const _isLocalHostname = (hostname)=>{
    if (hostname === 'localhost') {
        return true;
    }
    // Replit proxy patch: allow *.replit.dev so Expo Go works via Replit's proxy
    if (hostname && (hostname.endsWith('.replit.dev') || hostname.endsWith('.repl.co') || hostname.endsWith('.replit.app'))) {
        return true;
    }`;

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("Replit proxy patch")) return false; // already patched
  if (!content.includes(ORIGINAL)) return false; // structure changed — skip
  fs.writeFileSync(filePath, content.replace(ORIGINAL, PATCHED), "utf8");
  return true;
}

// Find all @expo+cli directories in .pnpm and patch their CorsMiddleware.js
let patched = 0;
let found = 0;

if (!fs.existsSync(PNPM_ROOT)) {
  console.log("[patch-expo-cors] node_modules/.pnpm not found — skipping.");
  process.exit(0);
}

for (const entry of fs.readdirSync(PNPM_ROOT)) {
  if (!entry.startsWith("@expo+cli@")) continue;

  // Build the known relative path inside this @expo+cli package
  const middlewareDir = path.join(
    PNPM_ROOT,
    entry,
    "node_modules",
    "@expo",
    "cli",
    "build",
    "src",
    "start",
    "server",
    "middleware"
  );

  const target = path.join(middlewareDir, "CorsMiddleware.js");
  if (!fs.existsSync(target)) continue;

  found++;
  const didPatch = patchFile(target);
  if (didPatch) {
    console.log(`[patch-expo-cors] Patched: ${target}`);
    patched++;
  } else {
    console.log(`[patch-expo-cors] Already patched or incompatible: ${target}`);
  }
}

if (found === 0) {
  console.log("[patch-expo-cors] No @expo+cli packages found — skipping.");
} else if (patched === 0) {
  console.log("[patch-expo-cors] All files already patched — nothing to do.");
} else {
  console.log(`[patch-expo-cors] Done. Patched ${patched} file(s).`);
}
