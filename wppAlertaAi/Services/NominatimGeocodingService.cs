using System.Globalization;
using System.Text.Json;
using AlertAi.Models;

namespace AlertAi.Services;

public class NominatimGeocodingService : IGeocodingService
{
    private const int DisplayNameMaxLength = 120;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<NominatimGeocodingService> _logger;

    public NominatimGeocodingService(
        IHttpClientFactory httpClientFactory,
        ILogger<NominatimGeocodingService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<GeocodeEnriquecido> BuscarPorEnderecoAsync(
        string? endereco,
        string? bairro,
        string? cidade,
        string? uf,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(endereco) && string.IsNullOrWhiteSpace(bairro))
            return Vazio(cidade, uf);

        var query = MontarQueryBusca(endereco, bairro, cidade, uf);

        try
        {
            var http = _httpClientFactory.CreateClient("Nominatim");
            var json = await http.GetFromJsonAsync<JsonElement[]>(
                $"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1&addressdetails=1&countrycodes=br",
                ct);

            if (json is not { Length: > 0 })
                return new GeocodeEnriquecido(null, null, endereco, bairro, null, cidade, uf);

            return MapearResultadoBusca(json[0], endereco, bairro, cidade, uf);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha na geocodificação direta (Nominatim search)");
            return new GeocodeEnriquecido(null, null, endereco, bairro, null, cidade, uf);
        }
    }

    public async Task<GeocodeEnriquecido> BuscarPorCoordenadasAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default)
    {
        var lat = latitude.ToString(CultureInfo.InvariantCulture);
        var lon = longitude.ToString(CultureInfo.InvariantCulture);

        try
        {
            var http = _httpClientFactory.CreateClient("Nominatim");
            var item = await http.GetFromJsonAsync<JsonElement>(
                $"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1&accept-language=pt-BR",
                ct);

            return MapearResultadoReversa(item, latitude, longitude);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Falha na geocodificação reversa (Nominatim reverse)");
            return new GeocodeEnriquecido(latitude, longitude, null, null, null, null, null);
        }
    }

    private static GeocodeEnriquecido MapearResultadoBusca(
        JsonElement item,
        string? endereco,
        string? bairro,
        string? cidade,
        string? uf)
    {
        var lat = double.Parse(item.GetProperty("lat").GetString()!, CultureInfo.InvariantCulture);
        var lng = double.Parse(item.GetProperty("lon").GetString()!, CultureInfo.InvariantCulture);

        if (!item.TryGetProperty("address", out var addr))
            return new GeocodeEnriquecido(lat, lng, endereco, bairro, null, cidade, uf);

        var road = LerCampoEndereco(addr, "road", "pedestrian", "footway", "residential");
        var numero = LerCampoEndereco(addr, "house_number");
        var suburb = LerCampoEndereco(addr, "suburb", "neighbourhood", "quarter", "district", "city_district");
        var city = LerCampoEndereco(addr, "city", "town", "municipality", "village");
        var stateUf = ExtrairUf(addr);

        return new GeocodeEnriquecido(
            lat,
            lng,
            !string.IsNullOrWhiteSpace(road) ? road : endereco,
            suburb ?? bairro,
            numero,
            city ?? cidade,
            stateUf ?? uf);
    }

    private static GeocodeEnriquecido MapearResultadoReversa(JsonElement item, double lat, double lng)
    {
        if (!item.TryGetProperty("address", out var addr))
        {
            var display = TruncarDisplayName(item);
            return new GeocodeEnriquecido(lat, lng, display, null, null, null, null);
        }

        var road = LerCampoEndereco(addr, "road", "pedestrian", "footway", "residential");
        var numero = LerCampoEndereco(addr, "house_number");
        var suburb = LerCampoEndereco(addr, "suburb", "neighbourhood", "quarter", "district", "city_district");
        var city = LerCampoEndereco(addr, "city", "town", "municipality", "village");
        var uf = ExtrairUf(addr);

        var endereco = !string.IsNullOrWhiteSpace(road)
            ? road
            : TruncarDisplayName(item);

        return new GeocodeEnriquecido(lat, lng, endereco, suburb, numero, city, uf);
    }

    private static string? TruncarDisplayName(JsonElement item)
    {
        if (!item.TryGetProperty("display_name", out var display))
            return null;

        var text = display.GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(text))
            return null;

        return text.Length <= DisplayNameMaxLength
            ? text
            : text[..DisplayNameMaxLength];
    }

    private static string MontarQueryBusca(string? endereco, string? bairro, string? cidade, string? uf)
    {
        var partes = new List<string>();
        if (!string.IsNullOrWhiteSpace(endereco)) partes.Add(endereco.Trim());
        if (!string.IsNullOrWhiteSpace(bairro)) partes.Add(bairro.Trim());
        if (!string.IsNullOrWhiteSpace(cidade)) partes.Add(cidade.Trim());
        if (!string.IsNullOrWhiteSpace(uf)) partes.Add(uf.Trim());
        else if (string.IsNullOrWhiteSpace(cidade))
            partes.Add("Recife, PE");
        else
            partes.Add("Brasil");

        return Uri.EscapeDataString(string.Join(", ", partes));
    }

    private static GeocodeEnriquecido Vazio(string? cidade, string? uf) =>
        new(null, null, null, null, null, cidade, uf);

    private static string? LerCampoEndereco(JsonElement addr, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (!addr.TryGetProperty(key, out var prop))
                continue;

            var s = prop.GetString();
            if (!string.IsNullOrWhiteSpace(s))
                return s.Trim();
        }

        return null;
    }

    private static string? ExtrairUf(JsonElement addr)
    {
        if (addr.TryGetProperty("ISO3166-2-lvl4", out var iso) &&
            iso.GetString() is { } isoVal &&
            isoVal.Contains('-', StringComparison.Ordinal))
        {
            var uf = isoVal.Split('-', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
            if (!string.IsNullOrWhiteSpace(uf) && uf.Length == 2)
                return uf.ToUpperInvariant();
        }

        if (!addr.TryGetProperty("state", out var state))
            return null;

        var nome = state.GetString()?.Trim();
        return nome switch
        {
            "Pernambuco" => "PE",
            "São Paulo" or "Sao Paulo" => "SP",
            "Rio de Janeiro" => "RJ",
            _ => null
        };
    }
}
