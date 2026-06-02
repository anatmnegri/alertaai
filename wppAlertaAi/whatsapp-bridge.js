const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const pino = require('pino');
const QRCode = require('qrcode-terminal');

// ===== CONFIGURAÇÃO =====
const API_URL = process.env.API_URL || 'http://localhost:5019/api/triage';
const YOUR_PHONE = '5581999046994';
const SELF_CHAT_JID = `${YOUR_PHONE}@s.whatsapp.net`;
const AUTH_DIR = `auth_info_baileys_${YOUR_PHONE}`;

// ===== ESTADO GLOBAL =====
const sentMessageIds = new Set();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let connectionReady = false;
let syncStarted = false;
let lastConnectionTime = 0;
const RECONNECT_COOLDOWN = 5000; // 5s entre reconexões

// ===== LOGGER =====
const logger = pino(
    { level: process.env.LOG_LEVEL || 'info' },
    pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, singleLine: false }
    })
);

// ===== HELPER FUNCTIONS =====
function isSelfChat(remoteJid) {
    if (!remoteJid) {
        return false;
    }

    if (remoteJid === SELF_CHAT_JID) {
        return true;
    }

    if (remoteJid === `${YOUR_PHONE}@lid`) {
        return true;
    }

    return remoteJid.startsWith(`${YOUR_PHONE}@`);
}

function isTargetSelfMessage(msg) {
    const remoteJid = msg?.key?.remoteJid;

    if (!remoteJid) {
        return false;
    }

    if (isSelfChat(remoteJid)) {
        return true;
    }

    // Em contas vinculadas, o self-chat pode chegar como @lid com fromMe=true.
    return Boolean(msg?.key?.fromMe && remoteJid.endsWith('@lid'));
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt) {
    // Backoff: 2s, 4s, 8s, 16s, 30s max
    return Math.min(2000 * Math.pow(2, attempt), 30000);
}

function extractMessageText(message) {
    if (!message) {
        return null;
    }

    if (message.conversation) {
        return message.conversation;
    }

    if (message.extendedTextMessage?.text) {
        return message.extendedTextMessage.text;
    }

    if (message.imageMessage?.caption) {
        return message.imageMessage.caption;
    }

    if (message.videoMessage?.caption) {
        return message.videoMessage.caption;
    }

    if (message.documentMessage?.caption) {
        return message.documentMessage.caption;
    }

    if (message.ephemeralMessage?.message) {
        return extractMessageText(message.ephemeralMessage.message);
    }

    if (message.viewOnceMessage?.message) {
        return extractMessageText(message.viewOnceMessage.message);
    }

    if (message.buttonsResponseMessage?.selectedButtonId) {
        return message.buttonsResponseMessage.selectedButtonId;
    }

    if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return message.listResponseMessage.singleSelectReply.selectedRowId;
    }

    if (message.templateButtonReplyMessage?.selectedId) {
        return message.templateButtonReplyMessage.selectedId;
    }

    return null;
}

