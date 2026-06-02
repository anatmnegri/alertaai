# 🚨 AlertAi | Sistema de Triagem da Defesa Civil

O **AlertAi** é uma Prova de Conceito (PoC) para um sistema inteligente de triagem de emergências. Ele utiliza Inteligência Artificial (Gemini) para processar mensagens recebidas via WhatsApp e as exibe em tempo real em um painel de controle simulado da Defesa Civil.

Este repositório foi estruturado para ser modular, permitindo que o backend e a ponte do WhatsApp permaneçam estáveis enquanto um novo frontend (Painel de Visualização) é desenvolvido.

---

## 🏗️ Arquitetura do Sistema

O sistema é composto por três componentes principais:

1.  **WhatsApp Bridge (`whatsapp-bridge.js`):** Um script em Node.js que utiliza a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys). Ele atua como um "ouvinte", capturando mensagens enviadas para o seu chat pessoal (self-chat) e encaminhando-as para o backend.
2.  **Backend API (C# / .NET 10):** Uma API ASP.NET Core que processa as mensagens, coordena a triagem com a IA, persiste os dados em um banco SQLite e notifica os frontends conectados via **SignalR**.
3.  **Gemini AI Service:** Integração com a API do Google Gemini para classificar a severidade (Alta, Média, Baixa), categoria (Deslizamento, Enchente, etc.) e gerar resumos técnicos.

---

## 🚦 Fluxo de Dados

1.  **Interceptação:** O cidadão envia uma mensagem para o WhatsApp do bot.
2.  **Ponte:** O `whatsapp-bridge.js` extrai o texto e o número do remetente e faz um `POST` para `http://localhost:5000/api/triage`.
3.  **Triagem:** O Backend envia o texto para o Gemini com um prompt estruturado. O Gemini responde com um JSON contendo a classificação.
4.  **Persistência:** A ocorrência é salva no banco `AlertAi.db` (SQLite).
5.  **Difusão (Real-time):** O Backend dispara um evento via SignalR (`NewOccurrence`) contendo o objeto completo da ocorrência.
6.  **Visualização:** Qualquer dashboard conectado ao Hub do SignalR recebe os dados e atualiza a interface instantaneamente.

---

## ⚙️ Configuração e Instalação

### Pré-requisitos
*   [.NET 10 SDK](https://dotnet.microsoft.com/download)
*   [Node.js (v18+)](https://nodejs.org/)
*   [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Backend (C#)
1.  Abra o arquivo `appsettings.json` e insira sua chave do Gemini:
    ```json
    "GeminiSettings": {
        "ApiKey": "SUA_CHAVE_AQUI",
        "ModelId": "gemini-1.5-flash"
    }
    ```
2.  Inicie o servidor:
    ```powershell
    dotnet run
    ```

### 2. WhatsApp Bridge (Node.js)
1.  Instale as dependências:
    ```powershell
    npm install
    ```
2.  Configure seu número no topo do arquivo `whatsapp-bridge.js`:
    ```javascript
    const YOUR_PHONE = '55819XXXXXXXX'; // Seu número com 55 + DDD
    ```
3.  Inicie a ponte:
    ```powershell
    npm start
    ```
4.  Escaneie o QR Code no terminal. **Nota:** O bot está configurado para processar mensagens enviadas para **você mesma** (conversa pessoal).

---

## 👩‍💻 Guia para a Nova Desenvolvedora (Integração de Frontend)

O frontend atual (`wwwroot/index.html`) é apenas uma simulação para validação técnica. Para criar o novo painel fiel à Defesa Civil, siga estas instruções:

### Conectando ao SignalR
O backend expõe um Hub do SignalR no endpoint `/hubs/emergency`.

**Exemplo de conexão (JavaScript):**
```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/emergency")
    .withAutomaticReconnect()
    .build();

connection.on("NewOccurrence", (occurrence) => {
    console.log("Nova ocorrência recebida:", occurrence);
    // Aqui você atualiza seu estado/UI
    // occurrence contém: telefone, mensagemOriginal, severidade, categoria, resumo, acaoRecomendada, dataOcorrencia
});

connection.start();
```

### Endpoints da API
*   `POST /api/triage`: (Interno) Usado pela ponte para registrar novas mensagens.
*   `GET /api/ocorrencias`: Retorna a lista histórica de todas as ocorrências salvas no banco.

### Estrutura do Objeto `Occurrence`
```json
{
  "id": 1,
  "telefone": "55819...",
  "mensagemOriginal": "...",
  "severidade": "Alta",
  "categoria": "Deslizamento",
  "resumo": "...",
  "acaoRecomendada": "...",
  "dataOcorrencia": "2024-05-20T..."
}
```

---

## 🛠️ Tecnologias Utilizadas
*   **Backend:** ASP.NET Core, Entity Framework Core (SQLite), SignalR.
*   **WhatsApp:** Baileys (Node.js).
*   **IA:** Google Gemini API.
*   **Frontend PoC:** HTML5, CSS3, JavaScript (Vanilla).

---
*Desenvolvido como parte da modernização dos sistemas de monitoramento da Defesa Civil.*
