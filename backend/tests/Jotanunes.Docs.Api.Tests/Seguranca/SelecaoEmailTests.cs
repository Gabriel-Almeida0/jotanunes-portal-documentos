using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Infrastructure;
using Jotanunes.Docs.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Jotanunes.Docs.Api.Tests.Seguranca;

/// <summary>E-mail no log só em Development e sem chave; com chave usa Resend; fora de Development sem chave falha.</summary>
public class SelecaoEmailTests
{
    private sealed class Ambiente(string nome) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = nome;
        public string ApplicationName { get; set; } = "teste";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static IServiceProvider Montar(string ambiente, string? chave)
    {
        var s = new ServiceCollection();
        s.AddLogging();
        s.AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Resend:ApiKey"] = chave,
            ["Resend:From"] = "Jotanunes <docs@jotanunes.test>",
        }).Build());
        s.AddSingleton<IHostEnvironment>(new Ambiente(ambiente));
        s.AddInfrastructure();
        return s.BuildServiceProvider();
    }

    [Fact]
    public void Development_sem_chave_usa_log() =>
        Assert.IsType<LogEnviadorEmail>(Montar(Environments.Development, null).CreateScope().ServiceProvider.GetRequiredService<IEnviadorEmail>());

    [Fact]
    public void Com_chave_usa_resend() =>
        Assert.IsType<ResendEnviadorEmail>(Montar(Environments.Production, "re_teste").CreateScope().ServiceProvider.GetRequiredService<IEnviadorEmail>());

    [Fact]
    public void Producao_sem_chave_falha() =>
        Assert.Throws<InvalidOperationException>(() => Montar(Environments.Production, "").CreateScope().ServiceProvider.GetRequiredService<IEnviadorEmail>());
}
