namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>Toda rota /api/fluig/* registrada exige o token Fluig: sem token e com token do portal → 401.</summary>
public class FluigRotasTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Todas_as_rotas_fluig_recusam_sem_token_e_com_token_do_portal()
    {
        var rotas = Rota.Registradas(Api).Where(r => r.Padrao.StartsWith("/api/fluig/", StringComparison.Ordinal)).ToList();
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
}
