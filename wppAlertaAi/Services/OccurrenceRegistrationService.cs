using AlertAi.Data;
using AlertAi.Models;
using Microsoft.EntityFrameworkCore;

namespace AlertAi.Services;

public class OccurrenceRegistrationService : IOccurrenceRegistrationService
{
    private readonly AppDbContext _db;
    private readonly IEmergencyTriageService _triageService;
    private readonly IGeocodingService _geocodingService;
    private readonly ILogger<OccurrenceRegistrationService> _logger;

    public OccurrenceRegistrationService(
        AppDbContext db,
        IEmergencyTriageService triageService,
        IGeocodingService geocodingService,
        ILogger<OccurrenceRegistrationService> logger)
    {
        _db = db;
        _triageService = triageService;
        _geocodingService = geocodingService;
        _logger = logger;
    }

    public async Task<OccurrenceRegistrationResult> RegisterAsync(
        WebhookPayload payload,
        CancellationToken ct = default)
    {
        var existente = await BuscarDuplicataAsync(payload, ct);
        if (existente is not null)
        {
            return new OccurrenceRegistrationResult(
                true,
                existente,
                ParaTriageResult(existente));
        }

        var temCoordenadasWhatsapp = GeoCoordinates.TryValidate(
            payload.Latitude,
            payload.Longitude,
            out var latWa,
            out var lngWa);

        var mensagem = payload.MensagemTexto?.Trim() ?? string.Empty;
        var somenteGps = temCoordenadasWhatsapp && string.IsNullOrWhiteSpace(mensagem);

        var textoTriagem = somenteGps
            ? MensagemTriagem.PlaceholderLocalizacaoWhatsapp
            : mensagem;

        var triage = await _triageService.TriageAsync(
            new TriageInput(textoTriagem, somenteGps),
            ct);

        GeocodeEnriquecido geo;
        string origem;

        if (temCoordenadasWhatsapp)
        {
            geo = await _geocodingService.BuscarPorCoordenadasAsync(latWa, lngWa, ct);
            origem = OrigemLocalizacao.WhatsAppGps;

            if (geo.Latitude is null || geo.Longitude is null)
                geo = geo with { Latitude = latWa, Longitude = lngWa };

            _logger.LogInformation(
                "Localização WhatsApp processada ({Tipo}): {Lat}, {Lng}",
                payload.TipoMensagem ?? "location",
                latWa,
                lngWa);
        }
        else
        {
            geo = await _geocodingService.BuscarPorEnderecoAsync(
                triage.endereco,
                triage.bairro,
                triage.cidade,
                triage.uf,
                ct);
            origem = OrigemLocalizacao.GeocodeTexto;
        }

        var endereco = geo.Endereco ?? triage.endereco;
        var bairro = geo.Bairro ?? triage.bairro;
        var cidade = geo.Cidade ?? triage.cidade;
        var uf = geo.Uf ?? triage.uf;
        var numero = geo.Numero;

        var mensagemOriginal = somenteGps
            ? MensagemTriagem.PlaceholderLocalizacaoWhatsapp
            : mensagem;

        var occurrence = new Occurrence
        {
            Telefone = payload.TelefoneRemetente,
            MensagemOriginal = mensagemOriginal,
            Severidade = triage.severidade,
            Categoria = triage.categoria,
            Resumo = triage.resumo,
            AcaoRecomendada = triage.acao_recomendada,
            Endereco = endereco,
            Bairro = bairro,
            Numero = numero,
            Cidade = cidade,
            Uf = uf,
            Latitude = geo.Latitude,
            Longitude = geo.Longitude,
            OrigemLocalizacao = origem,
            IdMensagemWhatsapp = payload.IdMensagemWhatsapp,
            MediaUrlsJson = payload.MediaUrlsJson ?? "[]",
            NomeContato = payload.NomeContatoWhatsapp ?? "Desconhecido",
            DataOcorrencia = DateTime.UtcNow
        };

        _db.Occurrences.Add(occurrence);
        await _db.SaveChangesAsync(ct);

        var triageResposta = triage with
        {
            endereco = endereco,
            bairro = bairro,
            cidade = cidade,
            uf = uf,
            numero = numero,
            origemLocalizacao = origem
        };

        return new OccurrenceRegistrationResult(false, occurrence, triageResposta);
    }

    private async Task<Occurrence?> BuscarDuplicataAsync(WebhookPayload payload, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(payload.IdMensagemWhatsapp))
        {
            var porId = await _db.Occurrences
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.IdMensagemWhatsapp == payload.IdMensagemWhatsapp, ct);

            if (porId is not null)
                return porId;
        }

        if (string.IsNullOrWhiteSpace(payload.MensagemTexto))
            return null;

        var janela = DateTime.UtcNow.AddMinutes(-2);
        return await _db.Occurrences
            .AsNoTracking()
            .Where(o =>
                o.Telefone == payload.TelefoneRemetente &&
                o.MensagemOriginal == payload.MensagemTexto &&
                o.DataOcorrencia >= janela)
            .OrderByDescending(o => o.DataOcorrencia)
            .FirstOrDefaultAsync(ct);
    }

    private static TriageResult ParaTriageResult(Occurrence o) =>
        new(
            o.Severidade,
            o.Categoria,
            o.Resumo,
            o.AcaoRecomendada,
            o.Endereco,
            o.Bairro,
            o.Cidade,
            o.Uf,
            o.Numero,
            o.OrigemLocalizacao);
}
