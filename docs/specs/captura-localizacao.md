# Especificação SDD — Captura de Localização

## Metadados

| Campo | Valor |
|-------|--------|
| **Status** | `implemented` |
| **Versão** | `0.1.0` |
| **Data** | 2026-06-03 |
| **Autores** | Equipe AlertAI (PoC UFRPE / Defesa Civil Recife) |
| **Card** | Captura de Localização — Alta, 5 SP, Sprint 2 |
| **Links** | [README raiz](../../README.md) · [Backend/Bridge](../../wppAlertaAi/README.md) · [Regras bridge](../../.cursor/rules/whatsapp-bridge.mdc) · [Regras backend](../../.cursor/rules/backend-dotnet.mdc) · [Regras painel](../../.cursor/rules/frontend-painel.mdc) |

---

## Contexto e objetivo

O AlertAI hoje processa **apenas texto** no self-chat do WhatsApp: `whatsapp-bridge.js` chama `extractMessageText()` e descarta mensagens sem texto legível; a API em `Program.cs` tria com Gemini e faz **geocodificação direta** (endereço → coordenadas) via Nominatim. O painel já persiste e exibe `latitude`/`longitude` quando existem (`Occurrence`, `mapearOcorrencia`, `MapCard`), mas essas coordenadas vêm quase sempre de endereço digitado na mensagem, não do pin nativo do WhatsApp.

**Objetivo desta feature:** quando o cidadão envia **localização nativa** (pin do WhatsApp), extrair `lat`/`lng` dos metadados Baileys, persistir, exibir pin clicável no mapa e preencher endereço legível (rua, bairro, número) por **geocodificação reversa**, sem exigir que o usuário saiba o endereço.

---

## Escopo

### Dentro do escopo

- Mensagens `locationMessage` e `liveLocationMessage` no self-chat (fluxo atual do bridge).
- Extensão do payload `POST /api/triage` com coordenadas e metadados mínimos.
- Backend: priorizar coordenadas do WhatsApp; reversa Nominatim; persistência e SignalR inalterados em contrato de evento (`NewOccurrence` com `Occurrence`).
- Painel: pins de ocorrência com interação (popup e/ou abertura de detalhe); endereço exibido em lista/modal.
- PoC: uma conta (`YOUR_PHONE`), sem grupos.

### Fora do escopo

- Localização enviada **só como texto** (ex.: “-8.04, -34.90”) — continua coberta pelo fluxo atual + Gemini.
- Rastreamento contínuo de live location (atualizar pin a cada `messages.upsert` do live) — pode ser fase futura.
- Mapa no `ChamadoModal` embutido (mini-mapa) — opcional pós-MVP.
- Autenticação do painel, multi-tenant, fila de rate limit distribuída.
- Migrações EF formais (manter padrão `ALTER TABLE` defensivo do projeto).
- Evolution API (DTOs em `Models.cs` permanecem legados; bridge ativo é Baileys).

---

## User story e critérios de aceite (Given / When / Then)

**História:** Como cidadão, quero enviar minha localização nativa do WhatsApp, para que a Defesa Civil saiba onde estou sem eu precisar saber o endereço.

### CA-1 — Extrair coordenadas dos metadados WhatsApp

| ID | Given | When | Then |
|----|--------|------|------|
| CA-1.1 | Bridge conectado ao self-chat | O usuário envia um pin de localização (`locationMessage`) | O bridge extrai `degreesLatitude` e `degreesLongitude` e envia no POST sem depender de OCR ou Gemini para coordenadas |
| CA-1.2 | Mensagem encapsulada em `ephemeralMessage` ou `viewOnceMessage` | O handler processa a mensagem | A localização é encontrada no nível interno (mesmo padrão de `extractMessageText`) |
| CA-1.3 | Mensagem é `liveLocationMessage` com coordenadas | O usuário compartilha localização ao vivo (primeiro fix) | Coordenadas são extraídas como em CA-1.1 |
| CA-1.4 | Mensagem não contém localização | Chega apenas texto | Fluxo atual permanece (texto → Gemini → geocode direto) |

### CA-2 — Painel: pin clicável

