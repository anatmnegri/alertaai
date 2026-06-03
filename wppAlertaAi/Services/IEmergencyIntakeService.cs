using AlertAi.Models;

namespace AlertAi.Services;

public interface IEmergencyIntakeService
{
    Task<ChatMessageResponse> ProcessarMensagemAsync(ChatMessagePayload payload, CancellationToken ct = default);
}
