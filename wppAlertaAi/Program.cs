using DotNetEnv;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using AlertAi.Configuration;
using AlertAi.Data;
using AlertAi.Models;
using AlertAi.Services;
using AlertAi.Hubs;

Env.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("PainelPolicy", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<GeminiSettings>(builder.Configuration.GetSection("GeminiSettings"));
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));

builder.Services.AddHttpClient<IEmergencyTriageService, GeminiTriageService>();
builder.Services.AddScoped<IGeocodingService, NominatimGeocodingService>();
builder.Services.AddScoped<IOccurrenceRegistrationService, OccurrenceRegistrationService>();
builder.Services.AddHttpClient<IEmergencyIntakeAgent, GeminiEmergencyIntakeAgent>();
builder.Services.AddScoped<IEmergencyIntakeService, EmergencyIntakeService>();
builder.Services.AddHttpClient<IAudioTranscriptionService, GeminiAudioTranscriptionService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddHttpClient("Nominatim", c =>
{
    c.DefaultRequestHeaders.Add("User-Agent", "AlertAI-DefesaCivil/1.0");
    c.Timeout = TimeSpan.FromSeconds(5);
});

var app = builder.Build();

var mediaDir = Path.Combine(builder.Environment.WebRootPath ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot"), "media");
if (!Directory.Exists(mediaDir))
{
    Directory.CreateDirectory(mediaDir);
}

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    AplicarMigracoesDefensivas(db);
    SeedUsuarioAdmin(db);
}

app.UseCors("PainelPolicy");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseSwagger();
app.UseSwaggerUI();

app.MapHub<EmergencyHub>("/hubs/emergency");

app.MapPost("/api/chat", async (
    ChatMessagePayload payload,
    IEmergencyIntakeService intakeService,
    AppDbContext db,
    IHubContext<EmergencyHub> hubContext,
    CancellationToken ct) =>
{
    var response = await intakeService.ProcessarMensagemAsync(payload, ct);

    if (response.RegistrouOcorrencia && response.OccurrenceId is int id && !response.Duplicate)
    {
        var occurrence = await db.Occurrences.FindAsync([id], ct);
        if (occurrence is not null)
            await hubContext.Clients.All.SendAsync("NewOccurrence", occurrence, ct);
    }

    return Results.Ok(new
    {
        status = "sucesso",
        respostaBot = response.RespostaBot,
        registrouOcorrencia = response.RegistrouOcorrencia,
        duplicate = response.Duplicate,
        occurrenceId = response.OccurrenceId,
        data = response.Data,
        orientacoesCidadao = response.OrientacoesCidadao
    });
});

app.MapPost("/api/triage", async (
    WebhookPayload payload,
    IOccurrenceRegistrationService registrationService,
    IHubContext<EmergencyHub> hubContext,
    CancellationToken ct) =>
{
    var result = await registrationService.RegisterAsync(payload, ct);

    if (result.IsDuplicate)
    {
        return Results.Ok(new
        {
            status = "sucesso",
            message = "Ocorrência já registrada (deduplicada).",
            duplicate = true,
            occurrenceId = result.Occurrence!.Id,
            data = result.Triage
        });
    }

    await hubContext.Clients.All.SendAsync("NewOccurrence", result.Occurrence, ct);

    return Results.Ok(new
    {
        status = "sucesso",
        message = "Ocorrência adicionada ao painel da Defesa Civil.",
        data = result.Triage
    });
});

app.MapGet("/api/ocorrencias", async (AppDbContext db) =>
    await db.Occurrences.OrderByDescending(o => o.DataOcorrencia).ToListAsync());

