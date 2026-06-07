using AlertAi.Models;

namespace AlertAi.Services;

public interface IGeocodingService
{
    Task<GeocodeEnriquecido> BuscarPorEnderecoAsync(
        string? endereco,
        string? bairro,
        string? cidade,
        string? uf,
        CancellationToken ct = default);

    Task<GeocodeEnriquecido> BuscarPorCoordenadasAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default);
}
