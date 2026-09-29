using Jotanunes.Docs.Infrastructure.Armazenamento;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;

namespace Jotanunes.Docs.Api.Tests.Infra;

/// <summary>
/// Prova que a API sob teste usa o banco do Testcontainers (e não o localhost:5432 do appsettings) e os
/// segredos de teste — proteção contra leitura antecipada de configuração durante o registro dos serviços.
/// </summary>
public class ConfiguracaoTestesTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task DbContext_aponta_para_o_postgres_do_testcontainers_com_migrations()
    {
        var (cs, porta, banco, migrations) = await Api.NoBancoAsync(async db =>
        {
            var conn = (NpgsqlConnection)db.Database.GetDbConnection();
            await db.Database.OpenConnectionAsync();
            var b = conn.Database;
            var p = conn.Port;
            var m = (await db.Database.GetAppliedMigrationsAsync()).ToList();
            await db.Database.CloseConnectionAsync();
            return (db.Database.GetConnectionString(), p, b, m);
        });

        Assert.Equal(Api.ConnectionString, cs);
        Assert.Equal("jotanunes_docs_testes", banco);
        Assert.NotEqual(5432, porta);
        Assert.Contains(migrations, m => m.EndsWith("_Inicial", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Dados_gravados_pela_api_aparecem_no_banco_do_container()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "Tipo prova de banco" });
        Assert.Equal(System.Net.HttpStatusCode.Created, r.StatusCode);

        await using var conn = new NpgsqlConnection(Api.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT count(*) FROM tipos_documento WHERE nome = 'Tipo prova de banco'", conn);
        Assert.Equal(1L, (long)(await cmd.ExecuteScalarAsync())!);
    }

    [Fact]
    public void Configuracao_de_teste_sobrescreve_appsettings()
    {
        var cfg = Api.Services.GetRequiredService<IConfiguration>();
        Assert.Equal(ApiFactory.SegredoFluig, cfg["Auth:Fluig:Secret"]);
        Assert.Equal(ApiFactory.SegredoPortal, cfg["Auth:Portal:Secret"]);
        Assert.Equal(Api.ConnectionString, cfg.GetConnectionString("Default"));
        var armazenamento = (ArmazenamentoDiscoLocal)Api.Services.GetRequiredService<Application.Portas.IArmazenamentoArquivos>();
        Assert.Equal(Path.GetFullPath(Api.DiretorioArquivos), armazenamento.Raiz);
        Assert.True(Api.Services.GetRequiredService<IHostEnvironment>().IsDevelopment());
    }
}
