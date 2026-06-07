using AlertAi.Models;

namespace AlertAi.Services;

public record OccurrenceRegistrationResult(
    bool IsDuplicate,
    Occurrence? Occurrence,
    TriageResult Triage);

public interface IOccurrenceRegistrationService
{
    Task<OccurrenceRegistrationResult> RegisterAsync(
        WebhookPayload payload,
        CancellationToken ct = default);
}