| ID | Given | When | Then |
|----|--------|------|------|
| CA-2.1 | Ocorrência salva com `latitude` e `longitude` | O painel carrega dashboard ou recebe `NewOccurrence` | Um marcador laranja aparece em `MapCard` na posição correta |
| CA-2.2 | Operador clica no pin da ocorrência | Interação no mapa | Exibe popup com identificador/resumo e ação para ver detalhes (modal `ChamadoModal` ou equivalente) |
| CA-2.3 | Ocorrência sem coordenadas | Lista no mapa | Não renderiza pin de ocorrência (comportamento atual `filter lat/lng`) |

### CA-3 — Geocodificação reversa

| ID | Given | When | Then |
|----|--------|------|------|
| CA-3.1 | Coordenadas válidas no Recife (ou região metropolitana) | API persiste ocorrência | `endereco` e `bairro` (e número quando disponível no retorno Nominatim) são preenchidos via reversa |
| CA-3.2 | Nominatim indisponível ou sem resultado | Persistência | Coordenadas permanecem; endereço exibe fallback “Localização não informada” no painel (`mapearOcorrencia`) |
| CA-3.3 | Mensagem traz localização **e** texto descritivo | Triagem | Gemini classifica pelo texto; coordenadas do WhatsApp **não** são sobrescritas pela geocode direta do endereço textual |

---

## Requisitos funcionais

| ID | Requisito |
|----|-----------|
| RF-01 | O bridge deve detectar `locationMessage` e `liveLocationMessage` em `msg.message`, incluindo wrappers (`ephemeralMessage`, `viewOnceMessage`). |
| RF-02 | O bridge deve enviar `latitude` e `longitude` (double, WGS84) no corpo do `POST /api/triage`. |
| RF-03 | O bridge deve permitir mensagem **somente localização** (sem texto): `mensagemTexto` pode ser string vazia ou texto sintético acordado (ver RF-08). |
| RF-04 | A API deve aceitar coordenadas opcionais em `WebhookPayload` e gravá-las em `Occurrence.Latitude` / `Occurrence.Longitude`. |
| RF-05 | Se coordenadas vierem do WhatsApp, a API **não** deve substituí-las pelo resultado de `GeocodificarAsync` (forward) baseado só no endereço da IA. |
| RF-06 | Se coordenadas vierem do WhatsApp, a API deve chamar geocodificação **reversa** e preencher `Endereco`, `Bairro` e, quando possível, número da via. |
| RF-07 | SignalR deve continuar emitindo `NewOccurrence` com a entidade completa já geocodificada (reversa concluída antes do `SaveChanges` ou logo após, de forma síncrona na requisição). |
| RF-08 | Triagem Gemini: para localização sem texto, usar prompt com contexto fixo (ex.: “O cidadão enviou apenas localização GPS via WhatsApp”) para obter severidade/categoria/resumo. |
| RF-09 | Resposta WhatsApp ao cidadão (`sock.sendMessage` em `whatsapp-bridge.js`) deve mostrar endereço reverso quando existir. |
| RF-10 | O painel deve exibir endereço reverso em `localizacao` / modal e pin interativo no mapa. |
| RF-11 | Registrar origem da localização (enum/string: `whatsapp_gps`, `geocode_texto`, `manual`) — recomendado para auditoria PoC. |

---

## Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | Respeitar política Nominatim: máx. **1 req/s**, `User-Agent: AlertAI-DefesaCivil/1.0` (já em `Program.cs` linha 37). |
| RNF-02 | Timeout HTTP Nominatim ≤ 5 s; falha não bloqueia persistência de coordenadas. |
| RNF-03 | Lat/lng com precisão double; validar faixa (-90..90, -180..180) antes de persistir. |
| RNF-04 | Logs em PT-BR no bridge (`pino`) e backend (`ILogger`) sem expor chaves. |
| RNF-05 | Compatibilidade JSON: ASP.NET aceita PascalCase e camelCase no body; manter consistência com bridge (`TelefoneRemetente`, etc.). |
| RNF-06 | Tempo extra no `POST /api/triage` aceitável na PoC (< 35 s, alinhado ao `timeout: 30000` do axios no bridge). |

---

## Modelo de dados

### Entidade `Occurrence` (`wppAlertaAi/Models/Models.cs`)

