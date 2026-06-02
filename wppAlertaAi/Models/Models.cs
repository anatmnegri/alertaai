namespace AlertAi.Models;

public record WebhookPayload(string TelefoneRemetente, string MensagemTexto);

// --- DTOs para Evolution API (WhatsApp) ---
public record EvolutionWebhookPayload(string Event, string Instance, EvolutionMessageData? Data);
public record EvolutionMessageData(EvolutionMessageKey Key, string PushName, EvolutionMessageContent Message, string MessageType);
public record EvolutionMessageKey(string RemoteJid, bool FromMe, string Id);
public record EvolutionMessageContent(string? Conversation, ExtendedTextMessage? ExtendedTextMessage);
public record ExtendedTextMessage(string Text);
// ------------------------------------------

public record TriageResult(
    string severidade,
    string categoria,
    string resumo,
    string acao_recomendada,
    string? endereco = null,
    string? bairro = null
);

public class Occurrence
{
    public int Id { get; set; }
    public string Telefone { get; set; } = string.Empty;
    public string MensagemOriginal { get; set; } = string.Empty;
    public string Severidade { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;
    public string Resumo { get; set; } = string.Empty;
    public string AcaoRecomendada { get; set; } = string.Empty;
    public string? Endereco { get; set; }
    public string? Bairro { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime DataOcorrencia { get; set; } = DateTime.UtcNow;
    public bool Aberto { get; set; } = true;
}