app.MapMethods("/api/ocorrencias/{id}/resolver", ["PATCH"], async (int id, AppDbContext db) =>
{
    var occurrence = await db.Occurrences.FindAsync(id);
    if (occurrence is null) return Results.NotFound();

    occurrence.Aberto = false;
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapPost("/api/auth/register", async (RegisterRequest req, AppDbContext db) =>
{
    var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
    var nome = (req.Nome ?? string.Empty).Trim();
    var senha = req.Senha ?? string.Empty;

    if (string.IsNullOrWhiteSpace(nome) || nome.Length < 2)
        return Results.BadRequest(new { ok = false, erro = "Informe um nome válido." });
    if (!EmailValido(email))
        return Results.BadRequest(new { ok = false, erro = "Informe um e-mail válido." });
    if (!SenhaForte(senha))
        return Results.BadRequest(new { ok = false, erro = "A senha não atende aos requisitos de segurança." });

    var existe = await db.Users.AnyAsync(u => u.Email == email && u.Ativo);
    if (existe)
        return Results.BadRequest(new { ok = false, erro = "Já existe usuário com este e-mail." });

    db.Users.Add(new AppUser
    {
        Email = email,
        Nome = nome,
        PasswordHash = PasswordHasher.Hash(senha),
        CriadoEm = DateTime.UtcNow,
        Ativo = true,
    });

    await db.SaveChangesAsync();
    return Results.Ok(new { ok = true });
});

app.MapPost("/api/auth/login", async (LoginRequest req, AppDbContext db) =>
{
    var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
    var senha = req.Senha ?? string.Empty;

    if (!EmailValido(email))
        return Results.BadRequest(new { ok = false, erro = "E-mail ou senha inválidos" });

    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.Ativo);
    if (user is null || !PasswordHasher.Verify(senha, user.PasswordHash))
        return Results.BadRequest(new { ok = false, erro = "E-mail ou senha inválidos" });

    return Results.Ok(new
    {
        ok = true,
        sessao = new
        {
            email = user.Email,
            nome = user.Nome,
            logadoEm = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        }
    });
});

app.MapPost("/api/auth/forgot-password", async (
    ForgotPasswordRequest req,
    AppDbContext db,
    IEmailService emailService,
    IConfiguration config,
    CancellationToken ct) =>
{
    var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
    if (!EmailValido(email))
        return Results.BadRequest(new { ok = false, erro = "Informe um e-mail válido." });

    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.Ativo, ct);
    if (user is not null)
    {
        var plainToken = GerarToken();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = HashToken(plainToken),
            ExpiraEm = DateTime.UtcNow.AddMinutes(15),
            CriadoEm = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        var frontendBaseUrl = config["Smtp:FrontendBaseUrl"] ?? "http://localhost:5173";
        var resetLink = $"{frontendBaseUrl.TrimEnd('/')}/redefinir-senha?token={Uri.EscapeDataString(plainToken)}";

        var destinatario = email == "admin@defesacivil.recife.gov.br"
            ? "mariafernanda2507@gmail.com"
            : email;

        await emailService.SendPasswordResetAsync(destinatario, resetLink, ct);
    }

    // resposta genérica para evitar enumeração de usuários
    return Results.Ok(new { ok = true });
});

app.MapPost("/api/auth/validate-reset-token", async (ValidateResetTokenRequest req, AppDbContext db, CancellationToken ct) =>
{
    var token = req.Token ?? string.Empty;
    if (string.IsNullOrWhiteSpace(token))
        return Results.Ok(new { valido = false });

    var tokenHash = HashToken(token);

    var registro = await db.PasswordResetTokens
        .OrderByDescending(t => t.Id)
        .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.UsadoEm == null, ct);

    if (registro is null)
        return Results.Ok(new { valido = false });

    if (DateTime.UtcNow > registro.ExpiraEm)
        return Results.Ok(new { valido = false, expirado = true });

    return Results.Ok(new { valido = true });
});

app.MapPost("/api/auth/reset-password", async (ResetPasswordRequest req, AppDbContext db, CancellationToken ct) =>
{
    var token = req.Token ?? string.Empty;
    var novaSenha = req.NovaSenha ?? string.Empty;

    if (!SenhaForte(novaSenha))
        return Results.BadRequest(new { ok = false, erro = "A nova senha não atende aos requisitos de segurança." });

    var tokenHash = HashToken(token);

    var registro = await db.PasswordResetTokens
        .OrderByDescending(t => t.Id)
        .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.UsadoEm == null, ct);

    if (registro is null)
        return Results.BadRequest(new { ok = false, erro = "Link de recuperação inválido." });
    if (DateTime.UtcNow > registro.ExpiraEm)
        return Results.BadRequest(new { ok = false, erro = "O link de recuperação expirou. Solicite um novo." });

    var user = await db.Users.FirstOrDefaultAsync(u => u.Id == registro.UserId && u.Ativo, ct);
    if (user is null)
        return Results.BadRequest(new { ok = false, erro = "Usuário não encontrado." });

    user.PasswordHash = PasswordHasher.Hash(novaSenha);
    registro.UsadoEm = DateTime.UtcNow;

    var tokensAtivos = db.PasswordResetTokens.Where(t => t.UserId == user.Id && t.UsadoEm == null && t.Id != registro.Id);
    await tokensAtivos.ForEachAsync(t => t.UsadoEm = DateTime.UtcNow, ct);

    await db.SaveChangesAsync(ct);
    return Results.Ok(new { ok = true });
});

