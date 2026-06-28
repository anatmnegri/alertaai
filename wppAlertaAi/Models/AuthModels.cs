namespace AlertAi.Models;

public class AppUser
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public bool Ativo { get; set; } = true;
}

public class PasswordResetToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiraEm { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime? UsadoEm { get; set; }
}

public record RegisterRequest(string Nome, string Email, string Senha);
public record LoginRequest(string Email, string Senha);
public record ForgotPasswordRequest(string Email);
public record ValidateResetTokenRequest(string Token);
public record ResetPasswordRequest(string Token, string NovaSenha);
public record ChangePasswordRequest(string Email, string SenhaAtual, string NovaSenha);
