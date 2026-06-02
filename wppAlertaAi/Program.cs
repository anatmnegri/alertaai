using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using AlertAi.Data;
using AlertAi.Models;
using AlertAi.Services;
using AlertAi.Configuration;
using AlertAi.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("PainelPolicy", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// 1. Configuração do SQLite e Serviços
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(); // Configuração automática simples

builder.Services.Configure<GeminiSettings>(builder.Configuration.GetSection("GeminiSettings"));
builder.Services.AddHttpClient<IEmergencyTriageService, GeminiTriageService>();
builder.Services.AddHttpClient("Nominatim", c =>
{
    c.DefaultRequestHeaders.Add("User-Agent", "AlertAI-DefesaCivil/1.0");
});

var app = builder.Build();

// Inicialização PoC
using (var scope = app.Services.CreateScope()) {
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    // Adiciona colunas novas sem apagar dados existentes
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Occurrences ADD COLUMN Endereco TEXT"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Occurrences ADD COLUMN Bairro TEXT"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Occurrences ADD COLUMN Latitude REAL"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Occurrences ADD COLUMN Longitude REAL"); } catch { }
}

app.UseCors("PainelPolicy");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseSwagger();
app.UseSwaggerUI();

// 2. Hub do SignalR (Painel)
app.MapHub<EmergencyHub>("/hubs/emergency");

// 3. Endpoint de Triagem (Consumido pelo Script de Ponte)
app.MapPost("/api/triage", async (
    WebhookPayload payload,
    IEmergencyTriageService triageService,
    AppDbContext db,
    IHubContext<EmergencyHub> hubContext,
    IHttpClientFactory httpClientFactory) =>
{
    // A. Triagem via Gemini
    var triage = await triageService.TriageAsync(payload.MensagemTexto);

    // B. Geocodificação do endereço extraído
    var (lat, lng) = await GeocodificarAsync(httpClientFactory, triage.endereco, triage.bairro);

    // C. Persistência
    var occurrence = new Occurrence {
        Telefone = payload.TelefoneRemetente,
        MensagemOriginal = payload.MensagemTexto,
        Severidade = triage.severidade,
        Categoria = triage.categoria,
        Resumo = triage.resumo,
        AcaoRecomendada = triage.acao_recomendada,
        Endereco = triage.endereco,
        Bairro = triage.bairro,
        Latitude = lat,
        Longitude = lng,
        DataOcorrencia = DateTime.UtcNow
    };

    db.Occurrences.Add(occurrence);
    await db.SaveChangesAsync();

    // D. Notificação Real-time para o Dashboard
    await hubContext.Clients.All.SendAsync("NewOccurrence", occurrence);

    return Results.Ok(new {
        status = "sucesso",
        message = "Ocorrência adicionada ao painel da Defesa Civil.",
        data = triage
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

app.Run();

static async Task<(double? lat, double? lng)> GeocodificarAsync(IHttpClientFactory factory, string? endereco, string? bairro)
{
    if (string.IsNullOrWhiteSpace(endereco) && string.IsNullOrWhiteSpace(bairro))
        return (null, null);

    var partes = new[] { endereco, bairro, "Recife, PE" }.Where(s => !string.IsNullOrWhiteSpace(s));
    var query = Uri.EscapeDataString(string.Join(", ", partes));

    try
    {
        var http = factory.CreateClient("Nominatim");
        var json = await http.GetFromJsonAsync<JsonElement[]>(
            $"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1&countrycodes=br");

        if (json is { Length: > 0 })
        {
            var lat = double.Parse(json[0].GetProperty("lat").GetString()!, CultureInfo.InvariantCulture);
            var lng = double.Parse(json[0].GetProperty("lon").GetString()!, CultureInfo.InvariantCulture);
            return (lat, lng);
        }
    }
    catch { }

    return (null, null);
}
