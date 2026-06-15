using AlertAi.Data;
using AlertAi.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace AlertAi.Services;

public class EmergencyIntakeService : IEmergencyIntakeService
{
    public const int MaxTentativasEsclarecimento = 4;
    public static readonly TimeSpan TimeoutSessao = TimeSpan.FromMinutes(45);

    private readonly AppDbContext _db;
    private readonly IEmergencyIntakeAgent _intakeAgent;
    private readonly IOccurrenceRegistrationService _registrationService;
    private readonly IGeocodingService _geocodingService;
    private readonly IAudioTranscriptionService _audioTranscription;
    private readonly ILogger<EmergencyIntakeService> _logger;

    // Caminho físico raiz onde os arquivos de mídia são salvos (wwwroot)
    private readonly string _webRootPath;

    public EmergencyIntakeService(
        AppDbContext db,
        IEmergencyIntakeAgent intakeAgent,
        IOccurrenceRegistrationService registrationService,
        IGeocodingService geocodingService,
        IAudioTranscriptionService audioTranscription,
        IWebHostEnvironment env,
        ILogger<EmergencyIntakeService> logger)
    {
        _db = db;
        _intakeAgent = intakeAgent;
        _registrationService = registrationService;
        _geocodingService = geocodingService;
        _audioTranscription = audioTranscription;
        _webRootPath = env.WebRootPath;
        _logger = logger;
    }

