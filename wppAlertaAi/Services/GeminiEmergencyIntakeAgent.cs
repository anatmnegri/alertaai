using System.Net;
using System.Text.Json;
using AlertAi.Configuration;
using Microsoft.Extensions.Options;

namespace AlertAi.Services;

public class GeminiEmergencyIntakeAgent : IEmergencyIntakeAgent
{
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

    public async Task<string> ClassificarCategoriaAsync(string descricao, CancellationToken ct = default)
    {
        var prompt = $"Com base na seguinte descrição enviada por um cidadão, classifique a ocorrência em uma categoria curta (ex: Queda de árvore, Enchente, Deslizamento, Incêndio, Acidente, Assistência Médica, Outros). Retorne APENAS o nome da categoria.\n\nDescrição: \"{descricao}\"";

        foreach (var modelId in ObterModelos())
        {
            try
            {
                var raw = await ChamarGeminiAsync(modelId, prompt, ct);
                if (!string.IsNullOrWhiteSpace(raw))
                    return raw.Trim();
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

        return "Outros";
    }

    public async Task<string> TranscreverAudioAsync(string filePath, CancellationToken ct = default)
    {
        var prompt = "Transcreva o relato de ocorrência que o cidadão falou neste áudio com precisão. Retorne apenas o texto transcrito, sem comentários adicionais.";
        var base64Data = Convert.ToBase64String(await File.ReadAllBytesAsync(filePath, ct));
        var mimeType = filePath.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) ? "audio/mp3" :
                       filePath.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ? "video/mp4" : "audio/ogg";

        foreach (var modelId in ObterModelos())
        {
            try
            {
                var requestBody = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new object[]
                            {
                                new { text = prompt },
                                new { inlineData = new { mimeType = mimeType, data = base64Data } }
                            }
                        }
                    },
                    generationConfig = new { responseMimeType = "text/plain", temperature = 0.3 }
                };

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={_settings.ApiKey}";
                using var response = await _httpClient.PostAsJsonAsync(url, requestBody, ct);
                var body = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                    throw new HttpRequestException($"Gemini {(int)response.StatusCode}", null, response.StatusCode);

                using var doc = JsonDocument.Parse(body);
                var text = ExtrairTexto(doc.RootElement);
                if (!string.IsNullOrWhiteSpace(text))
                    return text.Trim();
            }
            catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            {
                _logger.LogWarning("Modelo intake {ModelId} indisponível para áudio: {Msg}", modelId, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na transcrição de áudio com {ModelId}", modelId);
            }
        }

        throw new InvalidOperationException("Falha ao transcrever áudio com todos os modelos suportados.");
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

    private async Task<string> ChamarGeminiAsync(string modelId, string prompt, CancellationToken ct)
    {
        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new
            {
                responseMimeType = "text/plain",
                temperature = 0.3
            }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={_settings.ApiKey}";

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
}
