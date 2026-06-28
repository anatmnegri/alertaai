using Microsoft.EntityFrameworkCore;
using AlertAi.Models;

namespace AlertAi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Occurrence> Occurrences => Set<Occurrence>();
    public DbSet<EmergencySession> EmergencySessions => Set<EmergencySession>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
}
