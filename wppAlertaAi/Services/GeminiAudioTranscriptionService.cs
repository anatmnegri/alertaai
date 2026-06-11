using System.Net;
using System.Text.Json;
using AlertAi.Configuration;
using Microsoft.Extensions.Options;

namespace AlertAi.Services;

/// <summary>
/// Transcreve mensagens de voz do WhatsApp usando a API multimodal do Gemini (inline base64).
/// </summary>
public class GeminiAudioTranscriptionService : IAudioTranscriptionService
{
    private static readonly string[] ModelosFallback = ["gemini-2.5-flash", "gemini-2.0-flash"];

    // Tamanho máximo aceito via inline (20 MB é o limite do Gemini para inline data)
    private const long MaxInlineSizeBytes = 20 * 1024 * 1024;

    private readonly HttpClient _httpClient;
    private readonly GeminiSettings _settings;
    private readonly ILogger<GeminiAudioTranscriptionService> _logger;

    public GeminiAudioTranscriptionService(
        HttpClient httpClient,
        IOptions<GeminiSettings> settings,
        ILogger<GeminiAudioTranscriptionService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<string?> TranscreverAsync(string audioFilePath, CancellationToken ct = default)
    {
        if (!File.Exists(audioFilePath))
        {
            _logger.LogWarning("Arquivo de áudio não encontrado: {Path}", audioFilePath);
            return null;
        }

        var fileInfo = new FileInfo(audioFilePath);
        if (fileInfo.Length > MaxInlineSizeBytes)
        {
            _logger.LogWarning("Áudio muito grande para transcrição inline ({Size} bytes): {Path}", fileInfo.Length, audioFilePath);
            return null;
        }

        var audioBytes = await File.ReadAllBytesAsync(audioFilePath, ct);
        var base64Audio = Convert.ToBase64String(audioBytes);
        var mimeType = InferirMimeType(audioFilePath);

        foreach (var modelId in ObterModelos())
        {
            try
            {
                var transcricao = await ChamarGeminiAsync(modelId, base64Audio, mimeType, ct);
                if (!string.IsNullOrWhiteSpace(transcricao))
                {
                    _logger.LogInformation("🎤 Áudio transcrito com {Model}: \"{Texto}\"", modelId, transcricao);
                    return transcricao.Trim();
                }
            }
            catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            {
                _logger.LogWarning("Modelo de transcrição {Model} indisponível: {Msg}", modelId, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao transcrever com {Model}", modelId);
            }
        }

        _logger.LogError("Todos os modelos Gemini falharam na transcrição do áudio: {Path}", audioFilePath);
        return null;
    }

    private async Task<string?> ChamarGeminiAsync(
        string modelId,
        string base64Audio,
        string mimeType,
        CancellationToken ct)
    {
        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new
                        {
                            inline_data = new
                            {
                                mime_type = mimeType,
                                data = base64Audio
                            }
                        },
                        new
                        {
                            text = "Transcreva o áudio a seguir integralmente, em português do Brasil. " +
                                   "Retorne apenas o texto transcrito, sem comentários, sem prefixos como 'Transcrição:'. " +
                                   "Se o áudio estiver inaudível ou sem fala, retorne exatamente: [áudio sem conteúdo identificável]."
                        }
                    }
                }
            },
            generationConfig = new
            {
                temperature = 0.1
            }
        };

        var url =
            $"https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={_settings.ApiKey}";

        using var response = await _httpClient.PostAsJsonAsync(url, requestBody, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException(
                $"Gemini {(int)response.StatusCode}: {body[..Math.Min(300, body.Length)]}",
                null,
                response.StatusCode);

        using var doc = JsonDocument.Parse(body);
        return ExtrairTexto(doc.RootElement);
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

    private static string InferirMimeType(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        return ext switch
        {
            ".ogg"  => "audio/ogg",
            ".oga"  => "audio/ogg",
            ".mp3"  => "audio/mp3",
            ".mp4"  => "audio/mp4",
            ".m4a"  => "audio/mp4",
            ".wav"  => "audio/wav",
            ".flac" => "audio/flac",
            ".aac"  => "audio/aac",
            ".webm" => "audio/webm",
            _       => "audio/ogg"  // padrão WhatsApp PTT
        };
    }
}
