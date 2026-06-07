/**
 * Extrai conteúdo de mensagens WhatsApp (Baileys), incluindo wrappers ephemeral/viewOnce.
 */

function unwrapMessage(message) {
    if (!message) return null;

    if (message.ephemeralMessage?.message) {
        return unwrapMessage(message.ephemeralMessage.message);
    }

    if (message.viewOnceMessage?.message) {
        return unwrapMessage(message.viewOnceMessage.message);
    }

    return message;
}

function extractMessageText(message) {
    const inner = unwrapMessage(message);
    if (!inner) return null;

    if (inner.conversation) {
        return inner.conversation;
    }

    if (inner.extendedTextMessage?.text) {
        return inner.extendedTextMessage.text;
    }

    if (inner.imageMessage?.caption) {
        return inner.imageMessage.caption;
    }

    if (inner.videoMessage?.caption) {
        return inner.videoMessage.caption;
    }

    if (inner.documentMessage?.caption) {
        return inner.documentMessage.caption;
    }

    if (inner.buttonsResponseMessage?.selectedButtonId) {
        return inner.buttonsResponseMessage.selectedButtonId;
    }

    if (inner.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return inner.listResponseMessage.singleSelectReply.selectedRowId;
    }

    if (inner.templateButtonReplyMessage?.selectedId) {
        return inner.templateButtonReplyMessage.selectedId;
    }

    return null;
}

/**
 * @returns {{ latitude: number, longitude: number, tipo: string, nome?: string, enderecoWhatsapp?: string } | null}
 */
function extractLocationFromMessage(message) {
    const inner = unwrapMessage(message);
    if (!inner) return null;

    const locationBlock =
        inner.locationMessage ??
        inner.liveLocationMessage ??
        null;

    if (!locationBlock) return null;

    const lat = locationBlock.degreesLatitude;
    const lng = locationBlock.degreesLongitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
        return null;
    }

    const tipo = inner.liveLocationMessage ? 'live_location' : 'location';

    return {
        latitude: lat,
        longitude: lng,
        tipo,
        nome: locationBlock.name ?? undefined,
        enderecoWhatsapp: locationBlock.address ?? undefined
    };
}

module.exports = {
    extractMessageText,
    extractLocationFromMessage
};
