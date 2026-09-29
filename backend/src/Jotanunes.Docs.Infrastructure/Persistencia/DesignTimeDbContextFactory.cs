using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Jotanunes.Docs.Infrastructure.Persistencia;

/// <summary>Usado apenas pelo `dotnet ef` para gerar migrations (não abre conexão).</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<DocsDbContext>
{
    public DocsDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<DocsDbContext>()
            .UseNpgsql("Host=localhost;Database=design_time")
            .UseSnakeCaseNamingConvention()
            .Options);
}
