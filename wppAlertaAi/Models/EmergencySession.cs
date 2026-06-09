namespace AlertAi.Models;

public static class SessionStatus
{
    public const string Coletando = "coletando";
    public const string Concluida = "concluida";
}

public class EmergencySession
{
    public int Id { get; set; }
    public string Telefone { get; set; } = string.Empty;
    public string Status { get; set; } = SessionStatus.Coletando;
    /// <summary>JSON: lista de { "papel": "cidadao"|"sistema", "texto": "..." }</summary>
    public string HistoricoJson { get; set; } = "[]";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? EnderecoResumo { get; set; }
    public string? OrigemLocalizacao { get; set; }
    public int TentativasEsclarecimento { get; set; }
    public string MediaUrlsJson { get; set; } = "[]";
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}

public record ChatMessagePayload(
    string TelefoneRemetente,
    string MensagemTexto,
    string? IdMensagemWhatsapp = null,
    double? Latitude = null,
    double? Longitude = null,
    string? TipoMensagem = null,
    string? NomeLocalWhatsapp = null,
    string? EnderecoWhatsapp = null,
    string? MediaUrl = null);

public record ChatMessageResponse(
    string RespostaBot,
    bool RegistrouOcorrencia,
    bool Duplicate = false,
    int? OccurrenceId = null,
    TriageResult? Data = null,
    string? OrientacoesCidadao = null);