app.MapPost("/api/auth/change-password", async (ChangePasswordRequest req, AppDbContext db, CancellationToken ct) =>
{
    var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
    var senhaAtual = req.SenhaAtual ?? string.Empty;
    var novaSenha = req.NovaSenha ?? string.Empty;

    if (!SenhaForte(novaSenha))
        return Results.BadRequest(new { ok = false, erro = "A nova senha não atende aos requisitos de segurança." });

    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.Ativo, ct);
    if (user is null || !PasswordHasher.Verify(senhaAtual, user.PasswordHash))
        return Results.BadRequest(new { ok = false, erro = "A senha atual está incorreta." });

    if (PasswordHasher.Verify(novaSenha, user.PasswordHash))
        return Results.BadRequest(new { ok = false, erro = "A nova senha deve ser diferente da atual." });

    user.PasswordHash = PasswordHasher.Hash(novaSenha);
    var tokensAtivos = db.PasswordResetTokens.Where(t => t.UserId == user.Id && t.UsadoEm == null);
    await tokensAtivos.ForEachAsync(t => t.UsadoEm = DateTime.UtcNow, ct);

    await db.SaveChangesAsync(ct);
    return Results.Ok(new { ok = true });
});

app.Run();

static void AplicarMigracoesDefensivas(AppDbContext db)
{
    string[] alteracoes =
    [
        "ALTER TABLE Occurrences ADD COLUMN Endereco TEXT",
        "ALTER TABLE Occurrences ADD COLUMN Bairro TEXT",
        "ALTER TABLE Occurrences ADD COLUMN Cidade TEXT",
        "ALTER TABLE Occurrences ADD COLUMN Uf TEXT",
        "ALTER TABLE Occurrences ADD COLUMN IdMensagemWhatsapp TEXT",
        "ALTER TABLE Occurrences ADD COLUMN Latitude REAL",
        "ALTER TABLE Occurrences ADD COLUMN Longitude REAL",
        "ALTER TABLE Occurrences ADD COLUMN Numero TEXT",
        "ALTER TABLE Occurrences ADD COLUMN OrigemLocalizacao TEXT",
        "ALTER TABLE Occurrences ADD COLUMN MediaUrlsJson TEXT DEFAULT '[]'"
    ];

    foreach (var sql in alteracoes)
    {
        try { db.Database.ExecuteSqlRaw(sql); } catch { }
    }

    try
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS EmergencySessions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Telefone TEXT NOT NULL,
                Status TEXT NOT NULL,
                HistoricoJson TEXT NOT NULL DEFAULT '[]',
                Latitude REAL,
                Longitude REAL,
                EnderecoResumo TEXT,
                OrigemLocalizacao TEXT,
                TentativasEsclarecimento INTEGER NOT NULL DEFAULT 0,
                MediaUrlsJson TEXT NOT NULL DEFAULT '[]',
                CriadoEm TEXT NOT NULL,
                AtualizadoEm TEXT NOT NULL
            );
            """);
    }
    catch { }

    try { db.Database.ExecuteSqlRaw("ALTER TABLE EmergencySessions ADD COLUMN MediaUrlsJson TEXT DEFAULT '[]'"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE EmergencySessions ADD COLUMN PassoAtual TEXT DEFAULT 'novo'"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE EmergencySessions ADD COLUMN NomeContatoWhatsapp TEXT DEFAULT 'Desconhecido'"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Occurrences ADD COLUMN NomeContato TEXT DEFAULT 'Desconhecido'"); } catch { }

    try
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS Users (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Email TEXT NOT NULL UNIQUE,
                PasswordHash TEXT NOT NULL,
                Nome TEXT NOT NULL,
                CriadoEm TEXT NOT NULL,
                Ativo INTEGER NOT NULL DEFAULT 1
            );
            """);
    }
    catch { }

    try
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS PasswordResetTokens (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                TokenHash TEXT NOT NULL,
                ExpiraEm TEXT NOT NULL,
                CriadoEm TEXT NOT NULL,
                UsadoEm TEXT NULL
            );
            """);
    }
    catch { }
}

static bool EmailValido(string email)
{
    return !string.IsNullOrWhiteSpace(email)
        && System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$");
}

static bool SenhaForte(string senha)
{
    if (string.IsNullOrEmpty(senha) || senha.Length < 8) return false;
    return senha.Any(char.IsUpper)
        && senha.Any(char.IsLower)
        && senha.Any(char.IsDigit)
        && senha.Any(ch => !char.IsLetterOrDigit(ch));
}

static string GerarToken()
{
    return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        .Replace('+', '-')
        .Replace('/', '_')
        .TrimEnd('=');
}

static string HashToken(string token)
{
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
    return Convert.ToHexString(bytes);
}

static void SeedUsuarioAdmin(AppDbContext db)
{
    const string email = "admin@defesacivil.recife.gov.br";
    if (db.Users.Any(u => u.Email == email)) return;

    db.Users.Add(new AppUser
    {
        Email = email,
        Nome = "Administrador",
        PasswordHash = PasswordHasher.Hash("Admin@123"),
        CriadoEm = DateTime.UtcNow,
        Ativo = true,
    });
    db.SaveChanges();
}
