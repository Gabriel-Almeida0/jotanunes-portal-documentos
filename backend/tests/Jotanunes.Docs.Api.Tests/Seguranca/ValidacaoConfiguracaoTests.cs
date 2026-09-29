using Jotanunes.Docs.Api.Configuracao;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Jotanunes.Docs.Api.Tests.Seguranca;

public class ValidacaoConfiguracaoTests
{
    private const string Fluig = "fluig-0123456789-0123456789-0123456789";
    private const string Portal = "portal-0123456789-0123456789-0123456789";
    private const string Local = "local-0123456789-0123456789-0123456789";
    private const string Resend = "re_x";
    private const string From = "Jotanunes <a@b.com>";
    private const string FluigApp = "https://fluig.exemplo.com";

    private sealed class Ambiente(string nome) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = nome;
        public string ApplicationName { get; set; } = "teste";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static readonly Ambiente Dev = new(Environments.Development);
    private static readonly Ambiente Producao = new(Environments.Production);

    private static IConfiguration Cfg(string? fluig = Fluig, string? portal = Portal, string? resend = null, string? from = null,
        string? local = Local, string? habilitado = null, string? fluigApp = null, string? issuerFluig = null) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Auth:Fluig:Secret"] = fluig,
            ["Auth:Fluig:Issuer"] = issuerFluig,
            ["Auth:Portal:Secret"] = portal,
            ["Auth:LoginLocal:Secret"] = local,
            ["Auth:LoginLocal:Habilitado"] = habilitado,
            ["FluigApp:BaseUrl"] = fluigApp,
            ["Resend:ApiKey"] = resend,
            ["Resend:From"] = from,
            ["ConnectionStrings:Default"] = "Host=x",
        }).Build();

    private static void AssertSemSegredos(IReadOnlyList<string> erros) =>
        Assert.DoesNotContain(erros, e => e.Contains(Fluig) || e.Contains(Portal) || e.Contains(Local));

    [Fact]
    public void Valida_em_development_sem_resend() =>
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(), Dev));

    [Theory]
    [InlineData(null, Portal)]
    [InlineData("curto", Portal)]
    [InlineData(Fluig, null)]
    [InlineData(Fluig, "curto")]
    [InlineData(Fluig, Fluig)]
    public void Recusa_segredos_invalidos_ou_iguais(string? fluig, string? portal)
    {
        var erros = ValidacaoConfiguracao.Validar(Cfg(fluig, portal), Dev);
        Assert.NotEmpty(erros);
        AssertSemSegredos(erros);
    }

    [Fact]
    public void Producao_exige_resend()
    {
        Assert.Equal(2, ValidacaoConfiguracao.Validar(Cfg(fluigApp: FluigApp), Producao).Count);
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(resend: Resend, from: From, fluigApp: FluigApp), Producao));
    }

    // ── Login próprio (research R17) ──

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("curto-demais")]
    [InlineData(Fluig)]
    [InlineData(Portal)]
    public void Login_proprio_ligado_exige_segredo_proprio_forte_e_diferente(string? local)
    {
        foreach (var habilitado in new[] { null, "true" }) // padrão = ligado
        {
            var erros = ValidacaoConfiguracao.Validar(Cfg(local: local, habilitado: habilitado), Dev);
            Assert.Contains(erros, e => e.Contains("Auth:LoginLocal:Secret", StringComparison.Ordinal));
            AssertSemSegredos(erros);
        }
    }

    [Fact]
    public void FluigApp_BaseUrl_obrigatorio_fora_de_development_com_o_login_ligado()
    {
        var erros = ValidacaoConfiguracao.Validar(Cfg(resend: Resend, from: From), Producao);
        Assert.Contains("FluigApp:BaseUrl", Assert.Single(erros));
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(resend: Resend, from: From), Dev));
    }

    [Theory]
    [InlineData("jotanunes-docs")]
    [InlineData("Jotanunes-Docs")]
    public void Emissor_do_fluig_nao_pode_ser_o_do_login_proprio(string issuer)
    {
        foreach (var habilitado in new[] { "true", "false" })
        {
            var erros = ValidacaoConfiguracao.Validar(Cfg(issuerFluig: issuer, habilitado: habilitado), Dev);
            Assert.Contains("Auth:Fluig:Issuer", Assert.Single(erros));
        }
    }

    [Fact]
    public void Login_proprio_desligado_nao_exige_segredo_nem_endereco()
    {
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(local: null, habilitado: "false"), Dev));
        Assert.Empty(ValidacaoConfiguracao.Validar(Cfg(local: Fluig, habilitado: "false", resend: Resend, from: From), Producao));
    }
}
