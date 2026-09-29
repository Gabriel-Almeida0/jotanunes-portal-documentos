using Jotanunes.Docs.Api.Configuracao;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Jotanunes.Docs.Api.Tests.Seguranca;

public class ValidacaoConfiguracaoTests
{
    private const string Fluig = "fluig-0123456789-0123456789-0123456789";
    private const string Portal = "portal-0123456789-0123456789-0123456789";

    private sealed class Ambiente(string nome) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = nome;
        public string ApplicationName { get; set; } = "teste";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static IConfiguration Cfg(string? fluig = Fluig, string? portal = Portal, string? resend = null, string? from = null) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Auth:Fluig:Secret"] = fluig,
            ["Auth:Portal:Secret"] = portal,
            ["Resend:ApiKey"] = resend,
            ["Resend:From"] = from,
            ["ConnectionStrings:Default"] = "Host=x",
        }).Build();

    [Fact]
    public void Valida_em_development_sem_resend() =>
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(), new Ambiente(Environments.Development)));

    [Theory]
    [InlineData(null, Portal)]
    [InlineData("curto", Portal)]
    [InlineData(Fluig, null)]
    [InlineData(Fluig, "curto")]
    [InlineData(Fluig, Fluig)]
    public void Recusa_segredos_invalidos_ou_iguais(string? fluig, string? portal)
    {
        var erros = ValidacaoConfiguracao.Validar(Cfg(fluig, portal), new Ambiente(Environments.Development));
        Assert.NotEmpty(erros);
        Assert.DoesNotContain(erros, e => e.Contains(Fluig) || e.Contains(Portal));
    }

    [Fact]
    public void Producao_exige_resend()
    {
        Assert.Equal(2, ValidacaoConfiguracao.Validar(Cfg(), new Ambiente(Environments.Production)).Count);
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(resend: "re_x", from: "Jotanunes <a@b.com>"), new Ambiente(Environments.Production)));
    }
}
