using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US1 (003): periodicidade do tipo de documento.</summary>
public class TiposPeriodicidadeTests(ApiFactory api) : TesteApi(api)
{
    private const string Url = "/api/fluig/tipos-documento";

    [Fact]
    public async Task Criar_sem_periodicidade_nasce_unica()
    {
        var r = await Fluig().PostAsJsonAsync(Url, new { nome = "Cartão CNPJ", abrangencia = "GERAL" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var p = (await r.LerAsync()).GetProperty("periodicidade");
        Assert.Equal("UNICA", p.Str("unidade"));
        Assert.Equal(JsonValueKind.Null, p.GetProperty("intervalo").ValueKind);
        Assert.Equal(JsonValueKind.Null, p.GetProperty("prazoDias").ValueKind);
        Assert.Equal("Único", p.Str("descricao"));
        var salvo = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().SingleAsync());
        Assert.Equal(salvo.CriadoEm, salvo.CobrancaDesde);
    }

    [Fact]
    public async Task Criar_mensal_e_a_cada_n_dias_com_descricao()
    {
        var c = Fluig();
        var mensal = await c.PostAsJsonAsync(Url, new { nome = "Guia do FGTS", abrangencia = "GERAL", periodicidade = new { unidade = "MESES", intervalo = 1, prazoDias = 15 } });
        Assert.Equal(HttpStatusCode.Created, mensal.StatusCode);
        var p = (await mensal.LerAsync()).GetProperty("periodicidade");
        Assert.Equal(("MESES", 1, 15), (p.Str("unidade"), p.GetProperty("intervalo").GetInt32(), p.GetProperty("prazoDias").GetInt32()));
        Assert.Equal("Mensal · até o dia 15 do mês seguinte", p.Str("descricao"));

        var dias = await c.PostAsJsonAsync(Url, new { nome = "Relatório de 30 dias", abrangencia = "POR_OBRA", periodicidade = new { unidade = "DIAS", intervalo = 30, prazoDias = 5 } });
        Assert.Equal(HttpStatusCode.Created, dias.StatusCode);
        Assert.Equal("A cada 30 dias · até 5 dias após o fim do período", (await dias.LerAsync()).GetProperty("periodicidade").Str("descricao"));
    }

    [Theory]
    [InlineData("MESES", 25, 15, "periodicidade.intervalo")]
    [InlineData("MESES", 0, 15, "periodicidade.intervalo")]
    [InlineData("DIAS", 366, 15, "periodicidade.intervalo")]
    [InlineData("MESES", 1, 91, "periodicidade.prazoDias")]
    [InlineData("DIAS", 10, -1, "periodicidade.prazoDias")]
    [InlineData("SEMANAS", 1, 1, "periodicidade.unidade")]
    public async Task Fora_da_faixa_400(string unidade, int intervalo, int prazo, string campo)
    {
        var r = await Fluig().PostAsJsonAsync(Url, new { nome = "Guia do FGTS", abrangencia = "GERAL", periodicidade = new { unidade, intervalo, prazoDias = prazo } });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
        Assert.True((await r.LerAsync()).GetProperty("errors").TryGetProperty(campo, out _), campo);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.TiposDocumento.CountAsync()));
    }

    [Fact]
    public async Task Filtro_periodico()
    {
        await Semente.TipoAsync("Cartão CNPJ");
        await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 15));
        await Semente.TipoPeriodicoAsync("Relatório trimestral", Periodicidade.Meses(3, 10), abrangencia: Abrangencia.POR_OBRA);
        var c = Fluig();
        async Task<string[]> Nomes(string q) =>
            (await (await c.GetAsync(Url + q)).LerAsync()).EnumerateArray().Select(t => t.Str("nome")).ToArray();
        Assert.Equal(new[] { "Guia do FGTS", "Relatório trimestral" }, await Nomes("?periodico=true"));
        Assert.Equal(new[] { "Cartão CNPJ" }, await Nomes("?periodico=false"));
        Assert.Equal(new[] { "Guia do FGTS" }, await Nomes("?periodico=true&abrangencia=GERAL"));
        Assert.Equal(3, (await Nomes("")).Length);
    }

    [Fact]
    public async Task Mudar_regra_com_envio_409_e_prazo_muda_sempre_com_auditoria()
    {
        var empresa = await Semente.EmpresaAsync();
        var tipo = await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 15));
        await Semente.EnvioAsync(empresa, tipo, periodoInicio: new DateOnly(Semente.Hoje.Year, Semente.Hoje.Month, 1));
        var c = Fluig("ana.admin");

        var unica = await c.PutAsJsonAsync($"{Url}/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = true, periodicidade = new { unidade = "UNICA" } });
        Assert.Equal(HttpStatusCode.Conflict, unica.StatusCode);
        Assert.Equal("PERIODICIDADE_IMUTAVEL", await unica.CodigoAsync());
        var trimestral = await c.PutAsJsonAsync($"{Url}/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = true, periodicidade = new { unidade = "MESES", intervalo = 3, prazoDias = 15 } });
        Assert.Equal("PERIODICIDADE_IMUTAVEL", await trimestral.CodigoAsync());
        Assert.Empty(await AuditoriaTeste.LinhasAsync(Api, AcaoAuditoria.TipoPeriodicidadeAlterada));

        var prazo = await c.PutAsJsonAsync($"{Url}/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = true, periodicidade = new { unidade = "MESES", intervalo = 1, prazoDias = 20 } });
        Assert.Equal(HttpStatusCode.OK, prazo.StatusCode);
        Assert.Equal("Mensal · até o dia 20 do mês seguinte", (await prazo.LerAsync()).GetProperty("periodicidade").Str("descricao"));
        var linha = await AuditoriaTeste.UnicaAsync(Api, AcaoAuditoria.TipoPeriodicidadeAlterada);
        Assert.Equal(("TIPO_DOCUMENTO", tipo.Id.ToString(), "ana.admin"), (linha.RecursoTipo, linha.RecursoId, linha.AtorId));
    }

    [Fact]
    public async Task Put_sem_periodicidade_mantem_a_atual()
    {
        var empresa = await Semente.EmpresaAsync();
        var tipo = await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 15));
        await Semente.EnvioAsync(empresa, tipo, periodoInicio: new DateOnly(Semente.Hoje.Year, Semente.Hoje.Month, 1));
        var r = await Fluig().PutAsJsonAsync($"{Url}/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = false });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var p = (await r.LerAsync()).GetProperty("periodicidade");
        Assert.Equal(("MESES", 1, 15), (p.Str("unidade"), p.GetProperty("intervalo").GetInt32(), p.GetProperty("prazoDias").GetInt32()));
        Assert.Empty(await AuditoriaTeste.LinhasAsync(Api, AcaoAuditoria.TipoPeriodicidadeAlterada));
    }

    [Fact]
    public async Task Sem_envios_muda_a_regra_e_unica_para_periodica_recomeca_a_cobranca()
    {
        var tipo = await Semente.TipoAsync("Guia do FGTS", criadoEm: Semente.Agora.AddDays(-100));
        Api.Relogio.Advance(TimeSpan.FromMinutes(1));
        var r = await Fluig().PutAsJsonAsync($"{Url}/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = true, periodicidade = new { unidade = "MESES", intervalo = 1, prazoDias = 15 } });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var salvo = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().SingleAsync());
        Assert.True(salvo.CobrancaDesde > Semente.Agora.AddMinutes(-1));
        Assert.Equal(UnidadePeriodicidade.MESES, salvo.PeriodicidadeUnidade);
        Assert.Single(await AuditoriaTeste.LinhasAsync(Api, AcaoAuditoria.TipoPeriodicidadeAlterada));
    }

    [Fact]
    public async Task Reativar_atualiza_cobranca_desde()
    {
        var tipo = await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 15), Semente.Agora.AddDays(-90), ativo: false);
        var antes = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().SingleAsync());
        var r = await Fluig().PutAsJsonAsync($"{Url}/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = true });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var depois = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().SingleAsync());
        Assert.True(depois.CobrancaDesde > antes.CobrancaDesde.AddDays(80));
    }

    [Fact]
    public async Task Tipos_existentes_e_envios_unicos_continuam_iguais()
    {
        var empresa = await Semente.EmpresaAsync();
        var tipo = await Semente.TipoAsync("Cartão CNPJ");
        await Semente.EnvioAsync(empresa, tipo, StatusEnvio.APROVADO);
        var docs = (await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos")).LerAsync()).EnumerateArray().ToList();
        var d = Assert.Single(docs);
        Assert.Equal("APROVADO", d.Str("situacao"));
        Assert.False(d.GetProperty("atrasado").GetBoolean());
        Assert.Equal(JsonValueKind.Null, d.GetProperty("periodos").ValueKind);
        Assert.Equal(JsonValueKind.Null, d.GetProperty("envioAtual").GetProperty("periodo").ValueKind);
        Assert.False(d.GetProperty("envioAtual").GetProperty("enviadoComAtraso").GetBoolean());
        Assert.Equal("UNICA", d.GetProperty("tipoDocumento").GetProperty("periodicidade").Str("unidade"));
    }
}
