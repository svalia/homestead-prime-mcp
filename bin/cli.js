#!/usr/bin/env node
/**
 * Homestead Prime — MCP CLI Bridge & Auto-Installer
 * Supports:
 * 1. Stdio MCP Bridge (forwards JSON-RPC 2.0 to https://homesteadprime.ru/mcp)
 * 2. Auto-installer (`npx -y homestead-prime-mcp install --url https://homesteadprime.ru/mcp --code XXXX-XXXX`)
 *    Automatically configures:
 *    - Google Antigravity (`~/.gemini/config/mcp_config.json` + `~/.gemini/config/skills/homestead-prime/SKILL.md`)
 *    - Gemini CLI (`~/.gemini/settings.json`)
 *    - Claude Desktop (`claude_desktop_config.json`)
 *    - Claude Code (`~/.claude.json`)
 *    - Cursor (`~/.cursor/mcp.json`)
 *    - Windsurf (`~/.codeium/windsurf/mcp_config.json`)
 *    - OpenAI Codex (`~/.codex/config.toml` & `~/.codex/mcp.json`)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const args = process.argv.slice(2);
function getArg(flag, fallback = '') {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  const eq = args.find(a => a.startsWith(flag + '='));
  if (eq) return eq.slice(flag.length + 1);
  return fallback;
}

const isInstall = args.includes('install') || args.includes('--install');
const isHelp = args.includes('--help') || args.includes('-h');
const mcpUrl = getArg('--url', process.env.HSM_MCP_URL || 'https://homesteadprime.ru/mcp').replace(/\/+$/, '');
let authToken = getArg('--token', process.env.HSM_MCP_TOKEN || '');
const connectCode = getArg('--code', process.env.HSM_MCP_CODE || '');
const clientFilter = getArg('--client', 'all').toLowerCase();

if (isHelp) {
  console.log(`
Homestead Prime MCP Server & Auto-Installer (v1.3.0)

Использование:
  1. Авто-установка в Antigravity, Gemini CLI, Claude, Cursor, Windsurf и Codex:
     npx -y homestead-prime-mcp install --url https://homesteadprime.ru/mcp --code XXXX-XXXX

  2. Опциональный выбор конкретного клиента (--client):
     npx -y homestead-prime-mcp install --client antigravity --code XXXX-XXXX
     npx -y homestead-prime-mcp install --client gemini --code XXXX-XXXX
     (доступны: all, antigravity / agy, gemini, claude, cursor, windsurf, codex)

  3. Запуск в режиме MCP stdio-моста:
     npx -y homestead-prime-mcp --url https://homesteadprime.ru/mcp --token <TOKEN>
`);
  process.exit(0);
}

async function postJsonRpc(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function exchangeCodeIfNeeded() {
  if (!connectCode) return authToken;
  try {
    const rpcRes = await postJsonRpc(mcpUrl, {
      jsonrpc: '2.0',
      id: 'init-code-exchange',
      method: 'tools/call',
      params: {
        name: 'hsm_authorize_with_code',
        arguments: { code: connectCode }
      }
    }, authToken);
    const text = rpcRes?.result?.content?.[0]?.text || '';
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.access_token) {
        authToken = parsed.access_token;
        return authToken;
      }
    }
  } catch (e) {
    // Continue even if code was already exchanged or requires approval in app
  }
  return authToken;
}

function upsertJsonMcpServer(filePath, serverName, entryObj, createDirIfMissing = false) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    if (!createDirIfMissing) return false;
    fs.mkdirSync(dir, { recursive: true });
  }
  let current = {};
  if (fs.existsSync(filePath)) {
    try {
      current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      current = {};
    }
  }
  if (!current.mcpServers || typeof current.mcpServers !== 'object') {
    current.mcpServers = {};
  }
  current.mcpServers[serverName] = entryObj;
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  return true;
}

function upsertCodexToml(tomlPath, serverCommandArgs) {
  const dir = path.dirname(tomlPath);
  if (!fs.existsSync(dir)) return false;
  let content = '';
  if (fs.existsSync(tomlPath)) {
    try {
      content = fs.readFileSync(tomlPath, 'utf8');
    } catch (e) {
      content = '';
    }
  }
  // Remove previous [mcp_servers.homestead-prime] or [mcp_servers.homestead_prime] block if present
  content = content.replace(/\n?\[mcp_servers\.(?:homestead-prime|homestead_prime)\][\s\S]*?(?=\n\[|$)/g, '');
  const argsJson = JSON.stringify(serverCommandArgs);
  const block = `\n[mcp_servers.homestead_prime]\ncommand = "npx"\nargs = ${argsJson}\n`;
  fs.writeFileSync(tomlPath, content.trimEnd() + '\n' + block, 'utf8');
  return true;
}

async function installAntigravitySkill(homeDir) {
  const skillDirs = [
    path.join(homeDir, '.gemini', 'config', 'skills', 'homestead-prime')
  ];
  if (fs.existsSync(path.join(homeDir, '.gemini', 'antigravity'))) {
    skillDirs.push(path.join(homeDir, '.gemini', 'antigravity', 'skills', 'homestead-prime'));
  }

  let skillContent = '';
  const bundledSkill = path.join(__dirname, '..', 'SKILL.md');
  if (fs.existsSync(bundledSkill)) {
    try {
      skillContent = fs.readFileSync(bundledSkill, 'utf8');
    } catch (e) {}
  }
  if (!skillContent) {
    try {
      const skillEndpoint = mcpUrl.replace(/\/mcp$/, '/mcp/skill.md');
      const res = await fetch(skillEndpoint);
      if (res.ok) skillContent = await res.text();
    } catch (e) {}
  }
  if (!skillContent) return [];

  const installedPaths = [];
  for (const sDir of skillDirs) {
    try {
      fs.mkdirSync(sDir, { recursive: true });
      const targetMd = path.join(sDir, 'SKILL.md');
      fs.writeFileSync(targetMd, skillContent, 'utf8');
      installedPaths.push(targetMd);
    } catch (e) {}
  }
  return installedPaths;
}

function matchesClient(target) {
  if (!clientFilter || clientFilter === 'all') return true;
  if (target === 'antigravity' && (clientFilter === 'antigravity' || clientFilter === 'agy')) return true;
  if (target === 'gemini' && (clientFilter === 'gemini' || clientFilter === 'gemini-cli')) return true;
  return clientFilter === target;
}

async function runInstaller() {
  console.log('⟳ Homestead Prime MCP: подготовка установки...');
  await exchangeCodeIfNeeded();

  const home = os.homedir();
  const authedUrl = authToken
    ? `${mcpUrl}${mcpUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(authToken)}`
    : mcpUrl;

  const stdioArgs = ['-y', 'homestead-prime-mcp', '--url', mcpUrl];
  if (authToken) stdioArgs.push('--token', authToken);
  else if (connectCode) stdioArgs.push('--code', connectCode);

  const stdioEntry = {
    command: 'npx',
    args: stdioArgs
  };

  // Antigravity supports native Streamable HTTP via `url` as well as stdio `command`/`args`.
  // Using direct Streamable HTTP `url` when token is known makes tool calls instant without spawning a child process!
  const antigravityEntry = authToken
    ? { url: authedUrl }
    : stdioEntry;

  // Gemini CLI supports `httpUrl` / `url` or `command` + `args` in ~/.gemini/settings.json
  const geminiCliEntry = authToken
    ? { httpUrl: authedUrl, url: authedUrl }
    : stdioEntry;

  const updated = [];

  // 1. Google Antigravity (`~/.gemini/config/mcp_config.json` + Skill `~/.gemini/config/skills/homestead-prime/SKILL.md`)
  if (matchesClient('antigravity')) {
    const agyConfigPath = path.join(home, '.gemini', 'config', 'mcp_config.json');
    if (upsertJsonMcpServer(agyConfigPath, 'homestead-prime', antigravityEntry, true)) {
      updated.push(`Google Antigravity MCP (${agyConfigPath})`);
    }
    const agyAltDir = path.join(home, '.gemini', 'antigravity');
    if (fs.existsSync(agyAltDir)) {
      const agyAltConfig = path.join(agyAltDir, 'mcp_config.json');
      if (upsertJsonMcpServer(agyAltConfig, 'homestead-prime', antigravityEntry, true)) {
        updated.push(`Google Antigravity IDE (${agyAltConfig})`);
      }
    }
    const skillFiles = await installAntigravitySkill(home);
    for (const sf of skillFiles) {
      updated.push(`Google Antigravity Skill (${sf})`);
    }
  }

  // 2. Gemini CLI (`~/.gemini/settings.json`)
  if (matchesClient('gemini')) {
    const geminiSettingsPath = path.join(home, '.gemini', 'settings.json');
    if (upsertJsonMcpServer(geminiSettingsPath, 'homestead-prime', geminiCliEntry, true)) {
      updated.push(`Gemini CLI (${geminiSettingsPath})`);
    }
  }

  // 3. Claude Desktop (macOS / Windows / Linux) & Claude Code (`~/.claude.json`)
  if (matchesClient('claude')) {
    const claudeCandidates = [
      path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      process.env.APPDATA ? path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json') : ''
    ].filter(Boolean);
    for (const cPath of claudeCandidates) {
      if (upsertJsonMcpServer(cPath, 'homestead-prime', stdioEntry, clientFilter === 'claude')) {
        updated.push(`Claude Desktop (${cPath})`);
      }
    }
    const claudeCodePath = path.join(home, '.claude.json');
    if (upsertJsonMcpServer(claudeCodePath, 'homestead-prime', stdioEntry, true)) {
      updated.push(`Claude Code (${claudeCodePath})`);
    }
  }

  // 4. Cursor (`~/.cursor/mcp.json`)
  if (matchesClient('cursor')) {
    const cursorPath = path.join(home, '.cursor', 'mcp.json');
    if (upsertJsonMcpServer(cursorPath, 'homestead-prime', stdioEntry, clientFilter === 'cursor' || fs.existsSync(path.join(home, '.cursor')))) {
      updated.push(`Cursor (${cursorPath})`);
    }
  }

  // 5. Windsurf (`~/.codeium/windsurf/mcp_config.json`)
  if (matchesClient('windsurf')) {
    const windsurfPath = path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
    if (upsertJsonMcpServer(windsurfPath, 'homestead-prime', stdioEntry, clientFilter === 'windsurf')) {
      updated.push(`Windsurf (${windsurfPath})`);
    }
  }

  // 6. OpenAI Codex (`~/.codex/config.toml` & `~/.codex/mcp.json`)
  if (matchesClient('codex')) {
    const codexDir = path.join(home, '.codex');
    if (clientFilter === 'codex' && !fs.existsSync(codexDir)) {
      fs.mkdirSync(codexDir, { recursive: true });
    }
    if (fs.existsSync(codexDir)) {
      const codexJson = path.join(codexDir, 'mcp.json');
      if (upsertJsonMcpServer(codexJson, 'homestead-prime', stdioEntry, true)) {
        updated.push(`OpenAI Codex (${codexJson})`);
      }
      const codexToml = path.join(codexDir, 'config.toml');
      if (upsertCodexToml(codexToml, stdioArgs)) {
        updated.push(`OpenAI Codex TOML (${codexToml})`);
      }
    }
  }

  console.log('✓ MCP-сервер Homestead Prime успешно установлен!');
  console.log(`  URL сервера: ${mcpUrl}`);
  if (authToken) {
    console.log(`  Авторизация: Токен получен (${authToken.slice(0, 12)}…)`);
  } else {
    console.log('  Авторизация: Для привязки дома передайте --code XXXX-XXXX или вызовите инструмент hsm_authorize_with_code');
  }
  if (updated.length) {
    console.log('  Обновлены конфигурации ИИ-ассистентов:');
    for (const u of updated) console.log('   • ' + u);
  }
}

async function runStdioBridge() {
  await exchangeCodeIfNeeded();
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (e) {
      return;
    }
    try {
      // Intercept hsm_authorize_with_code result to cache token in memory for subsequent requests
      const resp = await postJsonRpc(mcpUrl, msg, authToken);
      if (msg.method === 'tools/call' && msg.params?.name === 'hsm_authorize_with_code') {
        try {
          const inner = JSON.parse(resp?.result?.content?.[0]?.text || '{}');
          if (inner.access_token) authToken = inner.access_token;
        } catch (e) {}
      }
      if (msg.id !== undefined && msg.id !== null) {
        process.stdout.write(JSON.stringify(resp) + '\n');
      }
    } catch (err) {
      if (msg.id !== undefined && msg.id !== null) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32000, message: err.message || 'MCP Bridge Network Error' }
        }) + '\n');
      }
    }
  });
}

if (isInstall) {
  runInstaller().catch(err => {
    console.error('Ошибка установки Homestead Prime MCP:', err.message);
    process.exit(1);
  });
} else {
  runStdioBridge();
}