| Campo | Tipo | Alteração | Uso |
|-------|------|-----------|-----|
| `Latitude` | `double?` | Existente | Coordenada; prioridade: WhatsApp > forward Nominatim |
| `Longitude` | `double?` | Existente | Idem |
| `Endereco` | `string?` | Existente | Reversa: `road` + `house_number` ou `display_name` resumido |
| `Bairro` | `string?` | Existente | Reversa: `suburb` ou `neighbourhood` |
| `Numero` | `string?` | **Novo (recomendado)** | `house_number` do Nominatim quando existir |
| `OrigemLocalizacao` | `string?` | **Novo (recomendado)** | `whatsapp_gps` \| `geocode_texto` \| `desconhecida` |
| `MensagemOriginal` | `string` | Comportamento | Texto do usuário ou placeholder documentado em RF-08 |

**Startup:** adicionar `ALTER TABLE` defensivo em `Program.cs` (mesmo padrão das linhas 47–50).

### DTO `WebhookPayload` (`Models/Models.cs`)

```csharp
public record WebhookPayload(
    string TelefoneRemetente,
    string MensagemTexto,
    double? Latitude = null,
    double? Longitude = null,
    string? TipoMensagem = null,  // "location" | "live_location" | "text"
    string? NomeLocalWhatsapp = null,  // locationMessage.name
    string? EnderecoWhatsapp = null    // locationMessage.address (rótulo WA, não confiável como verdade)
);
```

### Painel — objeto após `mapearOcorrencia` (`painelAlertaAI/src/services/api.js`)

| Campo UI | Origem API | Alteração |
|----------|------------|-----------|
| `lat`, `lng` | `latitude`, `longitude` | Existente |
| `endereco`, `bairro` | homônimos | Existente |
| `numero` | `numero` (novo) | **Novo** — compor `localizacao` |
| `origemLocalizacao` | `origemLocalizacao` | **Novo** — badge opcional no modal |
| `localizacao` | join endereço+bairro+número | Atualizar regra de formatação |

---

## Contratos de API

### `POST /api/triage`

**Request — somente texto (atual)**

```json
{
  "telefoneRemetente": "5581999999999",
  "mensagemTexto": "Alagamento na Rua das Flores, Boa Viagem"
}
```

**Request — localização nativa (novo)**

```json
{
  "telefoneRemetente": "5581999999999",
  "mensagemTexto": "",
  "latitude": -8.0478,
  "longitude": -34.8772,
  "tipoMensagem": "location",
  "nomeLocalWhatsapp": "Minha localização",
  "enderecoWhatsapp": null
}
```

**Request — localização + legenda/caption** (se WA enviar texto junto; opcional fase 1)

```json
{
  "telefoneRemetente": "5581999999999",
  "mensagemTexto": "Água subindo rápido aqui",
  "latitude": -8.0478,
  "longitude": -34.8772,
  "tipoMensagem": "location"
}
```

**Response — sucesso (inalterado estruturalmente)**

```json
{
  "status": "sucesso",
  "message": "Ocorrência adicionada ao painel da Defesa Civil.",
  "data": {
    "severidade": "Alta",
    "categoria": "Enchente",
    "resumo": "…",
    "acao_recomendada": "…",
    "endereco": "Rua Exemplo",
    "bairro": "Boa Viagem"
  }
}
```

**Nota:** `data` continua sendo `TriageResult`; endereço reverso completo pode ser expandido na resposta em versão futura (`occurrenceId`, `numero`, `origemLocalizacao`).

### `GET /api/ocorrencias` / SignalR `NewOccurrence`

Campos adicionais serializados em camelCase pelo ASP.NET:

```json
{
  "id": 42,
  "telefone": "5581999999999",
  "mensagemOriginal": "[Localização WhatsApp]",
  "severidade": "Media",
  "categoria": "Outros",
  "resumo": "Cidadão enviou localização GPS",
  "acaoRecomendada": "…",
  "endereco": "Avenida Conde da Boa Vista",
  "bairro": "Boa Vista",
  "numero": "123",
  "latitude": -8.0478,
  "longitude": -34.8772,
  "origemLocalizacao": "whatsapp_gps",
  "dataOcorrencia": "2026-06-03T14:00:00Z",
  "aberto": true
}
```

---

## Fluxo ponta a ponta

