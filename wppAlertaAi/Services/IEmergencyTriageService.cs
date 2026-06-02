using AlertAi.Models;

namespace AlertAi.Services;

public interface IEmergencyTriageService
{
    Task<TriageResult> TriageAsync(string message, CancellationToken ct = default);
}
