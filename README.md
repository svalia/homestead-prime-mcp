# Homestead Prime MCP (`homestead-prime-mcp`)

Официальный MCP-пакет (Model Context Protocol) и авто-установщик для управления резиденцией, персоналом, финансами и первичной настройкой дома через **Google Antigravity**, **Gemini CLI**, **Claude Desktop**, **Claude Code**, **ChatGPT**, **Cursor**, **Windsurf** и **OpenAI Codex**.

---

## Быстрая установка одной командой (CLI / Терминал)

Выполните в терминале (или отправьте эту команду своему ИИ-агенту вместе с кодом из приложения):

```bash
npx -y homestead-prime-mcp install --url https://homesteadprime.ru/mcp --code XXXX-XXXX
```

Или без `npx` (через прямую установку `install.sh`):

```bash
curl -fsSL https://homesteadprime.ru/mcp/install.sh | bash -s -- --code XXXX-XXXX
```

Установщик автоматически:
1. Обменяет одноразовый код `XXXX-XXXX` (полученный в Mini App **Homestead Prime → Ещё → ИИ-ассистенты**) на постоянный токен доступа к вашему дому.
2. Пропишет MCP-сервер во все установленные клиенты:
   - **Google Antigravity (`agy`):** `~/.gemini/config/mcp_config.json` (и `~/.gemini/antigravity/mcp_config.json`) + автоматически установит навык `~/.gemini/config/skills/homestead-prime/SKILL.md`.
   - **Gemini CLI (`gemini`):** `~/.gemini/settings.json` (`mcpServers["homestead-prime"]`).
   - **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows) / `~/.config/Claude/claude_desktop_config.json` (Linux).
   - **Claude Code:** `~/.claude.json`.
   - **Cursor:** `~/.cursor/mcp.json`.
   - **Windsurf:** `~/.codeium/windsurf/mcp_config.json`.
   - **OpenAI Codex:** `~/.codex/mcp.json` и `~/.codex/config.toml`.

Вы также можете указать конкретный клиент флагом `--client`:
```bash
npx -y homestead-prime-mcp install --client antigravity --code XXXX-XXXX
npx -y homestead-prime-mcp install --client gemini --code XXXX-XXXX
```

---

## Альтернативное подключение по прямому URL (Streamable HTTP)

Если ваш клиент поддерживает удалённый MCP по URL (Google Antigravity, Gemini CLI, Claude Web/Desktop Connectors, ChatGPT Connectors):
- **Имя:** `Homestead Prime`
- **URL MCP-сервера:** `https://homesteadprime.ru/mcp`
- После подключения скажите ассистенту: *«Авторизуй дом по коду XXXX-XXXX»* — ассистент вызовет `hsm_authorize_with_code` и сразу привяжет ваш аккаунт.

---

## Доступные инструменты (MCP Tools)

- `hsm_authorize_with_code` — мгновенная авторизация по коду `XXXX-XXXX` из приложения.
- `hsm_get_context_and_onboarding_status` — контекст дома, список объектов, персонала и статус 9 шагов настройки.
- `hsm_onboarding_save_step` — сохранение данных любого шага первичной настройки дома (`O2`–`O10`) прямо из диалога.
- `hsm_onboarding_pause` — пауза настройки дома на текущем шаге с сохранением прогресса.
- `hsm_submit_concierge_brief` — заявка «Сделайте всё за меня» персональному директору.
- `hsm_get_house_briefing` — сводка «Как дела дома?» (задачи, кто на смене, чеки, невозвращённая сдача, открытые решения).
- `hsm_create_order_or_task` — создание поручений, вызов машины к объекту, поручения на закупку (со сдачей / без сдачи / из кубышки) с автоматическим уточнением при неоднозначности (`needs_clarification`).
- `hsm_ask_or_clarify_with_staff` — отправка вопроса сотруднику по задаче, расходу или ТО с возвратом истории и деталей чека.
- `hsm_resolve_decision_or_expense` — приёмка работ, согласование расходов, подтверждение чеков и возврата сдачи.
- `hsm_query_house_guide_and_rules` — памятка для гостей и семьи (пароль от Wi-Fi, ворота, правила дома) и статус своих поручений.
- `hsm_rate_or_reward_staff` — оценка `5★`, благодарность, чаевые и премии персоналу.
