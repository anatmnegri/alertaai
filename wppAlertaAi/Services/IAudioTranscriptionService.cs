namespace AlertAi.Services;

public interface IAudioTranscriptionService
{
    /// <summary>
    /// Transcreve o arquivo de áudio localizado em <paramref name="audioFilePath"/> e retorna o texto.
    /// Retorna <c>null</c> se não for possível transcrever.
    /// </summary>
    Task<string?> TranscreverAsync(string audioFilePath, CancellationToken ct = default);
}
