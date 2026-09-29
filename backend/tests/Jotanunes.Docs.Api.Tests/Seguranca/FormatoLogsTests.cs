using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Api.Tests.Seguranca;

/// <summary>
/// Logs do console: JSON estruturado fora de Development (research R12) e formato simples em Development.
/// O conteúdo (sem senhas/tokens) é coberto por <see cref="LogsTests"/>; aqui só o formato.
/// </summary>
public class FormatoLogsTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public void Development_usa_formato_simples()
    {
        var opcoes = Api.Services.GetRequiredService<IOptionsMonitor<ConsoleLoggerOptions>>().CurrentValue;
        Assert.Equal(ConsoleFormatterNames.Simple, opcoes.FormatterName);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task Fora_de_development_usa_json_em_uma_linha(string ambiente)
    {
        await using var fabrica = new FabricaAmbiente(ambiente, Api.ConnectionString);
        var sp = fabrica.Services;
        Assert.Equal(ConsoleFormatterNames.Json, sp.GetRequiredService<IOptionsMonitor<ConsoleLoggerOptions>>().CurrentValue.FormatterName);
        var opcoesJson = sp.GetRequiredService<IOptionsMonitor<JsonConsoleFormatterOptions>>().CurrentValue;
        Assert.True(opcoesJson.UseUtcTimestamp);
        Assert.False(opcoesJson.JsonWriterOptions.Indented);

        // o formatador registrado produz uma linha JSON válida com nível, categoria e mensagem
        var formatador = sp.GetServices<ConsoleFormatter>().Single(f => f.Name == ConsoleFormatterNames.Json);
        using var saida = new StringWriter();
        var entrada = new LogEntry<string>(LogLevel.Warning, "Jotanunes.Teste", new EventId(7), "mensagem de teste", null, (s, _) => s);
        formatador.Write(in entrada, new LoggerExternalScopeProvider(), saida);
        var linhas = saida.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var linha = Assert.Single(linhas);
        using var json = JsonDocument.Parse(linha);
        Assert.Equal("Warning", json.RootElement.GetProperty("LogLevel").GetString());
        Assert.Equal("Jotanunes.Teste", json.RootElement.GetProperty("Category").GetString());
        Assert.Equal("mensagem de teste", json.RootElement.GetProperty("Message").GetString());
        Assert.EndsWith("Z", json.RootElement.GetProperty("Timestamp").GetString());
    }

    /// <summary>API num ambiente que não é Development, com a configuração mínima exigida para subir.</summary>
    private sealed class FabricaAmbiente(string ambiente, string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(ambiente);
            builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = connectionString,
                ["Auth:Fluig:Secret"] = ApiFactory.SegredoFluig,
                ["Auth:Portal:Secret"] = ApiFactory.SegredoPortal,
                ["Database:MigrateOnStartup"] = "false",
                ["Resend:ApiKey"] = "re_teste_nao_usada",
                ["Resend:From"] = "Jotanunes <teste@jotanunes.test>",
            }));
        }
    }
}