    public async Task<ChatMessageResponse> ProcessarMensagemAsync(
        ChatMessagePayload payload,
        CancellationToken ct = default)
    {
        var telefone = payload.TelefoneRemetente;
        var sessao = await ObterOuCriarSessaoAsync(telefone, ct);

        // Atualiza nome do contato se fornecido e for diferente do padrão
        if (!string.IsNullOrWhiteSpace(payload.NomeContatoWhatsapp) && payload.NomeContatoWhatsapp != "Desconhecido")
            sessao.NomeContatoWhatsapp = payload.NomeContatoWhatsapp;

        var historico = ConversationHistory.Parse(sessao.HistoricoJson);
        var texto = payload.MensagemTexto?.Trim() ?? string.Empty;

        var audioPath = payload.AudioUrl;
        if (string.IsNullOrWhiteSpace(audioPath)
            && !string.IsNullOrWhiteSpace(payload.MediaUrl)
            && (payload.MediaUrl.EndsWith(".ogg", StringComparison.OrdinalIgnoreCase)
                || payload.MediaUrl.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase)
                || payload.MediaUrl.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase)
                || payload.MediaUrl.EndsWith(".wav", StringComparison.OrdinalIgnoreCase)))
        {
            audioPath = payload.MediaUrl;
        }

        if (!string.IsNullOrWhiteSpace(audioPath))
        {
            var webRoot = string.IsNullOrWhiteSpace(_webRootPath)
                ? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")
                : _webRootPath;
            var audioFilePath = Path.Combine(webRoot, audioPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            _logger.LogInformation("🎤 Áudio recebido, transcrevendo: {Path}", audioFilePath);

            var transcricao = await _audioTranscription.TranscreverAsync(audioFilePath, ct);

            if (!string.IsNullOrWhiteSpace(transcricao) &&
                !transcricao.Contains("[áudio sem conteúdo identificável]", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("🎤 Transcrição: \"{Texto}\"", transcricao);
                texto = string.IsNullOrWhiteSpace(texto)
                    ? transcricao
                    : $"{texto} {transcricao}";
            }
            else
            {
                _logger.LogWarning("🎤 Não foi possível transcrever o áudio ou conteúdo vazio.");
                if (string.IsNullOrWhiteSpace(texto))
                    texto = "(Áudio recebido — não foi possível transcrever)";
            }
        }

        if (!string.IsNullOrWhiteSpace(texto))
            ConversationHistory.AddCidadao(historico, texto);

        if (!string.IsNullOrWhiteSpace(payload.MediaUrl))
        {
            var mediaUrls = System.Text.Json.JsonSerializer.Deserialize<List<string>>(sessao.MediaUrlsJson) ?? new();
            if (mediaUrls.Count < 3)
            {
                mediaUrls.Add(payload.MediaUrl);
                sessao.MediaUrlsJson = System.Text.Json.JsonSerializer.Serialize(mediaUrls);
            }
        }

        await AtualizarLocalizacaoAsync(sessao, payload, ct);

        sessao.HistoricoJson = ConversationHistory.Serialize(historico);
        string respostaBot = "";
        bool finalizado = false;
        OccurrenceRegistrationResult? registro = null;

        switch (sessao.PassoAtual)
        {
            case SessionStatus.Novo:
                respostaBot = "Olá! Me chamo AlertaAI, sou o assistente da Defesa Civil. Por favor, descreva a ocorrência.";
                sessao.PassoAtual = SessionStatus.AguardandoDescricao;
                break;

            case SessionStatus.AguardandoDescricao:
                if (string.IsNullOrWhiteSpace(texto) && sessao.Latitude == null)
                {
                    respostaBot = "Por favor, descreva o que está acontecendo.";
                    break;
                }
                respostaBot = "Entendido. Agora, por favor, me envie a sua localização atual (pode ser o PIN do WhatsApp ou digitando o endereço).";
                sessao.PassoAtual = SessionStatus.AguardandoLocalizacao;
                break;

            case SessionStatus.AguardandoLocalizacao:
                if (sessao.Latitude == null && string.IsNullOrWhiteSpace(texto) && string.IsNullOrWhiteSpace(payload.MediaUrl))
                {
                    respostaBot = "Preciso que você envie a localização para continuar.";
                    break;
                }
                respostaBot = "Certo. Para finalizar, você pode me enviar fotos ou vídeos do local? Se não puder, basta responder 'não'.";
                sessao.PassoAtual = SessionStatus.AguardandoMidia;
                break;

            case SessionStatus.AguardandoMidia:
                // Finalizar o fluxo
                var narrativa = ConversationHistory.ConsolidarNarrativaCidadao(historico);
                if (string.IsNullOrWhiteSpace(narrativa)) narrativa = "Relato não detalhado pelo cidadão";

                var webhook = new WebhookPayload(
                    sessao.Telefone,
                    narrativa,
                    payload.IdMensagemWhatsapp,
                    sessao.Latitude,
                    sessao.Longitude,
                    sessao.OrigemLocalizacao == OrigemLocalizacao.WhatsAppGps ? "location" : null,
                    null,
                    null,
                    sessao.MediaUrlsJson,
                    sessao.NomeContatoWhatsapp);

                registro = await _registrationService.RegisterAsync(webhook, ct);
                
                sessao.Status = SessionStatus.Concluida;
                sessao.PassoAtual = SessionStatus.Concluida;
                respostaBot = MontarRespostaRegistro(registro);
                finalizado = true;
                break;
        }

        if (!finalizado)
        {
            ConversationHistory.AddSistema(historico, respostaBot);
            sessao.HistoricoJson = ConversationHistory.Serialize(historico);
        }

        sessao.AtualizadoEm = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (finalizado && registro != null)
        {
            return new ChatMessageResponse(
                respostaBot,
                !registro.IsDuplicate,
                registro.IsDuplicate,
                registro.Occurrence?.Id,
                registro.Triage,
                null);
        }

        return new ChatMessageResponse(respostaBot, false);
    }

    private static string MontarRespostaRegistro(OccurrenceRegistrationResult registro)
    {
        if (registro.IsDuplicate)
            return "Esta ocorrência já havia sido registrada. A Defesa Civil já possui seus dados.";

        var t = registro.Triage;
        var via = string.Join(", ", new[] { t.endereco, t.numero, t.bairro }.Where(s => !string.IsNullOrWhiteSpace(s)));
        var mun = t.cidade is not null && t.uf is not null ? $"{t.cidade} - {t.uf}" : t.cidade ?? t.uf;
        var local = string.Join(", ", new[] { via, mun }.Where(s => !string.IsNullOrWhiteSpace(s)));

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("🚨 *Ocorrência registrada no painel da Defesa Civil*");
        sb.AppendLine();
        sb.AppendLine($"*Tipo:* {t.categoria}");
        sb.AppendLine($"*Prioridade:* {t.severidade}");
        if (!string.IsNullOrWhiteSpace(local))
            sb.AppendLine($"*Local:* {local}");
        sb.AppendLine($"*Resumo:* {t.resumo}");
        sb.AppendLine();
        sb.AppendLine("Mantenha o celular por perto. Em risco imediato à vida, ligue *193* (Defesa Civil) ou *190*.");
        return sb.ToString().Trim();
    }

    private async Task AtualizarLocalizacaoAsync(
        EmergencySession sessao,
        ChatMessagePayload payload,
        CancellationToken ct)
    {
        if (!GeoCoordinates.TryValidate(payload.Latitude, payload.Longitude, out var lat, out var lng))
            return;

        sessao.Latitude = lat;
        sessao.Longitude = lng;
        sessao.OrigemLocalizacao = OrigemLocalizacao.WhatsAppGps;

        var geo = await _geocodingService.BuscarPorCoordenadasAsync(lat, lng, ct);
        sessao.EnderecoResumo = FormatarEnderecoResumo(geo);

        _logger.LogInformation("Sessão {Telefone}: localização GPS atualizada", sessao.Telefone);
    }

    private static string? FormatarEnderecoResumo(GeocodeEnriquecido geo)
    {
        var via = string.Join(", ", new[] { geo.Endereco, geo.Numero, geo.Bairro }.Where(s => !string.IsNullOrWhiteSpace(s)));
        var mun = geo.Cidade is not null && geo.Uf is not null ? $"{geo.Cidade} - {geo.Uf}" : geo.Cidade ?? geo.Uf;
        var partes = new[] { via, mun }.Where(s => !string.IsNullOrWhiteSpace(s));
        return partes.Any() ? string.Join(", ", partes) : null;
    }

    private async Task<EmergencySession> ObterOuCriarSessaoAsync(string telefone, CancellationToken ct)
    {
        var limite = DateTime.UtcNow - TimeoutSessao;

        var ativa = await _db.EmergencySessions
            .Where(s =>
                s.Telefone == telefone &&
                s.Status != SessionStatus.Concluida &&
                s.AtualizadoEm >= limite)
            .OrderByDescending(s => s.AtualizadoEm)
            .FirstOrDefaultAsync(ct);

        if (ativa is not null)
            return ativa;

        var nova = new EmergencySession
        {
            Telefone = telefone,
            Status = SessionStatus.Novo,
            PassoAtual = SessionStatus.Novo,
            HistoricoJson = "[]",
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        _db.EmergencySessions.Add(nova);
        await _db.SaveChangesAsync(ct);
        return nova;
    }
}