```mermaid
sequenceDiagram
    participant C as Cidadão (WhatsApp)
    participant B as whatsapp-bridge.js
    participant API as Program.cs /api/triage
    participant G as GeminiTriageService
    participant N as Nominatim
    participant DB as SQLite Occurrences
    participant H as EmergencyHub SignalR
    participant P as painel App.jsx / MapCard

    C->>B: locationMessage (degreesLatitude/Longitude)
    B->>B: extractLocationFromMessage(msg.message)
    B->>API: POST WebhookPayload + lat/lng
    API->>G: TriageAsync(mensagemTexto ou placeholder)
    G-->>API: TriageResult
    alt Coordenadas WhatsApp presentes
        API->>N: GET /reverse?lat=&lon=&addressdetails=1
        N-->>API: address (road, house_number, suburb…)
        API->>API: Preenche Endereco, Bairro, Numero; Origem=whatsapp_gps
    else Apenas texto
        API->>N: GET /search (GeocodificarAsync atual)
        N-->>API: lat/lon
        API->>API: Origem=geocode_texto
    end
    API->>DB: Save Occurrence
    API->>H: NewOccurrence
    H->>P: mapearOcorrencia + Marker
    API-->>B: 200 + TriageResult
    B->>C: Mensagem confirmação com localização
```

---

## Mudanças por camada

### Bridge Node — `wppAlertaAi/whatsapp-bridge.js`

| Área | Situação atual | Mudança proposta |
|------|----------------|------------------|
| `extractMessageText` (L74–120) | Só texto | Manter; não usar para localização |
| Handler `messages.upsert` (L352–357) | `if (!text) continue` | Se `extractLocationFromMessage` retornar coords, processar mesmo sem texto |
| Payload axios (L364–369) | `TelefoneRemetente`, `MensagemTexto` | Incluir `Latitude`, `Longitude`, `TipoMensagem`, campos opcionais WA |
| Logs | Chaves da mensagem | Logar `tipoMensagem=location` sem coordenadas completas em produção |

**Função nova (especificação):**

```javascript
// Retorno: { latitude, longitude, tipo, nome?, enderecoWhatsapp? } | null
function extractLocationFromMessage(message) {
  // 1) Desembrulhar ephemeral / viewOnce (espelhar extractMessageText)
  // 2) if (message.locationMessage) ler degreesLatitude, degreesLongitude
  // 3) if (message.liveLocationMessage) idem
  // 4) Validar números finitos
}
```

**Referência Baileys (@whiskeysockets/baileys ^6.7.9):** protobuf `ILocationMessage` com `degreesLatitude`, `degreesLongitude`; opcionais `name`, `address` (rótulo), `isLive` em live location.

### Backend .NET — `Program.cs`, `Models.cs`, serviços

| Arquivo | Mudança |
|---------|---------|
| `Models/Models.cs` | Estender `WebhookPayload`; campos em `Occurrence` |
| `Program.cs` | Ramo em `MapPost /api/triage`: se `payload.Latitude/Longitude` → `GeocodificarReversaAsync`; senão → `GeocodificarAsync` atual |
| `Program.cs` | Nova função estática `GeocodificarReversaAsync` usando `https://nominatim.openstreetmap.org/reverse` |
| `GeminiTriageService.cs` | Sem mudança obrigatória no parser; opcional enriquecer prompt quando `TipoMensagem=location` |
| `EmergencyHub.cs` | Sem mudança de contrato |

**Lógica de precedência (obrigatória):**

```
SE payload.Latitude E payload.Longitude válidos:
    occurrence.Latitude/Longitude = payload
    (endereco, bairro, numero) = reversa Nominatim
    NÃO chamar GeocodificarAsync com endereço da IA para sobrescrever coords
SENÃO:
    fluxo atual (IA → GeocodificarAsync)
```

### Painel React — `painelAlertaAI/`

| Arquivo | Mudança |
|---------|---------|
| `src/services/api.js` | `mapearOcorrencia`: incluir `numero`, compor `localizacao` com número |
| `src/components/MapCard.jsx` | Adicionar `<Popup>` nos markers de `chamados` (hoje só mock tem Popup, L207–213); `eventHandlers.click` ou botão “Ver detalhes” |
| `src/App.jsx` | Estado `chamadoSelecionado` opcional para abrir modal ao clicar no pin |
| `src/components/ChamadoModal.jsx` | Exibir número e link externo “Abrir no mapa” (`https://www.openstreetmap.org/?mlat=…`) |
| `src/pages/ChamadosPage.jsx` | Reutilizar mesmo handler de seleção se mapa for compartilhado depois |

---

## Geocodificação reversa (Nominatim)

### Situação atual

