namespace Jotanunes.Docs.Api.Tests.Seguranca;

/// <summary>
/// Login e troca de senha nunca escrevem senhas nem tokens no log (mesmo com Debug ligado). O token do convite vai
/// no caminho da URL (contrato), por isso appsettings rebaixa os logs de requisição/roteamento que registram o caminho.
/// </summary>
public class LogsTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Login_e_troca_de_senha_nao_logam_segredos()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        Api.Logs.Limpar();

        await FluxoConvite.LoginAsync(Api, empresa.Cnpj, "SenhaErradaXyz9");
        var sessao = await (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha)).LerAsync();
        var token = sessao.Str("accessToken");
        var troca = await (await Api.Cliente(token: token).PostAsJsonAsync("/api/portal/auth/trocar-senha",
            new { senhaAtual = convite.Senha, novaSenha = "NovaSenhaSecreta42" })).LerAsync();
        await Api.Cliente(token: token).PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = "x", novaSenha = "fraca" });
        await Anonimo().GetAsync($"/api/portal/convites/{convite.Token}");

        var logs = string.Join("\n", Api.Logs.Linhas);
        Assert.NotEmpty(Api.Logs.Linhas);
        foreach (var segredo in new[] { "SenhaErradaXyz9", convite.Senha, "NovaSenhaSecreta42", token, troca.Str("accessToken"), convite.Token, ApiFactory.SegredoPortal })
        {
            Assert.DoesNotContain(segredo, logs);
        }
    }

    [Fact]
    public async Task Erro_interno_nao_expoe_stack_trace()
    {
        // Envio com arquivo apagado do disco → exceção de IO não tratada → 500 ERRO_INTERNO sem detalhes.
        var empresa = await Semente.EmpresaAsync();
        var envio = await Semente.EnvioAsync(empresa, await Semente.TipoAsync());
        File.Delete(Path.Combine(Api.DiretorioArquivos, envio.ChaveArmazenamento));
        var r = await Fluig().GetAsync($"/api/fluig/envios/{envio.Id}/arquivo");
        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal("ERRO_INTERNO", await r.CodigoAsync());
        var corpo = await r.Content.ReadAsStringAsync();
        Assert.DoesNotContain("   at ", corpo);
        Assert.DoesNotContain(Api.DiretorioArquivos, corpo);
        Assert.Equal("Algo deu errado do nosso lado. Tente de novo.", (await r.LerAsync()).Str("title"));
    }
}
