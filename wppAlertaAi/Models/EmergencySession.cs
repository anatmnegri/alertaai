namespace AlertAi.Models;

public static class SessionStatus
{
    public const string Novo = "novo";
    public const string AguardandoDescricao = "aguardando_descricao";
    public const string AguardandoLocalizacao = "aguardando_localizacao";
    public const string AguardandoMidia = "aguardando_midia";
    public const string Concluida = "concluida";
}

public class EmergencySession
{
    public int Id { get; set; }
    public string Telefone { get; set; } = string.Empty;
    public string NomeContatoWhatsapp { get; set; } = "Desconhecido";
    public string Status { get; set; } = SessionStatus.Novo;
    public string PassoAtual { get; set; } = SessionStatus.Novo;
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
    string? NomeContatoWhatsapp = null,
    string? MediaUrl = null,
    string? AudioUrl = null);

public record ChatMessageResponse(
    string RespostaBot,
    bool RegistrouOcorrencia,
    bool Duplicate = false,
    int? OccurrenceId = null,
    TriageResult? Data = null,
    string? OrientacoesCidadao = null);
