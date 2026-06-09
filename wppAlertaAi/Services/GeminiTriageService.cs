using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using AlertAi.Configuration;
using AlertAi.Models;
using Microsoft.Extensions.Options;

namespace AlertAi.Services;

public class GeminiTriageService : IEmergencyTriageService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly string[] ModelosFallback =
    [
        "gemini-2.5-flash",
        "gemini-2.0-flash"
    ];

    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _settings;
    private readonly ILogger<GeminiTriageService> _logger;

    public GeminiTriageService(
        HttpClient httpClient,
        IOptions<GeminiSettings> settings,
        ILogger<GeminiTriageService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<TriageResult> TriageAsync(TriageInput input, CancellationToken ct = default)
    {
        var prompt = MontarPrompt(input.Message, input.SomenteLocalizacaoWhatsapp);

        var modelos = ObterModelosParaTentativa();

        foreach (var modelId in modelos)
        {
            try
            {
                var rawText = await ChamarGeminiAsync(modelId, prompt, ct);
                return ParseTriageResult(rawText);
            }
            catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            {
                _logger.LogWarning("Modelo {ModelId} indisponível ou inválido: {Message}", modelId, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na triagem com modelo {ModelId}", modelId);
            }
        }

        _logger.LogError("Todos os modelos Gemini falharam; usando fallback de triagem");
        return CriarFallbackTriagem();
    }

    private IEnumerable<string> ObterModelosParaTentativa()
    {
        var preferido = string.IsNullOrWhiteSpace(_settings.ModelId)
            ? ModelosFallback[0]
            : _settings.ModelId.Trim();

        yield return preferido;

        foreach (var modelo in ModelosFallback)
        {
            if (!string.Equals(modelo, preferido, StringComparison.OrdinalIgnoreCase))
                yield return modelo;
        }
    }

    private static string MontarPrompt(string message, bool somenteLocalizacaoWhatsapp)
    {
        var mensagemEscapada = message.Replace("\"", "\\\"");
        var categorias = string.Join("\" | \"", CategoriasDesastre.Todas);
        var instrucaoCidade = somenteLocalizacaoWhatsapp
            ? "Use valor JSON null (sem aspas)"
            : "Município mencionado ou inferido; se não houver pista, use Recife";
        var instrucaoUf = somenteLocalizacaoWhatsapp
            ? "Use valor JSON null (sem aspas)"
            : "Sigla UF com 2 letras (ex.: PE, SP) conforme a cidade; se Recife, use PE";
        var contextoGps = somenteLocalizacaoWhatsapp
            ? @"
O cidadão enviou APENAS um pin de localização GPS pelo WhatsApp, sem texto descritivo.
Classifique severidade e categoria com base no contexto de emergência urbana (use ""Outros"" só se não houver indício de risco).
Não invente logradouro: endereco, bairro, cidade e uf devem ser null.
Resumo: indique que o cidadão compartilhou localização GPS aguardando avaliação da central.
"
            : string.Empty;

        return $@"Você é um assistente sênior de triagem da Defesa Civil de Recife.
Analise a mensagem do cidadão e extraia todas as informações da ocorrência.
{contextoGps}
Mensagem: ""{mensagemEscapada}""

Responda APENAS com um objeto JSON válido, sem texto adicional, sem markdown, sem explicações.
Use exatamente este formato:
{{
    ""severidade"": ""Alta"" | ""Media"" | ""Baixa"",
    ""categoria"": ""{categorias}"",
    ""resumo"": ""Resumo objetivo em 1 frase"",
    ""acao_recomendada"": ""Ação imediata recomendada para a central"",
    ""endereco"": ""Logradouro (rua/avenida) e número se houver; normalize abreviações (ex.: Av → Avenida), ou null"",
    ""bairro"": ""Bairro ou localidade mencionados na mensagem, ou null se não informado"",
    ""cidade"": ""{instrucaoCidade}"",
    ""uf"": ""{instrucaoUf}""
}}

Critérios de severidade:
- Alta: Risco iminente à vida, pessoas presas em escombros, vítimas graves, desabamentos recentes, incêndios ativos em áreas residenciais, enchentes com pessoas ilhadas, ou acidentes graves. Requer ação imediata de resgate.
- Media: Situações graves, mas sem risco de morte iminente. Ex: Danos estruturais (rachaduras) sem risco de desabamento instantâneo, alagamento de vias sem ilhados, queda de árvores sem vítimas (apenas dano patrimonial), acidentes de trânsito sem feridos graves.
- Baixa: Danos materiais leves, focos de lixo, pedidos de vistoria preventiva, solicitação de informações (ex: abrigos), ou eventos meteorológicos sem danos relatados.

Critérios de categoria (use o valor canônico exato da lista):
- Deslizamento: queda de terra, morro, encosta, barreira, desmoronamento
- Enchente: alagamento, inundação, chuva forte, transbordamento
- Incendio: fogo, queimada, fumaça, incêndio
- Acidente: colisão, queda de pessoa, explosão, acidente de trânsito
- Terremoto: terremoto, abalo sísmico forte, tremor de terra intenso, epicentro
- Tremor: tremor leve, abalo sísmico leve sem danos graves
- Tempestade: vendaval, granizo, raio, ciclone, vento forte, temporal
- Outros: somente se não se encaixar em nenhuma categoria acima";
    }

    private async Task<string> ChamarGeminiAsync(string modelId, string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                temperature = 0.2
            }
        };

        var url =
            $"https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={_settings.ApiKey}";

        using var response = await _httpClient.PostAsJsonAsync(url, requestBody, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var snippet = responseBody.Length > 500 ? responseBody[..500] : responseBody;
            _logger.LogError(
                "Gemini API retornou {StatusCode} (modelo {ModelId}): {Body}",
                (int)response.StatusCode,
                modelId,
                snippet);

            throw new HttpRequestException(
                $"Gemini API {(int)response.StatusCode}",
                null,
                response.StatusCode);
        }

        using var jsonResponse = JsonDocument.Parse(responseBody);
        return ExtrairTextoResposta(jsonResponse.RootElement)
               ?? throw new InvalidOperationException("Resposta Gemini sem texto em candidates");
    }

    private static string? ExtrairTextoResposta(JsonElement root)
    {
        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            return null;

        var first = candidates[0];
        if (!first.TryGetProperty("content", out var content))
            return null;

        if (!content.TryGetProperty("parts", out var parts))
            return null;

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var text))
                return text.GetString();
        }

        return null;
    }

    private TriageResult ParseTriageResult(string rawText)
    {
        var cleanJson = ExtrairJson(rawText);

        var result = JsonSerializer.Deserialize<TriageResult>(cleanJson, JsonOptions)
                     ?? throw new InvalidOperationException("Resultado nulo após desserialização");

        return NormalizarResultado(result);
    }

    private static string ExtrairJson(string rawText)
    {
        var trimmed = rawText.Trim();

        var fenceMatch = Regex.Match(
            trimmed,
            @"```(?:json)?\s*(\{[\s\S]*?\})\s*```",
            RegexOptions.IgnoreCase);

        if (fenceMatch.Success)
            trimmed = fenceMatch.Groups[1].Value.Trim();

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');

        if (start < 0 || end < start)
            throw new FormatException(
                $"Nenhum objeto JSON encontrado. Texto recebido: {trimmed[..Math.Min(300, trimmed.Length)]}");

        return trimmed[start..(end + 1)];
    }

    private static TriageResult NormalizarResultado(TriageResult result)
    {
        var severidade = NormalizarSeveridade(result.severidade);
        var categoria = NormalizarCategoria(result.categoria);

        return result with
        {
            severidade = severidade,
            categoria = categoria,
            resumo = string.IsNullOrWhiteSpace(result.resumo) ? "Ocorrência registrada" : result.resumo.Trim(),
            acao_recomendada = string.IsNullOrWhiteSpace(result.acao_recomendada)
                ? "Avaliar ocorrência no painel"
                : result.acao_recomendada.Trim(),
            endereco = NormalizarOpcional(result.endereco),
            bairro = NormalizarOpcional(result.bairro),
            cidade = NormalizarOpcional(result.cidade),
            uf = NormalizarUf(result.uf)
        };
    }

    private static string? NormalizarOpcional(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
            return null;

        var v = valor.Trim();
        if (v.Equals("null", StringComparison.OrdinalIgnoreCase) ||
            v.Equals("não informado", StringComparison.OrdinalIgnoreCase) ||
            v.Equals("nao informado", StringComparison.OrdinalIgnoreCase))
            return null;

        return v;
    }

    private static string NormalizarSeveridade(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
            return "Media";

        var v = valor.Trim();
        if (v.StartsWith("Alta", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("crít", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("crit", StringComparison.OrdinalIgnoreCase))
            return "Alta";

        if (v.StartsWith("Baixa", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("leve", StringComparison.OrdinalIgnoreCase))
            return "Baixa";

        if (v.StartsWith("Med", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("moder", StringComparison.OrdinalIgnoreCase))
            return "Media";

        return "Media";
    }

    private static string NormalizarCategoria(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
            return "Outros";

        var v = valor.Trim();

        if (v.Contains("desliz", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("barreira", StringComparison.OrdinalIgnoreCase))
            return "Deslizamento";

        if (v.Contains("enchent", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("alag", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("inund", StringComparison.OrdinalIgnoreCase))
            return "Enchente";

        if (v.Contains("incend", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("fogo", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("queimad", StringComparison.OrdinalIgnoreCase))
            return "Incendio";

        if (v.Contains("acident", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("colis", StringComparison.OrdinalIgnoreCase))
            return CategoriasDesastre.Acidente;

        if (v.Contains("terremot", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("sismo", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("abalo", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("tremor de terra", StringComparison.OrdinalIgnoreCase))
            return CategoriasDesastre.Terremoto;

        if (v.Contains("tremor", StringComparison.OrdinalIgnoreCase))
            return CategoriasDesastre.Tremor;

        if (v.Contains("tempest", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("vendaval", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("granizo", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("ciclone", StringComparison.OrdinalIgnoreCase) ||
            v.Contains("raio", StringComparison.OrdinalIgnoreCase))
            return CategoriasDesastre.Tempestade;

        return v switch
        {
            CategoriasDesastre.Deslizamento or CategoriasDesastre.Enchente or CategoriasDesastre.Incendio
                or CategoriasDesastre.Acidente or CategoriasDesastre.Terremoto or CategoriasDesastre.Tremor
                or CategoriasDesastre.Tempestade or CategoriasDesastre.Outros => v,
            _ => CategoriasDesastre.Outros
        };
    }

    private static string? NormalizarUf(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
            return null;

        var v = valor.Trim().ToUpperInvariant();
        if (v.Length == 2 && char.IsLetter(v[0]) && char.IsLetter(v[1]))
            return v;

        return v switch
        {
            "PERNAMBUCO" => "PE",
            "SÃO PAULO" or "SAO PAULO" => "SP",
            "RIO DE JANEIRO" => "RJ",
            _ => v.Length <= 3 ? v : null
        };
    }

    private static TriageResult CriarFallbackTriagem() =>
        new("Media", "Outros", "Erro na triagem automática", "Verificação manual necessária");
}
