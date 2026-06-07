using System.Text.Json;

namespace AlertAi.Models;

public record HistoricoItem(string Papel, string Texto);

public static class ConversationHistory
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static List<HistoricoItem> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            return JsonSerializer.Deserialize<List<HistoricoItem>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static string Serialize(IEnumerable<HistoricoItem> items) =>
        JsonSerializer.Serialize(items.ToList(), JsonOptions);

    public static void AddCidadao(List<HistoricoItem> historico, string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
            return;

        historico.Add(new HistoricoItem("cidadao", texto.Trim()));
    }

    public static void AddSistema(List<HistoricoItem> historico, string texto) =>
        historico.Add(new HistoricoItem("sistema", texto.Trim()));

    public static string ConsolidarNarrativaCidadao(IEnumerable<HistoricoItem> historico) =>
        string.Join(" ", historico
            .Where(h => h.Papel == "cidadao")
            .Select(h => h.Texto)
            .Where(t => !string.IsNullOrWhiteSpace(t)));
}