- **Forward** em `Program.cs` → `GeocodificarAsync` (search API), sufixo `Recife, PE`, falha silenciosa `(null, null)`.
- **Painel** `MapCard.jsx` (L70–76) usa search Nominatim **no browser** para busca manual — sem `User-Agent` dedicado (risco em produção; fora do MVP desta spec, mas documentar).

### Política proposta (backend)

| Item | Decisão |
|------|---------|
| Endpoint | `GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1&accept-language=pt-BR` |
| Cliente | `IHttpClientFactory` cliente `"Nominatim"` existente |
| Mapeamento | `road` + `house_number` → `Endereco`/`Numero`; `suburb` \|\| `neighbourhood` \|\| `quarter` → `Bairro` |
| Fallback 1 | Se sem `road`, usar trecho curto de `display_name` (máx. 120 chars) em `Endereco` |
| Fallback 2 | Se API falhar: manter coords; `Endereco`/`Bairro` null; painel mostra “Localização não informada” |
| Conflito IA vs GPS | Endereço da IA **não** substitui coords; pode preencher texto de resumo apenas |
| `locationMessage.address` do WA | Ignorar para persistência (pode ser nome de lugar genérico); usar só como hint em log |
| Rate limit | Uma reversa por ocorrência; evitar chamada forward na mesma request se já houver GPS |
| Cache (opcional fase 2) | Memória LRU por coordenadas arredondadas (5 casas) para repetidos na PoC |

### Exemplo resposta Nominatim (referência implementação)

```json
{
  "display_name": "123, Avenida Conde da Boa Vista, Boa Vista, Recife, Pernambuco, 50010-000, Brasil",
  "address": {
    "house_number": "123",
    "road": "Avenida Conde da Boa Vista",
    "suburb": "Boa Vista",
    "city": "Recife",
    "state": "Pernambuco"
  }
}
```

---

## Casos de borda e erros

| Cenário | Comportamento esperado |
|---------|------------------------|
| Localização sem texto | Triagem com placeholder; ocorrência criada com coords |
| Texto + localização na mesma mensagem | Enviar ambos; coords do WA têm precedência; Gemini usa texto |
| `degreesLatitude` / `Longitude` ausentes ou 0,0 | Tratar como inválido; log warning; fallback fluxo texto se houver |
| Mensagem de áudio/imagem sem texto nem GPS | Ignorar (igual hoje) |
| Nominatim 429/timeout | Salvar coords; endereço null; log erro |
| Endereço IA diverge do GPS | Exibir endereço **reverso** no painel; resumo IA mantém contexto textual |
| Replay de histórico no sync | Guard `lastConnectionTime` (L347–350) continua aplicável |
| Anti-loop `sentMessageIds` | Sem alteração |
| Live location atualizada várias vezes | MVP: cada upsert gera nova ocorrência **ou** deduplicar por `msg.key.id` (decisão implementação: **deduplicar por id** recomendado) |
| Coordenada fora de Recife | Ainda persistir; reversa pode retornar município vizinho; aceitável na PoC |
| JSON bridge com camelCase | ASP.NET model binding aceita ambos |

---

## Plano de implementação (fases)

| Fase | Entrega | Arquivos principais |
|------|---------|------------------------|
| **1** | `extractLocationFromMessage` + POST estendido; mensagem só-GPS não descartada | `whatsapp-bridge.js` |
| **2** | `WebhookPayload` + ramo GPS + `GeocodificarReversaAsync` + colunas DB | `Models.cs`, `Program.cs` |
| **3** | Placeholder Gemini / prompt contextual para só-GPS | `GeminiTriageService.cs` ou `Program.cs` |
| **4** | Painel: popup pin, link mapa, `numero` em `api.js` | `MapCard.jsx`, `api.js`, `ChamadoModal.jsx` |
| **5** | Resposta WhatsApp com endereço reverso; README “Testando” com pin | `whatsapp-bridge.js`, `README.md` |
| **6** | (Opcional) `origemLocalizacao`, dedupe `msg.key.id`, cache reversa | Vários |

Ordem obrigatória: **1 → 2 → 4** para demonstrar critérios de aceite; **3** pode paralelizar com 4.

---

