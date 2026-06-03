using AlertAi.Models;

namespace AlertAi.Services;

public interface IEmergencyTriageService
{
    Task<TriageResult> TriageAsync(TriageInput input, CancellationToken ct = default);
}