// ===== MAIN CONNECTION FUNCTION =====
async function connectToWhatsApp() {
    let sock = null;
    
    try {
        logger.info('Carregando estado de autenticação...');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        
        logger.info('Buscando versão mais recente do WhatsApp...');
        const { version } = await fetchLatestBaileysVersion();

        logger.info(`\n--- INICIANDO CONEXÃO (Versão WA: ${version.join('.')}) ---`);
        logger.info(`🚀 AlertAi configurado para ouvir apenas o chat ${SELF_CHAT_JID}\n`);

        // ===== SOCKET CONFIGURATION =====
        sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            
            // Timeouts mais altos para dar tempo de sincronização
            connectTimeoutMs: 180000,        // 3 minutos para conectar
            defaultQueryTimeoutMs: 60000,    // 1 minuto para queries
            keepAliveIntervalMs: 30000,      // 30s health check
            
            // Logger do Baileys com nível detalhado durante debug
            logger: pino({ level: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'error' }),
            
            // Não usar opções que interferem em sincronização
            markOnlineAfterLogin: true,
            browser: ['Windows', 'Chrome', '11.0.0']
        });

        // ===== PAIRING CODE HANDLER =====
        if (!state.creds.registered) {
            logger.info('\n--- CONFIGURAÇÃO DO WHATSAPP ---');
            logger.info('📱 Escaneie o código QR com seu WhatsApp:');
            logger.info('   Aparelhos Conectados → Conectar um aparelho → Conectar com número de telefone');
            logger.info('   Use a câmera para escanear o código QR que aparecerá abaixo...\n');
            
            syncStarted = true;
        }

        // ===== CONNECTION UPDATES =====
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // ===== QR CODE DISPLAY =====
            if (qr) {
                logger.info('\n');
                logger.info('█████████████████████████████████████████████████████████');
                logger.info('📱 CÓDIGO QR GERADO - Escaneie com seu WhatsApp:');
                logger.info('█████████████████████████████████████████████████████████\n');
                
                // Gerar QR code visual em ASCII
                QRCode.generate(qr, { small: true }, (qrString) => {
                    console.log(qrString);
                });
                
                logger.info('\nPasso a passo:');
                logger.info('1. Abra WhatsApp no seu celular');
                logger.info('2. Toque em "Aparelhos Conectados"');
                logger.info('3. Clique em "Conectar um aparelho"');
                logger.info('4. Aponte a câmera para o QR code acima');
                logger.info('5. AGUARDE 30-40 segundos para sincronizar\n');
            }

            logger.debug(`[connection.update] connection=${connection}, lastDisconnect=${lastDisconnect?.error?.message}`);

            if (connection === 'connecting') {
                logger.info('⏳ Conectando ao WhatsApp...');
            }

            if (connection === 'open') {
                logger.info('🚀 AlertAi: WHATSAPP CONECTADO!');
                logger.info('✅ Pode mandar mensagem no seu chat pessoal agora.\n');
                connectionReady = true;
                reconnectAttempts = 0;
                lastConnectionTime = Date.now();
                return;
            }

            if (connection === 'close') {
                connectionReady = false;
                const error = lastDisconnect?.error;
                const statusCode = error instanceof Boom ? error.output.statusCode : 0;

                logger.error(`❌ Conexão fechada. Status: ${statusCode}. Erro: ${error?.message}`);

                // Status 515 = restart required (normal pós-pairing com QR)
                // Não trata como fatal — só reconecta
                if (statusCode === 515) {
                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        const timeSinceLastConnection = Date.now() - lastConnectionTime;
                        const waitTime = Math.max(
                            RECONNECT_COOLDOWN,
                            getBackoffDelay(reconnectAttempts) - timeSinceLastConnection
                        );
                        
                        logger.info(`⏳ Tentando reconectar (515)... (tentativa ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}) em ${Math.max(0, waitTime)}ms`);
                        reconnectAttempts++;
                        
                        if (sock) {
                            try { 
                                sock.end(); 
                                logger.debug('[CLEANUP] Socket anterior encerrado');
                            } catch (e) { 
                                logger.debug(`[CLEANUP] Erro ao encerrar socket: ${e.message}`);
                            }
                        }
                        
                        await delay(Math.max(0, waitTime));
                        return connectToWhatsApp();
                    } else {
                        logger.error('❌ Máximo de tentativas de reconexão (515) atingido. Abortando.');
                        if (sock) {
                            try { sock.end(); } catch (e) { }
                        }
                        return process.exit(1);
                    }
                }

                // Status 401 = authentication failure
                if (statusCode === 401) {
                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        const waitTime = getBackoffDelay(reconnectAttempts);
                        logger.info(`⏳ Tentando reconectar (401)... (tentativa ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}) em ${waitTime}ms`);
                        reconnectAttempts++;
                        
                        if (sock) {
                            try { sock.end(); } catch (e) { }
                        }
                        
                        await delay(waitTime);
                        return connectToWhatsApp();
                    } else {
                        logger.error('❌ Máximo de tentativas (401). Sessão expirada.');
                        if (sock) {
                            try { sock.end(); } catch (e) { }
                        }
                        return process.exit(1);
                    }
                }

                // Status fatal: logout ou sessão conflitante
                if (statusCode === DisconnectReason.loggedOut || statusCode === 440) {
                    logger.error('❌ Sessão encerrada ou conflitante. Execute:');
                    logger.error(`   Remove-Item -Recurse -Force ${AUTH_DIR}`);
                    logger.error('   npm start');
                    if (sock) {
                        try { sock.end(); } catch (e) { }
                    }
                    return process.exit(1);
                }

                // Outros erros
                logger.error('❌ Erro de conexão. Abortando.');
                if (sock) {
                    try { sock.end(); } catch (e) { }
                }
                return process.exit(1);
            }
        });

        // ===== CREDENTIALS UPDATE =====
        sock.ev.on('creds.update', async () => {
            logger.debug('Credenciais atualizadas, salvando...');
            await saveCreds();
        });

        // ===== SYNC / ACCOUNT SETTING (Sincronização completa) =====
        sock.ev.on('account.setting', () => {
            logger.debug('[SYNC] Account settings recebido - WhatsApp sincronizando');
        });

        sock.ev.on('groups.upsert', () => {
            logger.debug('[SYNC] Groups atualizado - WhatsApp sincronizando');
        });

        sock.ev.on('contacts.set', () => {
            logger.debug('[SYNC] Contacts atualizado');
        });

        sock.ev.on('chats.set', ({ chats }) => {
            logger.debug(`[SYNC] Chats set: ${chats.length} chats`);
        });

        // ===== MESSAGE HANDLER =====
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            logger.debug(`[messages.upsert] type=${type}, count=${messages.length}`);

            // Ignorar eventos durante pairing/sincronização
            if (!connectionReady) {
                logger.debug('⏸️  Ignorando mensagens durante pairing/sincronização');
                return;
            }

            for (const msg of messages) {
                try {
                    // Validações básicas
                    if (!msg.message || !msg.key?.remoteJid) {
                        logger.debug('Mensagem inválida ou sem conteúdo');
                        continue;
                    }

                    // Guard: Ignorar próprias respostas do bot
                    if (msg.key.id && sentMessageIds.has(msg.key.id)) {
                        logger.debug(`Reply guard: Ignorando mensagem própria ${msg.key.id}`);
                        sentMessageIds.delete(msg.key.id);
                        continue;
                    }

                    const remoteJid = msg.key.remoteJid;

                    // Filtro: Only self-chat
                    if (!isTargetSelfMessage(msg)) {
                        logger.debug(`Ignorando mensagem de outro chat: ${remoteJid}`);
                        continue;
                    }

                    if (!isSelfChat(remoteJid)) {
                        logger.debug(`Self-chat via @lid identificado: ${remoteJid}`);
                    }

                    // Ignorar replay de histórico: só processar mensagens geradas depois da conexão ficar online.
                    if (lastConnectionTime && msg.messageTimestamp && (msg.messageTimestamp * 1000) < (lastConnectionTime - 10000)) {
                        logger.debug(`Ignorando mensagem antiga do sync: ${remoteJid} @ ${msg.messageTimestamp}`);
                        continue;
                    }

                    // Extrair texto
                    const text = extractMessageText(msg.message);
                    if (!text) {
                        logger.debug(`Sem texto na mensagem (chaves: ${Object.keys(msg.message).join(', ')})`);
                        continue;
                    }

                    // ===== PROCESSAR MENSAGEM =====
                    logger.info(`📩 Processando: "${text}"`);

                    try {
                        // Call C# API
                        const response = await axios.post(
                            API_URL,
                            {
                                TelefoneRemetente: YOUR_PHONE,
                                MensagemTexto: text
                            },
                            { timeout: 30000 } // 30s timeout
                        );

                        const triage = response.data?.data;
                        if (!triage) {
                            logger.error('❌ Resposta da API sem dados de triage');
                            continue;
                        }

                        logger.info(`✅ Triage: ${triage.categoria} (${triage.severidade})`);

                        // ===== ENVIAR RESPOSTA =====
                        const localizacao = [triage.endereco, triage.bairro].filter(Boolean).join(', ') || 'Não identificada'
                        const sentMessage = await sock.sendMessage(remoteJid, {
                            text:
                                `🚨 *AlertAi: Ocorrência Registrada!*\n\n` +
                                `Sua mensagem foi triada pela IA e já está no painel.\n\n` +
                                `*Categoria:* ${triage.categoria}\n` +
                                `*Severidade:* ${triage.severidade}\n` +
                                `*Localização:* ${localizacao}\n` +
                                `*Resumo:* ${triage.resumo}\n` +
                                `*Ação:* ${triage.acao_recomendada}`
                        });

                        if (sentMessage?.key?.id) {
                            sentMessageIds.add(sentMessage.key.id);
                            logger.debug(`Mensagem enviada, ID guardado: ${sentMessage.key.id}`);
                        }
                    } catch (error) {
                        logger.error(`❌ Erro na API C# ou envio: ${error.message}`);
                        if (error.response) {
                            logger.error(`   Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
                        }
                    }
                } catch (error) {
                    logger.error(`❌ Erro ao processar mensagem: ${error.message}`);
                }
            }
        });

        logger.info('✅ Event handlers registrados. Aguardando eventos...\n');

    } catch (error) {
        logger.error(`❌ Erro Fatal: ${error.message}`);
        if (sock) {
            try { sock.end(); } catch (e) { }
        }
        process.exit(1);
    }
}

// ===== START =====
logger.info('\n╔════════════════════════════════════════╗');
logger.info('║        AlertAi WhatsApp Bridge        ║');
logger.info('║       (Versão com Sync Robusto)       ║');
logger.info('╚════════════════════════════════════════╝\n');

connectToWhatsApp().catch(err => {
    logger.error(`Erro Fatal: ${err.message}`);
    process.exit(1);
});
