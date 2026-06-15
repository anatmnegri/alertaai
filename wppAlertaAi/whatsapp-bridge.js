require('dotenv').config();
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const pino = require('pino');
const QRCode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { extractMessageText, extractLocationFromMessage, hasMedia, hasAudio, extractAudioInfo, unwrapMessage } = require('./bridge/message-parsers');

// ===== CONFIGURAÇÃO =====
const API_URL = process.env.API_URL || 'http://localhost:5019/api/chat';
const YOUR_PHONE = process.env.YOUR_PHONE || '';
const SELF_CHAT_JID = `${YOUR_PHONE}@s.whatsapp.net`;
const AUTH_DIR = `auth_info_baileys_${YOUR_PHONE}`;
const MEDIA_DIR = path.join(__dirname, 'wwwroot', 'media');

if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// ===== ESTADO GLOBAL =====
const sentMessageIds = new Set();
const processedIncomingIds = new Set();
const MAX_PROCESSED_IDS = 500;
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

// ===== MAIN CONNECTION FUNCTION =====
async function connectToWhatsApp() {
    let sock = null;
    
    try {
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.default;
        const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = baileys;

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

            // Baileys reenvia o mesmo evento em "append"/"notify"; só processar mensagens novas
            if (type !== 'notify') {
                logger.debug(`Ignorando messages.upsert type=${type}`);
                return;
            }

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

                    const messageId = msg.key?.id;
                    if (messageId) {
                        if (processedIncomingIds.has(messageId)) {
                            logger.debug(`Dedup bridge: mensagem já processada ${messageId}`);
                            continue;
                        }
                        processedIncomingIds.add(messageId);
                        if (processedIncomingIds.size > MAX_PROCESSED_IDS) {
                            const oldest = processedIncomingIds.values().next().value;
                            processedIncomingIds.delete(oldest);
                        }
                    }

                    // Ignorar replay de histórico: só processar mensagens geradas depois da conexão ficar online.
                    if (lastConnectionTime && msg.messageTimestamp && (msg.messageTimestamp * 1000) < (lastConnectionTime - 10000)) {
                        logger.debug(`Ignorando mensagem antiga do sync: ${remoteJid} @ ${msg.messageTimestamp}`);
                        continue;
                    }

                    const text = extractMessageText(msg.message);
                    const location = extractLocationFromMessage(msg.message);
                    const isMedia = hasMedia(msg.message);
                    const isAudio = hasAudio(msg.message);

                    if (!text && !location && !isMedia && !isAudio) {
                        logger.debug(`Sem texto, localização, mídia nem áudio (chaves: ${Object.keys(msg.message).join(', ')})`);
                        continue;
                    }

                    let mediaUrl = null;
                    if (isMedia) {
                        try {
                            const buffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                { },
                                { logger, reuploadRequest: sock.updateMediaMessage }
                            );
                            
                            const innerMsg = unwrapMessage(msg.message);
                            const extension = innerMsg.imageMessage ? 'jpg' : (innerMsg.videoMessage ? 'mp4' : (innerMsg.audioMessage ? 'ogg' : 'bin'));
                            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                            const filePath = path.join(MEDIA_DIR, fileName);
                            
                            fs.writeFileSync(filePath, buffer);
                            mediaUrl = `/media/${fileName}`;
                            logger.info(`📸 Mídia salva: ${mediaUrl}`);
                        } catch (mediaErr) {
                            logger.error(`❌ Erro ao baixar mídia: ${mediaErr.message}`);
                        }
                    }

                    let audioUrl = null;
                    if (isAudio) {
                        try {
                            const buffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                { },
                                { logger, reuploadRequest: sock.updateMediaMessage }
                            );

                            const audioInfo = extractAudioInfo(msg.message);
                            // PTT/ogg do WhatsApp → .ogg; outros → .mp3
                            const extension = (audioInfo?.mimetype ?? '').includes('ogg') ? 'ogg' : 'mp3';
                            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
                            const filePath = path.join(MEDIA_DIR, fileName);

                            fs.writeFileSync(filePath, buffer);
                            audioUrl = `/media/${fileName}`;
                            logger.info(`🎤 Áudio salvo: ${audioUrl} (${audioInfo?.isPtt ? 'PTT' : 'arquivo'})`);
                        } catch (audioErr) {
                            logger.error(`❌ Erro ao baixar áudio: ${audioErr.message}`);
                        }
                    }

                    const rotulo = location
                        ? `localização GPS (${location.tipo})${text ? ` + texto` : ''}`
                        : isAudio
                            ? `áudio (${audioUrl})${text ? ` + texto` : ''}`
                            : isMedia
                                ? `mídia (${mediaUrl})${text ? ` + texto` : ''}`
                                : `"${text}"`;
                    logger.info(`📩 Processando: ${rotulo}`);

                    const contactName = msg.pushName || "Desconhecido";

                    try {
                        const response = await axios.post(
                            API_URL,
                            {
                                TelefoneRemetente: YOUR_PHONE,
                                MensagemTexto: text ?? '',
                                IdMensagemWhatsapp: messageId ?? null,
                                Latitude: location?.latitude ?? null,
                                Longitude: location?.longitude ?? null,
                                TipoMensagem: location?.tipo ?? null,
                                NomeLocalWhatsapp: location?.nome ?? null,
                                EnderecoWhatsapp: location?.enderecoWhatsapp ?? null,
                                NomeContatoWhatsapp: contactName,
                                MediaUrl: mediaUrl,
                                AudioUrl: audioUrl
                            },
                            { timeout: 30000 }
                        );

                        const respostaBot = response.data?.respostaBot;
                        if (!respostaBot) {
                            logger.error('❌ Resposta da API sem respostaBot');
                            continue;
                        }

                        const duplicate = !!response.data?.duplicate;

                        if (response.data?.registrouOcorrencia || duplicate) {
                            const triage = response.data?.data;
                            logger.info(
                                triage
                                    ? `✅ Ocorrência registrada: ${triage.categoria} (${triage.severidade})${duplicate ? ' [deduplicada]' : ''}`
                                    : duplicate
                                        ? '✅ Ocorrência já registrada (deduplicada)'
                                        : '✅ Ocorrência registrada'
                            );
                        } else {
                            logger.info('💬 Coletando informações — aguardando próxima mensagem do cidadão');
                        }

                        const sentMessage = await sock.sendMessage(remoteJid, { text: respostaBot });

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
