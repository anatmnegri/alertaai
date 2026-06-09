using DotNetEnv;

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

builder.Services.AddHttpClient<IEmergencyTriageService, GeminiTriageService>();

builder.Services.AddScoped<IGeocodingService, NominatimGeocodingService>();

builder.Services.AddScoped<IOccurrenceRegistrationService, OccurrenceRegistrationService>();

builder.Services.AddHttpClient<IEmergencyIntakeAgent, GeminiEmergencyIntakeAgent>();

builder.Services.AddScoped<IEmergencyIntakeService, EmergencyIntakeService>();

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

        try { db.Database.ExecuteSqlRaw(sql); } catch { /* coluna já existe */ }

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
    catch { /* tabela já existe */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE EmergencySessions ADD COLUMN MediaUrlsJson TEXT DEFAULT '[]'"); } catch { /* coluna já existe */ }
}
