# Guia de Recomendações de Teste - AlertAI

Este documento contém recomendações e cenários de testes sugeridos para pessoas que irão avaliar e validar o funcionamento do **AlertAI**, desde o envio da mensagem via WhatsApp até a exibição no painel de controle.

---

## 1. Preparação para o Teste

Antes de iniciar os testes, certifique-se de que:
- O ambiente completo está rodando (Backend `.NET`, WhatsApp Bridge `Node.js` e Frontend `React`).
- O seu número de WhatsApp (ou do testador) está configurado e autorizado (se aplicável nas regras da bridge) para interagir com o sistema.
- O painel web está aberto e acessível (ex: `http://localhost:5173`).

---

## 2. Cenários de Teste End-to-End (E2E)

### 2.1. Fluxo Principal (Happy Path)
- **Ação:** Envie uma mensagem clara relatando uma emergência grave, incluindo o tipo de evento e endereço.
  - *Exemplo:* "Tem um deslizamento de barreira acontecendo agora na Rua Dois de Fevereiro, no Ibura. Tem casas em risco."
- **Resultado Esperado:** 
  1. A bridge (Node.js) deve capturar a mensagem.
  2. A IA (Gemini) deve classificar a ocorrência corretamente (Categoria: Deslizamento, Severidade: Alta, Endereço: Rua Dois de Fevereiro, Ibura).
  3. O painel deve ser atualizado instantaneamente (sem necessidade de F5) exibindo o novo card.
  4. O mapa deve exibir um marcador na localização aproximada da rua.

### 2.2. Teste de Variação de Severidade
Testar a capacidade da IA de distinguir a gravidade das ocorrências.
- **Severidade Alta:** "Acidente grave com vítimas presas nas ferragens na Av. Agamenon Magalhães."
- **Severidade Média:** "Queda de árvore bloqueando metade da via na Rua das Pernambucanas, Graças."
- **Severidade Baixa:** "Tem um buraco grande na Rua da Aurora que está atrapalhando os carros."
- **Resultado Esperado:** Os cards no painel devem refletir as cores e níveis de severidade adequados (ex: Vermelho/Crítico, Amarelo/Atenção, Verde/Baixo).

### 2.3. Teste de Endereços Incompletos e Ambíguos
- **Ação:** Enviar mensagens com informações geográficas faltantes.
  - *Exemplo 1:* "Alagamento muito forte aqui na minha rua." (Sem endereço)
  - *Exemplo 2:* "Avenida principal de Boa Viagem toda alagada." (Endereço genérico)
- **Resultado Esperado:** Avaliar como a IA extrai a entidade de endereço. Se estiver ausente, o sistema deve tratar de forma graciosa (ex: não quebrar o mapa, talvez colocar a ocorrência em uma lista de 'Endereço Pendente').

### 2.4. Testes de Ruído e Spam (Edge Cases)
- **Ação:** Enviar mensagens que não são emergências.
  - *Mensagem casual:* "Olá, bom dia!"
  - *Spam/Trote:* "Quero pedir uma pizza de calabresa para a Rua X."
  - *Informativo genérico:* "Vai chover hoje em Recife?"
- **Resultado Esperado:** A IA deve ser capaz de ignorar essas mensagens ou classificá-las em uma categoria como `Invalido`, `Outros` ou `Nao_Emergencia`, e de preferência, não poluir o mapa principal de alertas da Defesa Civil.

### 2.5. Testes de Múltiplas Mensagens e Deduplicação
- **Ação:** Enviar a mesma mensagem repetidas vezes em um curto espaço de tempo (menos de 2 minutos).
- **Resultado Esperado:** O backend do C# possui uma trava de **deduplicação (janela de 2 minutos)**. O sistema deve registrar apenas a primeira ocorrência no painel e marcar as requisições subsequentes como duplicatas, evitando poluir o mapa.

### 2.6. Teste de Suporte a Mídias (Imagens/Vídeos e Áudios)
- **Ação:** Envie um áudio explicando a situação. Envie uma foto ou vídeo mostrando uma emergência (com ou sem legenda).
- **Resultado Esperado:** A bridge (Node.js) já está programada para fazer o **download automático da mídia**, salvando no diretório `wwwroot/media`. O card no painel deve ser capaz de exibir a transcrição e o anexo (ou o link da mídia) relacionado à ocorrência, enriquecendo o alerta.

### 2.7. Formatos de Mensagem Não Suportados
- **Ação:** Enviar figurinhas.
- **Resultado Esperado:** Verificar o comportamento do sistema. Atualmente, o ideal é que a bridge ignore graciosamente ou retorne uma mensagem de erro ("No momento não processamos esse formato de texto"). O sistema não pode falhar ou fechar.

---

## 3. Validações do Painel de Controle (Frontend)


1. **Atualização em Tempo Real (SignalR):** Deixe o painel aberto e envie mensagens. A tela DEVE atualizar sozinha.
2. **Geocodificação (Leaflet):** Verifique se o endereço enviado através da funcionalidade "localização" do whatsapp está correto quando enviado para o painel.
3. **Filtros e Responsividade:** Se o painel possuir filtros (por severidade, data ou categoria), teste-os. 

---

## 4. Como Reportar Bugs ou Melhorias

Ao encontrar um problema, o testador deve registrar:
1. **Mensagem exata** enviada no WhatsApp.
2. **Comportamento Obtido** vs **Comportamento Esperado** (ex: "Foi classificado como severidade baixa, mas deveria ser alta").
3. O **horário do teste** (para facilitar a busca nos logs do `.NET` e do `Node.js`).
4. Print (captura de tela) do painel web.
