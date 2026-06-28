using System.Net;
using System.Net.Mail;
using AlertAi.Configuration;
using Microsoft.Extensions.Options;

namespace AlertAi.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct);
}

public class SmtpEmailService : IEmailService
{
    private readonly SmtpSettings _settings;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IOptions<SmtpSettings> smtpOptions, ILogger<SmtpEmailService> logger)
    {
        _settings = smtpOptions.Value;
        _logger = logger;
    }

    public async Task SendPasswordResetAsync(string toEmail, string resetLink, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.Host) || string.IsNullOrWhiteSpace(_settings.User) || string.IsNullOrWhiteSpace(_settings.Password))
        {
            _logger.LogWarning("SMTP não configurado. Link de reset para {Email}: {Link}", toEmail, resetLink);
            return;
        }

        using var message = new MailMessage();
        message.From = new MailAddress(_settings.FromEmail, _settings.FromName);
        message.To.Add(new MailAddress(toEmail));
        message.Subject = "Recuperação de senha - Alerta.AI";
        message.IsBodyHtml = true;
        message.Body = $"""
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
            <p><a href='{resetLink}'>Clique aqui para redefinir sua senha</a></p>
            <p>Esse link expira em 15 minutos.</p>
            <p>Se você não solicitou, ignore este e-mail.</p>
        """;

        using var client = new SmtpClient(_settings.Host, _settings.Port)
        {
            EnableSsl = _settings.EnableSsl,
            Credentials = new NetworkCredential(_settings.User, _settings.Password),
        };

        ct.ThrowIfCancellationRequested();
        await client.SendMailAsync(message, ct);
    }
}
