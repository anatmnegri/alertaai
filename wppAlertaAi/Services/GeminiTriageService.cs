using System.Text.Json;
using System.Text.RegularExpressions;
using AlertAi.Configuration;
using AlertAi.Models;
using Microsoft.Extensions.Options;

namespace AlertAi.Services;

public class GeminiTriageService : IEmergencyTriageService
{
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

    public async Task<TriageResult> TriageAsync(string message, CancellationToken ct = default)
    {
        var prompt = $@"Você é um assistente sênior de triagem da Defesa Civil de Recife.
Analise a mensagem do cidadão e extraia todas as informações da ocorrência.

Mensagem: ""{message}""

Responda APENAS com um objeto JSON válido, sem texto adicional, sem markdown, sem explicações.
Use exatamente este formato:
{{
    ""severidade"": ""Alta"" | ""Media"" | ""Baixa"",
    ""categoria"": ""Deslizamento"" | ""Enchente"" | ""Incendio"" | ""Acidente"" | ""Outros"",
    ""resumo"": ""Resumo objetivo em 1 frase"",
    ""acao_recomendada"": ""Ação imediata recomendada para a central"",
    ""endereco"": ""Rua/Avenida e número mencionados na mensagem, ou null se não informado"",
    ""bairro"": ""Bairro ou localidade mencionados na mensagem, ou null se não informado""
}}

Critérios de severidade:
- Alta: risco imediato de vida, desabamento, feridos, situação crítica
- Media: situação grave mas sem risco imediato de vida
- Baixa: dano material sem risco à integridade física

Critérios de categoria:
- Deslizamento: queda de terra, morro, encosta, barreira
- Enchente: alagamento, inundação, chuva forte, transbordamento
- Incendio: fogo, queimada, fumaça, incêndio
- Acidente: colisão, queda de pessoa, explosão, acidente de trânsito
- Outros: qualquer outra ocorrência não listada acima";

        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        };

        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_settings.ModelId}:generateContent?key={_settings.ApiKey}";
            var response = await _httpClient.PostAsJsonAsync(url, requestBody, ct);
            
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var rawText = jsonResponse
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            return ParseTriageResult(rawText ?? "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar triagem com Gemini API");
            return new TriageResult("Media", "Outros", "Erro na triagem automática", "Verificação manual necessária");
        }
    }

    private TriageResult ParseTriageResult(string rawText)
    {
        try
        {
            // Extrai o bloco JSON independente de markdown ou texto ao redor
            var start = rawText.IndexOf('{');
            var end = rawText.LastIndexOf('}');

            if (start < 0 || end < start)
                throw new Exception($"Nenhum objeto JSON encontrado. Texto recebido: {rawText[..Math.Min(300, rawText.Length)]}");

            var cleanJson = rawText[start..(end + 1)];

            var result = JsonSerializer.Deserialize<TriageResult>(cleanJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return result ?? throw new Exception("Resultado nulo após desserialização");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha ao parsear JSON da IA. Texto bruto: {RawText}", rawText);
            throw;
        }
    }
}
