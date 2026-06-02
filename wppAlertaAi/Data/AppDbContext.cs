using Microsoft.EntityFrameworkCore;
using AlertAi.Models;

namespace AlertAi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Occurrence> Occurrences => Set<Occurrence>();
}
