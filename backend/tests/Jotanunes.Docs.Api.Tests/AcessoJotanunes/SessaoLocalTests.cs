using Jotanunes.Docs.Api.Tests.Autorizacao;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.AcessoJotanunes;

/// <summary>Troca de senha obrigatória/voluntária e saída do login próprio (US8; FR-102, FR-105, FR-106).</summary>
public class SessaoLocalTests(ApiFactory api) : TesteApi(api)
{
    private const string SenhaNova = "NovaSenha42";

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Com_troca_pendente_so_me_trocar_senha_e_sair_respondem(bool ehAdmin)
    {
        // Comum pendente numa rota de administrador: TROCA_SENHA_OBRIGATORIA vence SEM_PERMISSAO (sem PERMISSAO_NEGADA).
        var admin = await Semente.UsuarioInternoAsync("novo.usuario", admin: ehAdmin, trocaSenhaObrigatoria: true);
        var token = await FluxoLoginLocal.EntrarAsync(Api, "novo.usuario");
        var cliente = Api.Cliente(token: token);

        var me = await cliente.GetAsync("/api/fluig/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.True((await me.LerAsync()).GetProperty("trocaSenhaObrigatoria").GetBoolean());

        var bloqueadas = Rota.Registradas(Api)
            .Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal)
                        && !PerfilAdminTests.Anonimas.Contains(r) && !PerfilAdminTests.Sessao.Contains(r))
            .ToList();
        Assert.True(bloqueadas.Count >= 25, $"achou {bloqueadas.Count}");
        var falhas = new List<string>();
        foreach (var rota in bloqueadas)
        {
            var r = await cliente.SendAsync(rota.Requisicao(token: null));
            if (r.StatusCode != HttpStatusCode.Forbidden || await r.CodigoAsync() != "TROCA_SENHA_OBRIGATORIA") falhas.Add($"{rota} → {(int)r.StatusCode}");
        }
        Assert.Empty(falhas);
        // Rotas de administrador com admin pendente: TROCA_SENHA_OBRIGATORIA tem precedência e não gera PERMISSAO_NEGADA.
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "PERMISSAO_NEGADA")));
        Assert.Equal(admin.VersaoCredencial, (await Semente.RecarregarUsuarioAsync(admin.Id)).VersaoCredencial);
    }

    [Fact]
    public async Task Troca_obrigatoria_valida_senha_e_devolve_token_novo()
    {
        var u = await Semente.UsuarioInternoAsync("nina.nova", trocaSenhaObrigatoria: true);
        var token = await FluxoLoginLocal.EntrarAsync(Api, "nina.nova");

        var fraca = await FluxoLoginLocal.TrocarSenhaAsync(Api, token, Semente.SenhaPadrao, "fraca");
        Assert.Equal(HttpStatusCode.BadRequest, fraca.StatusCode);
        Assert.Equal("SENHA_FRACA", await fraca.CodigoAsync());
        var igual = await FluxoLoginLocal.TrocarSenhaAsync(Api, token, Semente.SenhaPadrao, Semente.SenhaPadrao);
        Assert.Equal("SENHA_FRACA", await igual.CodigoAsync());
        var atualErrada = await FluxoLoginLocal.TrocarSenhaAsync(Api, token, "NaoEhEssa123", SenhaNova);
        Assert.Equal(HttpStatusCode.BadRequest, atualErrada.StatusCode);
        Assert.Equal("SENHA_ATUAL_INCORRETA", await atualErrada.CodigoAsync());
        var vazia = await Api.Cliente(token: token).PostAsJsonAsync("/api/fluig/auth/trocar-senha", new { });
        Assert.Equal("VALIDACAO", await vazia.CodigoAsync());

        var ok = await FluxoLoginLocal.TrocarSenhaAsync(Api, token, Semente.SenhaPadrao, SenhaNova);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var sessao = await ok.LerAsync();
        var novoToken = sessao.Str("accessToken");
        Assert.False(FluxoLoginLocal.Payload(novoToken).GetProperty("troca_senha").GetBoolean());
        Assert.False(sessao.GetProperty("usuario").GetProperty("trocaSenhaObrigatoria").GetBoolean());
        Assert.Equal("LOGIN_LOCAL", sessao.GetProperty("usuario").Str("origem"));

        // Token anterior revogado; o novo abre a área Jotanunes.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: token).GetAsync("/api/fluig/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: novoToken).GetAsync("/api/fluig/painel")).StatusCode);
        // A senha provisória não entra mais; a nova entra.
        Assert.Equal(HttpStatusCode.Unauthorized, (await FluxoLoginLocal.LoginAsync(Api, "nina.nova", Semente.SenhaPadrao)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.LoginAsync(Api, "nina.nova", SenhaNova)).StatusCode);

        var linha = await AuditoriaTeste.UnicaAsync(Api, "SENHA_TROCADA");
        Assert.Equal(("LOCAL", "nina.nova", "USUARIO_INTERNO", u.Id.ToString()), (linha.AtorTipo, linha.AtorId, linha.RecursoTipo, linha.RecursoId));
        await AuditoriaTeste.SemSegredosAsync(Api, [SenhaNova, Semente.SenhaPadrao, novoToken]);
    }

    [Fact]
    public async Task Troca_voluntaria_funciona_igual()
    {
        await Semente.UsuarioInternoAsync("vitor.ativo");
        var token = await FluxoLoginLocal.EntrarAsync(Api, "vitor.ativo");
        var ok = await FluxoLoginLocal.TrocarSenhaAsync(Api, token, Semente.SenhaPadrao, SenhaNova);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: token).GetAsync("/api/fluig/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.LoginAsync(Api, "vitor.ativo", SenhaNova)).StatusCode);
    }

    [Fact]
    public async Task Trocar_senha_com_token_do_fluig_409_SO_LOGIN_LOCAL()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/auth/trocar-senha", new { senhaAtual = "Qualquer123", novaSenha = SenhaNova });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("SO_LOGIN_LOCAL", await r.CodigoAsync());
        Assert.Equal("Esta opção é só para quem entra com login e senha.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Sair_revoga_o_token_na_hora()
    {
        var u = await Semente.UsuarioInternoAsync("saulo.sai");
        var token = await FluxoLoginLocal.EntrarAsync(Api, "saulo.sai");
        var outraAba = await FluxoLoginLocal.EntrarAsync(Api, "saulo.sai");
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/fluig/me")).StatusCode);

        var sair = await Api.Cliente(token: token).PostAsync("/api/fluig/auth/sair", null);
        Assert.Equal(HttpStatusCode.NoContent, sair.StatusCode);
        var depois = await Api.Cliente(token: token).GetAsync("/api/fluig/me");
        Assert.Equal(HttpStatusCode.Unauthorized, depois.StatusCode);
        Assert.Equal("NAO_AUTENTICADO", await depois.CodigoAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: outraAba).GetAsync("/api/fluig/me")).StatusCode);

        var linha = await AuditoriaTeste.UnicaAsync(Api, "SESSAO_ENCERRADA");
        Assert.Equal(("LOCAL", "saulo.sai", "USUARIO_INTERNO", u.Id.ToString()), (linha.AtorTipo, linha.AtorId, linha.RecursoTipo, linha.RecursoId));
    }

    [Fact]
    public async Task Sair_com_troca_pendente_204()
    {
        await Semente.UsuarioInternoAsync("pedro.pendente", trocaSenhaObrigatoria: true);
        var token = await FluxoLoginLocal.EntrarAsync(Api, "pedro.pendente");
        Assert.Equal(HttpStatusCode.NoContent, (await Api.Cliente(token: token).PostAsync("/api/fluig/auth/sair", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: token).GetAsync("/api/fluig/me")).StatusCode);
    }

    [Fact]
    public async Task Sair_com_token_do_fluig_204_sem_efeito()
    {
        var token = Tokens.Fluig(Api);
        Assert.Equal(HttpStatusCode.NoContent, (await Api.Cliente(token: token).PostAsync("/api/fluig/auth/sair", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/fluig/me")).StatusCode);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync()));
    }
}
