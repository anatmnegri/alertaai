using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using AlertAi.Configuration;
using AlertAi.Models;
using Microsoft.Extensions.Options;

namespace AlertAi.Services;

public class GeminiEmergencyIntakeAgent : IEmergencyIntakeAgent
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly string[] ModelosFallback = ["gemini-2.5-flash", "gemini-2.0-flash"];

    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _settings;
    private readonly ILogger<GeminiEmergencyIntakeAgent> _logger;

    public GeminiEmergencyIntakeAgent(
        HttpClient httpClient,
        IOptions<GeminiSettings> settings,
        ILogger<GeminiEmergencyIntakeAgent> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<IntakeAgentResult> AvaliarAsync(IntakeContext context, CancellationToken ct = default)
    {
        var prompt = MontarPrompt(context);

        foreach (var modelId in ObterModelos())
        {
            try
            {
                var raw = await ChamarGeminiAsync(modelId, prompt, ct);
                return ParseResultado(raw, context);
            }
            catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            {
                _logger.LogWarning("Modelo intake {ModelId} indisponível: {Msg}", modelId, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha no agente intake com {ModelId}", modelId);
            }
        }

        return FallbackHeuristico(context);
    }

    private IEnumerable<string> ObterModelos()
    {
        var preferido = string.IsNullOrWhiteSpace(_settings.ModelId)
            ? ModelosFallback[0]
            : _settings.ModelId.Trim();

        yield return preferido;
        foreach (var m in ModelosFallback)
        {
            if (!string.Equals(m, preferido, StringComparison.OrdinalIgnoreCase))
                yield return m;
        }
    }

    private static string MontarPrompt(IntakeContext ctx)
    {
        var historico = string.Join("\n", ctx.Historico.Select(h =>
            $"[{h.Papel}]: {h.Texto.Replace("\"", "'")}"));

        var forcar = ctx.ForcarRegistro
            ? "ATENÇÃO: limite de perguntas atingido. Registre AGORA com o que houver, use 'Não informado' onde faltar."
            : "Ainda NÃO registre se faltar descrição clara do ocorrido OU localização utilizável.";

        var loc = ctx.TemCoordenadas
            ? $"Localização GPS já recebida: {ctx.EnderecoResumo ?? "coordenadas salvas, endereço em processamento"}."
            : "Localização GPS: ainda não recebida.";

        return $@"Você é o assistente de triagem emergencial da Defesa Civil (WhatsApp), especialista em comunicação em crises.
Objetivo: coletar o MÍNIMO necessário com poucas perguntas (urgência), apoiar o cidadão com orientações seguras e só então liberar registro no painel.

{forcar}

Requisitos para ""pronto_para_registrar"" = true:
1) Descrição compreensível do que aconteceu (tipo de emergência, risco, feridos, etc.)
2) Localização: pin GPS já enviado OU endereço/local citado de forma utilizável no texto

Se o cidadão enviou SÓ localização sem explicar o problema: pergunte em UMA frase curta o que ocorreu (ex.: árvore caída, enchente, deslizamento).
Se enviou socorro confuso sem local: peça o pin do WhatsApp ou o endereço em uma frase.
Máximo 2-3 perguntas no total; seja breve, calmo e direto em português do Brasil.
Não faça interrogatório longo.

{loc}
Tentativas de esclarecimento já feitas pelo bot: {ctx.TentativasEsclarecimento}

Histórico:
{historico}

Última mensagem do cidadão: ""{(ctx.UltimaMensagem ?? "").Replace("\"", "'")}""

Responda APENAS JSON válido:
{{
  ""pronto_para_registrar"": true ou false,
  ""resposta"": ""mensagem curta para o WhatsApp do cidadão"",
  ""texto_consolidado_triagem"": ""narrativa única para a central (null se não registrar)"",
  ""orientacoes_imediatas"": ""orientações de segurança/primeiros passos para o cidadão enquanto aguarda equipe (null se ainda coletando)"",
  ""motivo"": ""falta_descricao"" | ""falta_local"" | ""completo"" | ""forcado_por_limite"" | ""outro""
}}";
    }

    private async Task<string> ChamarGeminiAsync(string modelId, string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new
            {
                responseMimeType = "application/json",
                temperature = 0.3
            }
        };

        var url =
            $"https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={_settings.ApiKey}";

        using var response = await _httpClient.PostAsJsonAsync(url, requestBody, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Gemini {(int)response.StatusCode}", null, response.StatusCode);

        using var doc = JsonDocument.Parse(body);
        return ExtrairTexto(doc.RootElement)
               ?? throw new InvalidOperationException("Gemini sem texto");
    }

    private static string? ExtrairTexto(JsonElement root)
    {
        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            return null;

        var content = candidates[0].GetProperty("content");
        foreach (var part in content.GetProperty("parts").EnumerateArray())
        {
            if (part.TryGetProperty("text", out var text))
                return text.GetString();
        }

        return null;
    }

    private static IntakeAgentResult ParseResultado(string raw, IntakeContext ctx)
    {
        var json = ExtrairJson(raw);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var pronto = root.TryGetProperty("pronto_para_registrar", out var p) && p.GetBoolean();
        var resposta = root.GetProperty("resposta").GetString() ?? "Pode descrever o que aconteceu?";
        var consolidado = root.TryGetProperty("texto_consolidado_triagem", out var t)
            ? NullIfEmpty(t.GetString())
            : null;
        var orientacoes = root.TryGetProperty("orientacoes_imediatas", out var o)
            ? NullIfEmpty(o.GetString())
            : null;
        var motivo = root.TryGetProperty("motivo", out var m) ? m.GetString() ?? "outro" : "outro";

        if (!ctx.ForcarRegistro)
            pronto = pronto && PassaValidacaoMinima(ctx, consolidado, ref resposta, ref motivo);

        if (pronto && string.IsNullOrWhiteSpace(consolidado))
            consolidado = ConversationHistory.ConsolidarNarrativaCidadao(
                ctx.Historico.Select(h => new HistoricoItem(h.Papel, h.Texto)).ToList());

        return new IntakeAgentResult(pronto, resposta.Trim(), consolidado, orientacoes, motivo);
    }

    private static bool PassaValidacaoMinima(
        IntakeContext ctx,
        string? consolidado,
        ref string resposta,
        ref string motivo)
    {
        var narrativa = consolidado ?? ConversationHistory.ConsolidarNarrativaCidadao(
            ctx.Historico.Select(h => new HistoricoItem(h.Papel, h.Texto)).ToList());

        var temDescricao = narrativa.Length >= 12 &&
                           !narrativa.Contains("[Localização WhatsApp]", StringComparison.OrdinalIgnoreCase);

        var temLocal = ctx.TemCoordenadas ||
                       ContemPistaEndereco(narrativa);

        if (!temDescricao)
        {
            resposta = ctx.TemCoordenadas
                ? "Recebi sua localização. Em uma frase, o que aconteceu aí? (ex.: árvore caída, enchente, ferido)"
                : "Conte em uma frase o que está acontecendo. Se puder, envie também o pin de localização do WhatsApp.";
            motivo = "falta_descricao";
            return false;
        }

        if (!temLocal)
        {
            resposta = "Entendi a situação. Envie o pin de localização do WhatsApp (ícone de clipe → Localização) ou escreva rua e bairro.";
            motivo = "falta_local";
            return false;
        }

        return true;
    }

    private static bool ContemPistaEndereco(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto) || texto.Length < 8)
            return false;

        return texto.Contains("rua", StringComparison.OrdinalIgnoreCase) ||
               texto.Contains("avenida", StringComparison.OrdinalIgnoreCase) ||
               texto.Contains("av ", StringComparison.OrdinalIgnoreCase) ||
               texto.Contains("bairro", StringComparison.OrdinalIgnoreCase) ||
               texto.Contains("recife", StringComparison.OrdinalIgnoreCase) ||
               texto.Contains("localização", StringComparison.OrdinalIgnoreCase);
    }

    private static IntakeAgentResult FallbackHeuristico(IntakeContext ctx)
    {
        var consolidado = ConversationHistory.ConsolidarNarrativaCidadao(
            ctx.Historico.Select(h => new HistoricoItem(h.Papel, h.Texto)).ToList());

        if (ctx.ForcarRegistro)
        {
            return new IntakeAgentResult(
                true,
                "Registrei sua ocorrência com as informações disponíveis. A Defesa Civil foi acionada. Mantenha-se em local seguro.",
                string.IsNullOrWhiteSpace(consolidado) ? "Relato não detalhado pelo cidadão" : consolidado,
                "Aguarde em local seguro e evite retornar à área de risco até a equipe chegar.",
                "forcado_por_limite");
        }

        if (!ctx.TemCoordenadas && string.IsNullOrWhiteSpace(consolidado))
        {
            return new IntakeAgentResult(
                false,
                "Sou o assistente da Defesa Civil. Descreva o que aconteceu e, se possível, envie sua localização pelo pin do WhatsApp.",
                null,
                null,
                "falta_descricao");
        }

        if (ctx.TemCoordenadas && consolidado.Length < 12)
        {
            return new IntakeAgentResult(
                false,
                $"Tenho seu endereço ({ctx.EnderecoResumo ?? "localização recebida"}). Qual ocorrência devo registrar? Descreva em uma frase.",
                null,
                null,
                "falta_descricao");
        }

        return new IntakeAgentResult(
            true,
            "Ocorrência recebida. Equipe em acionamento.",
            consolidado,
            "Aguarde em local seguro. Se houver risco imediato à vida, ligue 193 ou 190.",
            "completo");
    }

    private static string ExtrairJson(string raw)
    {
        var trimmed = raw.Trim();
        var fence = Regex.Match(trimmed, @"```(?:json)?\s*(\{[\s\S]*?\})\s*```", RegexOptions.IgnoreCase);
        if (fence.Success)
            trimmed = fence.Groups[1].Value.Trim();

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');

        if (start < 0 || end < start)
            throw new FormatException($"Nenhum objeto JSON encontrado. Texto recebido: {trimmed[..Math.Min(300, trimmed.Length)]}");

        return trimmed[start..(end + 1)];
    }

    private static string? NullIfEmpty(string? s) =>
        string.IsNullOrWhiteSpace(s) || s.Equals("null", StringComparison.OrdinalIgnoreCase) ? null : s.Trim();
}
