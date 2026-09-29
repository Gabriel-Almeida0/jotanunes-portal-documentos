using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>
/// Auditoria com perfil (FR-061, FR-085, US6/AC8): linhas de usuário Fluig dizem se ele era administrador; a tentativa
/// negada fica registrada como PERMISSAO_NEGADA; linhas do portal não têm perfil (ator_admin nulo).
/// </summary>
public class AuditoriaPerfilTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Comum_criando_tipo_grava_permissao_negada_sem_corpo_nem_token()
    {
        var token = Tokens.FluigComum(Api);
        var r = await Api.Cliente(token: token).PostAsJsonAsync("/api/fluig/tipos-documento",
            new { nome = "Tipo secreto do comum", instrucoes = "Instrução secreta do comum" });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);

        var linha = Assert.Single(await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().ToListAsync()));
        Assert.Equal("PERMISSAO_NEGADA", linha.Acao);
        Assert.Equal("FLUIG", linha.AtorTipo);
        Assert.Equal("joao.comum", linha.AtorId);
        Assert.False(linha.AtorAdmin);
        Assert.Equal("OPERACAO", linha.RecursoTipo);
        Assert.Equal("fluigCriarTipoDocumento", linha.RecursoId);
        Assert.NotNull(linha.Ip);
        await AuditoriaTeste.SemSegredosAsync(Api, [token, "Tipo secreto do comum", "Instrução secreta do comum"]);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.TiposDocumento.CountAsync()));
    }

    [Fact]
    public async Task Convite_e_download_pelo_comum_gravam_ator_admin_false()
    {
        var empresa = await Semente.EmpresaAsync();
        var tipo = await Semente.TipoAsync();
        var envio = await Semente.EnvioAsync(empresa, tipo);
        var comum = Api.Cliente(token: Tokens.FluigComum(Api));

        Assert.Equal(HttpStatusCode.Created, (await comum.PostAsync($"/api/fluig/empresas/{empresa.Id}/convites", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await comum.GetAsync($"/api/fluig/envios/{envio.Id}/arquivo")).StatusCode);

        foreach (var acao in new[] { "CONVITE_ENVIADO", "ARQUIVO_BAIXADO" })
        {
            var linha = await AuditoriaTeste.UnicaAsync(Api, acao);
            Assert.Equal("FLUIG", linha.AtorTipo);
            Assert.Equal("joao.comum", linha.AtorId);
            Assert.False(linha.AtorAdmin, acao);
        }
    }

    [Fact]
    public async Task Decisoes_e_download_pelo_admin_gravam_ator_admin_true()
    {
        var empresa = await Semente.EmpresaAsync();
        var aprovar = await Semente.EnvioAsync(empresa, await Semente.TipoAsync());
        var rejeitar = await Semente.EnvioAsync(empresa, await Semente.TipoAsync());
        var admin = Api.Cliente(token: Tokens.Fluig(Api, "ana.admin", "Ana Admin"));

        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/fluig/envios/{aprovar.Id}/arquivo")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/fluig/envios/{aprovar.Id}/aprovar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/fluig/envios/{rejeitar.Id}/rejeitar", new { motivo = "Documento ilegível" })).StatusCode);

        foreach (var acao in new[] { "ARQUIVO_BAIXADO", "ENVIO_APROVADO", "ENVIO_REJEITADO" })
        {
            var linha = await AuditoriaTeste.UnicaAsync(Api, acao);
            Assert.Equal("ana.admin", linha.AtorId);
            Assert.True(linha.AtorAdmin, acao);
        }
    }

    [Fact]
    public async Task Linhas_do_portal_nao_tem_perfil()
    {
        var empresa = await Semente.EmpresaAsync();
        var tipo = await Semente.TipoAsync();
        await FluxoConvite.LoginAsync(Api, empresa.Cnpj, "SenhaErrada1");
        var token = await FluxoConvite.PrimeiroAcessoAsync(Api, empresa.Id, empresa.Cnpj);
        var envio = await Api.Cliente(token: token).PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()));
        Assert.Equal(HttpStatusCode.Created, envio.StatusCode);

        var linhas = await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().Where(a => a.AtorTipo != "FLUIG").ToListAsync());
        Assert.Contains(linhas, l => l.Acao == "LOGIN_FALHA");
        Assert.Contains(linhas, l => l.Acao == "LOGIN_SUCESSO");
        Assert.Contains(linhas, l => l.Acao == "DOCUMENTO_ENVIADO");
        Assert.All(linhas, l => Assert.Null(l.AtorAdmin));

        // O convite do fluxo foi enviado pelo token padrão dos testes (administrador).
        Assert.True((await AuditoriaTeste.UnicaAsync(Api, "CONVITE_ENVIADO")).AtorAdmin);
    }

    [Fact]
    public async Task Comum_do_login_proprio_grava_permissao_negada_como_LOCAL()
    {
        var comum = await Semente.UsuarioInternoAsync("rita.comum", "Rita Comum");
        var r = await Local(comum).PostAsJsonAsync("/api/fluig/obras", new { nome = "Obra do comum", cidade = "Aracaju", uf = "SE" });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);

        var linha = await AuditoriaTeste.UnicaAsync(Api, "PERMISSAO_NEGADA");
        Assert.Equal("LOCAL", linha.AtorTipo);
        Assert.Equal("rita.comum", linha.AtorId);
        Assert.False(linha.AtorAdmin);
        Assert.Equal("fluigCriarObra", linha.RecursoId);
    }

    [Fact]
    public async Task Acoes_do_admin_do_login_proprio_gravam_LOCAL_com_ator_admin_true()
    {
        var admin = await Semente.UsuarioInternoAsync("beto.admin", "Beto Admin", admin: true);
        var empresa = await Semente.EmpresaAsync();
        var envio = await Semente.EnvioAsync(empresa, await Semente.TipoAsync());
        Assert.Equal(HttpStatusCode.OK, (await Local(admin).PostAsync($"/api/fluig/envios/{envio.Id}/aprovar", null)).StatusCode);

        var linha = await AuditoriaTeste.UnicaAsync(Api, "ENVIO_APROVADO");
        Assert.Equal("LOCAL", linha.AtorTipo);
        Assert.Equal("beto.admin", linha.AtorId);
        Assert.True(linha.AtorAdmin);
    }
}
