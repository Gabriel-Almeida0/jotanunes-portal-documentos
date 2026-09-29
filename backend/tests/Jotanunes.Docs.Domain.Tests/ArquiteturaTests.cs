using System.Reflection;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Domain.Tests;

public class ArquiteturaTests
{
    private static readonly Assembly Domain = typeof(Cnpj).Assembly;
    private static readonly Assembly Application = typeof(ErroAplicacao).Assembly;

    private static IEnumerable<string> Referencias(Assembly a) =>
        a.GetReferencedAssemblies().Select(r => r.Name ?? string.Empty);

    [Theory]
    [InlineData("Jotanunes.Docs.Application")]
    [InlineData("Jotanunes.Docs.Infrastructure")]
    [InlineData("Jotanunes.Docs.Api")]
    [InlineData("Microsoft.EntityFrameworkCore")]
    [InlineData("Microsoft.AspNetCore")]
    public void Domain_nao_referencia_camadas_externas(string proibido)
    {
        Assert.DoesNotContain(Referencias(Domain), r => r.StartsWith(proibido, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("Jotanunes.Docs.Infrastructure")]
    [InlineData("Jotanunes.Docs.Api")]
    [InlineData("Microsoft.EntityFrameworkCore")]
    [InlineData("Microsoft.AspNetCore")]
    [InlineData("Npgsql")]
    public void Application_nao_referencia_infraestrutura(string proibido)
    {
        Assert.DoesNotContain(Referencias(Application), r => r.StartsWith(proibido, StringComparison.Ordinal));
    }
}
