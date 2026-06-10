namespace AlertAi.Models;

public record WebhookPayload(
    string TelefoneRemetente,
    string MensagemTexto,
    string? IdMensagemWhatsapp = null,
    double? Latitude = null,
    double? Longitude = null,
    string? TipoMensagem = null,
    string? NomeLocalWhatsapp = null,
    string? EnderecoWhatsapp = null,
    string? MediaUrlsJson = null,
    string? NomeContatoWhatsapp = null);

// --- DTOs para Evolution API (WhatsApp) ---
public record EvolutionWebhookPayload(string Event, string Instance, EvolutionMessageData? Data);
public record EvolutionMessageData(EvolutionMessageKey Key, string PushName, EvolutionMessageContent Message, string MessageType);
public record EvolutionMessageKey(string RemoteJid, bool FromMe, string Id);
public record EvolutionMessageContent(string? Conversation, ExtendedTextMessage? ExtendedTextMessage);
public record ExtendedTextMessage(string Text);
// ------------------------------------------

/// <summary>Categorias canônicas retornadas pela triagem (Gemini + normalização).</summary>
public static class CategoriasDesastre
{
    public const string Deslizamento = "Deslizamento";
    public const string Enchente = "Enchente";
    public const string Incendio = "Incendio";
    public const string Acidente = "Acidente";
    public const string Terremoto = "Terremoto";
    public const string Tremor = "Tremor";
    public const string Tempestade = "Tempestade";
    public const string Outros = "Outros";

    public static readonly string[] Todas =
    [
        Deslizamento, Enchente, Incendio, Acidente,
        Terremoto, Tremor, Tempestade, Outros
    ];
}

public record GeocodeEnriquecido(
    double? Latitude,
    double? Longitude,
    string? Endereco,
    string? Bairro,
    string? Numero,
    string? Cidade,
    string? Uf);

public record TriageResult(
    string severidade,
    string categoria,
    string resumo,
    string acao_recomendada,
    string? endereco = null,
    string? bairro = null,
    string? cidade = null,
    string? uf = null,
    string? numero = null,
    string? origemLocalizacao = null
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
    public string NomeContato { get; set; } = "Desconhecido";
    public string? Endereco { get; set; }
    public string? Bairro { get; set; }
    public string? Numero { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }
    public string? OrigemLocalizacao { get; set; }
    public string? IdMensagemWhatsapp { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string MediaUrlsJson { get; set; } = "[]";
    public DateTime DataOcorrencia { get; set; } = DateTime.UtcNow;
    public bool Aberto { get; set; } = true;
}
