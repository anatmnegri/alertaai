namespace AlertAi.Services;

public interface IEmergencyIntakeAgent
{
    Task<string> ClassificarCategoriaAsync(string descricao, CancellationToken ct = default);
    Task<string> TranscreverAudioAsync(string filePath, CancellationToken ct = default);
}
