namespace AlertAi.Services;

public record IntakeContext(
    string Telefone,
    IReadOnlyList<(string Papel, string Texto)> Historico,
    string? UltimaMensagem,
    bool TemCoordenadas,
    string? EnderecoResumo,
    int TentativasEsclarecimento,
    bool ForcarRegistro);

public record IntakeAgentResult(
    bool ProntoParaRegistrar,
    string RespostaCidadao,
    string? TextoConsolidadoTriagem,
    string? OrientacoesImediatasCidadao,
    string Motivo);
