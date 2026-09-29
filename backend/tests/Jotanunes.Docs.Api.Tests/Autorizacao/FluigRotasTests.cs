namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>
/// Toda rota /api/fluig/* registrada exige o token da área Jotanunes (Fluig ou login próprio): sem token e com token do
/// portal → 401. As únicas exceções são as rotas anônimas do login próprio (<see cref="PerfilAdminTests.Anonimas"/>).
/// </summary>
public class FluigRotasTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Todas_as_rotas_fluig_recusam_sem_token_e_com_token_do_portal()
    {
        var rotas = Rota.Registradas(Api)
            .Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal) && !PerfilAdminTests.Anonimas.Contains(r))
            .ToList();
        Assert.True(rotas.Count >= 25, $"esperava as rotas Fluig do contrato, achou {rotas.Count}");
        var (_, tokenPortal) = await Semente.EmpresaComAcessoAsync();
        var cliente = Anonimo();
        var falhas = new List<string>();
        foreach (var rota in rotas)
        {
            foreach (var (caso, token) in new[] { ("sem token", (string?)null), ("token do portal", tokenPortal) })
            {
                var r = await cliente.SendAsync(rota.Requisicao(token));
                if (r.StatusCode != HttpStatusCode.Unauthorized || await r.CodigoAsync() != "NAO_AUTENTICADO")
                {
                    falhas.Add($"{rota} ({caso}) → {(int)r.StatusCode}");
                }
            }
        }
        Assert.Empty(falhas);
    }

    [Fact]
    public async Task As_rotas_anonimas_sao_exatamente_as_do_login_proprio()
    {
        var anonimas = new List<Rota>();
        foreach (var rota in Rota.Registradas(Api).Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal)))
        {
            var r = await Anonimo().SendAsync(rota.Requisicao(token: null));
            if (r.StatusCode != HttpStatusCode.Unauthorized) anonimas.Add(rota);
        }
        Assert.Equal(PerfilAdminTests.Anonimas.OrderBy(r => r.ToString()), anonimas.OrderBy(r => r.ToString()));
    }
}
