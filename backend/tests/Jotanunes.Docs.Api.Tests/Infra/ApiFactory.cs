using System.Collections.Concurrent;
using System.Net;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Infrastructure.Persistencia;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.PostgreSql;

namespace Jotanunes.Docs.Api.Tests.Infra;

/// <summary>
/// API real (WebApplicationFactory) sobre um Postgres 16 real (Testcontainers), com relógio falso,
/// e-mail falso, armazenamento em diretório temporário e coletor de logs.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string SegredoFluig = "segredo-fluig-de-TESTE-com-mais-de-32-bytes-0001";
    public const string SegredoPortal = "segredo-portal-de-TESTE-com-mais-de-32-bytes-0002";
    public const string PortalBaseUrl = "http://portal.teste";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("jotanunes_docs_testes")
        .WithUsername("testes")
        .WithPassword("testes")
        .Build();

    public FakeTimeProvider Relogio { get; } = new(DateTimeOffset.UtcNow) { AutoAdvanceAmount = TimeSpan.FromMilliseconds(10) };
    public EnviadorEmailFake Emails { get; } = new();
    public ColetorLogs Logs { get; } = new();
    public string DiretorioArquivos { get; } = Path.Combine(Path.GetTempPath(), "jn-docs-testes-" + Guid.NewGuid().ToString("N"));
    public string ConnectionString => _postgres.GetConnectionString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = ConnectionString,
            ["Auth:Fluig:Secret"] = SegredoFluig,
            ["Auth:Portal:Secret"] = SegredoPortal,
            ["Database:MigrateOnStartup"] = "true",
            ["Storage:Root"] = DiretorioArquivos,
            ["Portal:BaseUrl"] = PortalBaseUrl,
            ["Resend:ApiKey"] = "",
            ["Cors:Origins"] = "http://localhost:5173,http://localhost:5174",
            // Logs verbosos nos testes: o teste de logs prova que nem em Debug há senha/token no log.
            ["Logging:LogLevel:Default"] = "Debug",
            ["Logging:LogLevel:Microsoft.AspNetCore"] = "Debug",
            ["Logging:LogLevel:Microsoft.EntityFrameworkCore"] = "Information",
            ["Logging:LogLevel:Microsoft.EntityFrameworkCore.Database.Command"] = "Information",
        }));
        builder.ConfigureTestServices(s =>
        {
            s.AddSingleton<TimeProvider>(Relogio);
            s.AddSingleton(Emails);
            s.AddScoped<IEnviadorEmail>(_ => Emails);
            s.AddSingleton<IStartupFilter, IpDeTesteStartupFilter>();
            s.AddSingleton<ILoggerProvider>(Logs);
        });
    }

    public async Task InitializeAsync() => await _postgres.StartAsync();

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        try { if (Directory.Exists(DiretorioArquivos)) Directory.Delete(DiretorioArquivos, recursive: true); }
        catch (IOException) { }
    }

    /// <summary>Cliente com IP de teste próprio (evita que o limite por IP vaze entre testes).</summary>
    public HttpClient Cliente(string? ip = null, string? token = null)
    {
        var c = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Add(IpDeTesteStartupFilter.Header, ip ?? $"10.{Random.Shared.Next(256)}.{Random.Shared.Next(256)}.{Random.Shared.Next(1, 255)}");
        if (token is not null) c.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return c;
    }

    public async Task<T> NoBancoAsync<T>(Func<DocsDbContext, Task<T>> acao)
    {
        await using var scope = Services.CreateAsyncScope();
        return await acao(scope.ServiceProvider.GetRequiredService<DocsDbContext>());
    }

    public Task NoBancoAsync(Func<DocsDbContext, Task> acao) => NoBancoAsync(async db => { await acao(db); return true; });

    public async Task LimparAsync()
    {
        _ = Services; // garante host iniciado (migrations aplicadas)
        await NoBancoAsync(db => db.Database.ExecuteSqlRawAsync(
            "TRUNCATE auditoria, envios_documento, convites, obra_empresas, tipos_documento, empresas, obras RESTART IDENTITY CASCADE"));
        Emails.Limpar();
        Logs.Limpar();
    }
}

[CollectionDefinition(Nome)]
public sealed class ColecaoApi : ICollectionFixture<ApiFactory>
{
    public const string Nome = "api";
}

/// <summary>Base dos testes de integração: banco limpo antes de cada teste.</summary>
[Collection(ColecaoApi.Nome)]
public abstract class TesteApi(ApiFactory api) : IAsyncLifetime
{
    protected ApiFactory Api { get; } = api;
    protected Semente Semente => new(Api);

    public Task InitializeAsync() => Api.LimparAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    protected HttpClient Fluig(string login = "maria.silva", string nome = "Maria Silva") =>
        Api.Cliente(token: Tokens.Fluig(Api, login, nome));

    protected HttpClient Anonimo(string? ip = null) => Api.Cliente(ip);
}

/// <summary>Permite ao teste definir o IP remoto (header X-Test-Ip). Só existe no projeto de testes.</summary>
public sealed class IpDeTesteStartupFilter : IStartupFilter
{
    public const string Header = "X-Test-Ip";

    public Action<Microsoft.AspNetCore.Builder.IApplicationBuilder> Configure(Action<Microsoft.AspNetCore.Builder.IApplicationBuilder> next) => app =>
    {
        app.Use(async (HttpContext ctx, Func<Task> proximo) =>
        {
            if (ctx.Request.Headers.TryGetValue(Header, out var ip) && IPAddress.TryParse(ip.ToString(), out var endereco))
            {
                ctx.Connection.RemoteIpAddress = endereco;
            }
            await proximo();
        });
        next(app);
    };
}

public sealed class EnviadorEmailFake : IEnviadorEmail
{
    private readonly ConcurrentQueue<MensagemEmail> _mensagens = new();

    public bool Falhar { get; set; }

    public IReadOnlyList<MensagemEmail> Mensagens => _mensagens.ToList();

    public Task EnviarAsync(MensagemEmail mensagem, CancellationToken ct = default)
    {
        if (Falhar) throw new FalhaEnvioEmail("falha simulada");
        _mensagens.Enqueue(mensagem);
        return Task.CompletedTask;
    }

    public void Limpar()
    {
        _mensagens.Clear();
        Falhar = false;
    }
}

public sealed class ColetorLogs : ILoggerProvider
{
    private readonly ConcurrentQueue<string> _linhas = new();

    public IReadOnlyList<string> Linhas => _linhas.ToList();

    public ILogger CreateLogger(string categoryName) => new Logger(this, categoryName);

    public void Limpar() => _linhas.Clear();

    public void Dispose() { }

    private sealed class Logger(ColetorLogs dono, string categoria) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            dono._linhas.Enqueue($"{logLevel} {categoria}: {formatter(state, exception)} {exception}");
    }
}