## Plano de testes (manual)

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|-------------------|
| T1 | Pin estático | API + bridge + painel rodando; enviar localização no self-chat | Pin no mapa; endereço em português no modal |
| T2 | Só GPS, sem texto | Enviar apenas localização | Ocorrência criada; severidade/categoria da IA; coords corretas |
| T3 | Texto sem GPS | Mensagem “Alagamento Rua X, Boa Viagem” | Fluxo legado; geocode forward |
| T4 | Texto + GPS | Legenda + pin | Coords do pin; resumo menciona legenda |
| T5 | Clique no pin | Dashboard → clicar marcador laranja | Popup e abertura de detalhes |
| T6 | SignalR | Nova localização com painel aberto | Marcador aparece sem refresh |
| T7 | Nominatim off | Desconectar rede ou bloquear host | Coords salvas; texto “Localização não informada” |
| T8 | Histórico antigo | Reconectar após sync | Mensagens antigas ignoradas (guard timestamp) |
| T9 | GET /api/ocorrencias | Recarregar painel | Pins restaurados do SQLite |

---

## Riscos e dependências

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Política de uso Nominatim (1 req/s) | Bloqueio IP | Reversa única por ocorrência; User-Agent; evitar search no browser em produção |
| Gemini sem texto útil | Categoria “Outros” genérica | Placeholder + prompt específico RF-08 |
| Baileys muda estrutura protobuf | Extração falha | Testes T1/T2; log de chaves `Object.keys(msg.message)` em debug |
| Pins sem popup (UX) | CA-2 parcial hoje | Fase 4 obrigatória |
| `ChamadoModal` sem mapa | Operador não vê contexto espacial | Link OSM externo |
| Live location múltiplos eventos | Duplicata de ocorrências | Dedupe por `msg.key.id` |
| Dependência externa Gemini | Triagem falha | Fallback existente `TriageResult("Media", "Outros", …)` |

**Dependências:** Node bridge, .NET API, SQLite, Nominatim público, Gemini API, conta WhatsApp pareada.

---

## Definition of Done

- [ ] CA-1 a CA-3 verificados manualmente (T1–T9)
- [ ] Código nas três camadas (bridge, `Program.cs`/`Models.cs`, painel) revisado
- [ ] `WebhookPayload` documentado e alinhado entre bridge e C# (regra `whatsapp-bridge.mdc` atualizada)
- [ ] README raiz e `wppAlertaAi/README.md` com passo “enviar localização pelo WhatsApp”
- [ ] Sem commit de `.env`, `auth_info_baileys_*`, `*.db`
- [ ] Logs sem vazar coordenadas em nível `error` desnecessário (opcional mascarar em produção)

---

## Gap analysis (resumo)

| Critério | Existe hoje | Falta |
|----------|-------------|-------|
| **CA-1** Extrair lat/long do WhatsApp | Não — `extractMessageText` ignora `locationMessage` | `extractLocationFromMessage` + payload |
| **CA-2** Pin no painel clicável | Parcial — markers sem `Popup`/click em `MapCard.jsx` L207–213 | Interação + possibly modal wire |
| **CA-3** Reversa rua/bairro/número | Não — só `GeocodificarAsync` forward em `Program.cs` L118–142 | `GeocodificarReversaAsync` + campo `Numero` |

**Ativos reutilizáveis:** colunas `Latitude`/`Longitude` no SQLite; `mapearOcorrencia` + filtros de mapa; hub SignalR; cliente Nominatim registrado; fluxo self-chat e anti-loop.

---

## Referências de código (estado atual)

| Componente | Caminho | Observação |
|------------|---------|------------|
| Extração só texto | `wppAlertaAi/whatsapp-bridge.js` L74–120, L352–357 | Bloqueio de localização |
| POST triagem | `wppAlertaAi/whatsapp-bridge.js` L364–371 | Payload mínimo |
| Triagem + geocode forward | `wppAlertaAi/Program.cs` L63–102, L118–142 | Sem reversa |
| Modelos | `wppAlertaAi/Models/Models.cs` L3, L22–37 | `WebhookPayload` sem GPS |
| Mapeamento UI | `painelAlertaAI/src/services/api.js` L28–51 | `localizacao` textual |
| Mapa ocorrências | `painelAlertaAI/src/components/MapCard.jsx` L207–213 | Sem popup em chamados |
| SignalR | `painelAlertaAI/src/App.jsx` L29–31 | `NewOccurrence` OK |

---

*Documento gerado para Spec Driven Development — implementação deliberadamente fora deste entregável.*
