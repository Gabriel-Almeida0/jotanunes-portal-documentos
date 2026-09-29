using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Infrastructure.Armazenamento;
using Jotanunes.Docs.Infrastructure.Auditoria;
using Jotanunes.Docs.Infrastructure.Email;
using Jotanunes.Docs.Infrastructure.Persistencia;
using Jotanunes.Docs.Infrastructure.Persistencia.Consultas;
using Jotanunes.Docs.Infrastructure.Persistencia.Repositorios;
using Jotanunes.Docs.Infrastructure.Seguranca;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Registra os adaptadores. Toda configuração é lida de forma PREGUIÇOSA (no momento da resolução,
    /// via IConfiguration/IOptions do container), para que overrides de teste (WebApplicationFactory)
    /// e variáveis de ambiente sejam sempre respeitados.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddDbContext<DocsDbContext>((sp, o) =>
        {
            var cs = sp.GetRequiredService<IConfiguration>().GetConnectionString("Default");
            if (string.IsNullOrWhiteSpace(cs)) throw new InvalidOperationException("ConnectionStrings:Default não configurada.");
            o.UseNpgsql(cs).UseSnakeCaseNamingConvention();
        });

        services.AddOptions<OpcoesAuthPortal>().BindConfiguration("Auth:Portal");
        services.AddOptions<OpcoesResend>().BindConfiguration("Resend");
        services.AddOptions<OpcoesArmazenamento>().BindConfiguration("Storage");
        services.AddOptions<ConfiguracaoPortal>().BindConfiguration("Portal");

        services.AddScoped<IUnidadeTrabalho, UnidadeTrabalhoEf>();
        services.AddScoped<IObraRepositorio, ObraRepositorio>();
        services.AddScoped<IEmpresaRepositorio, EmpresaRepositorio>();
        services.AddScoped<ITipoDocumentoRepositorio, TipoDocumentoRepositorio>();
        services.AddScoped<IConviteRepositorio, ConviteRepositorio>();
        services.AddScoped<IEnvioRepositorio, EnvioRepositorio>();
        services.AddScoped<IConsultaDocumentos, ConsultaDocumentosEf>();
        services.AddScoped<IRegistroAuditoria, RegistroAuditoriaEf>();

        services.AddSingleton<IHasherSenha, BCryptHasherSenha>();
        services.AddSingleton<IGeradorSegredos, GeradorSegredos>();
        services.AddSingleton<IEmissorTokenPortal, EmissorTokenPortal>();
        services.AddSingleton<IDetectorFormato, DetectorFormato>();
        services.AddSingleton<IArmazenamentoArquivos, ArmazenamentoDiscoLocal>();

        services.AddHttpClient<ResendEnviadorEmail>(c =>
        {
            c.BaseAddress = new Uri("https://api.resend.com/");
            c.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddSingleton<LogEnviadorEmail>();
        services.AddScoped<IEnviadorEmail>(sp =>
        {
            var resend = sp.GetRequiredService<IOptions<OpcoesResend>>().Value;
            if (!string.IsNullOrWhiteSpace(resend.ApiKey)) return sp.GetRequiredService<ResendEnviadorEmail>();
            if (sp.GetRequiredService<IHostEnvironment>().IsDevelopment()) return sp.GetRequiredService<LogEnviadorEmail>();
            throw new InvalidOperationException("Resend:ApiKey é obrigatória fora do ambiente Development.");
        });
        return services;
    }

    public static async Task AplicarMigrationsAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DocsDbContext>().Database.MigrateAsync(ct);
    }
}
