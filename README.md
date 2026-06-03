# AlertAI — Sistema Inteligente de Triagem da Defesa Civil

Sistema que utiliza IA para triar automaticamente ocorrências de emergência enviadas via WhatsApp, exibindo-as em tempo real em um painel de controle da Defesa Civil de Recife.

---

## Estrutura do Repositório

```
alertaai/
├── painelAlertaAI/   → Painel web (React + Vite)
└── wppAlertaAi/      → Backend (.NET 10) + Bridge WhatsApp (Node.js)
```

---

## Como Funciona

```
Cidadão (WhatsApp)
        ↓
  whatsapp-bridge.js
  (captura a mensagem)
        ↓
  POST /api/triage
        ↓
  Gemini AI
  (classifica: categoria, severidade, endereço)
        ↓
  SQLite  →  SignalR  →  Painel em tempo real
```

---

## Pré-requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js v18+](https://nodejs.org)
- Chave da [Gemini API](https://aistudio.google.com) (começa com `AIza...`)

---

## Configuração Inicial

### 1. Variáveis de ambiente

```bash
cd wppAlertaAi
cp .env.example .env
```

Edite o `.env` e preencha:

```env
GeminiSettings__ApiKey=AIzaSy_SUA_CHAVE_AQUI
YOUR_PHONE=5581999999999
```

### 2. Backend (.NET)

```bash
cd wppAlertaAi
dotnet run
```

API disponível em `http://localhost:5019`

### 3. Bridge WhatsApp (Node.js)

Em outro terminal:

```bash
cd wppAlertaAi
npm install
npm start
```

Escaneie o QR Code que aparecer no terminal com seu WhatsApp.

### 4. Painel (React)

Em outro terminal:

```bash
cd painelAlertaAI
npm install
npm run dev
```

Painel disponível em `http://localhost:5173`

---

## Testando

Com tudo rodando, envie uma mensagem para **seu próprio chat** no WhatsApp descrevendo uma ocorrência:

> _"Alagamento na Rua das Flores, Boa Viagem, água subindo rápido"_

O sistema vai:
1. Capturar a mensagem
2. Classificar via Gemini (categoria, severidade, endereço)
3. Geocodificar o endereço
4. Exibir no painel em tempo real

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Recharts, Leaflet |
| Backend | ASP.NET Core (.NET 10), SignalR, EF Core + SQLite |
| Bridge | Node.js, Baileys (WhatsApp Web) |
| IA | Google Gemini API (`gemini-1.5-flash`) |

---

## Documentação Detalhada

- [Backend e Bridge →](wppAlertaAi/README.md)
- [Painel React →](painelAlertaAI/README.md)

---

*Desenvolvido como PoC acadêmico na UFRPE.*
