namespace AlertAi.Services;

public interface IEmergencyIntakeAgent
{
    Task<IntakeAgentResult> AvaliarAsync(IntakeContext context, CancellationToken ct = default);
}
