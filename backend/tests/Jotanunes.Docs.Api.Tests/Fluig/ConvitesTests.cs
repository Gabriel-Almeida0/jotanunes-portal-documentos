using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Fluig;

public class ConvitesTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Enviar_convite_manda_email_e_muda_situacao()
    {
        var empresa = await Semente.EmpresaAsync("Alfa Engenharia Ltda", "11222333000181", email: "contato@alfa.test");
        await Semente.VincularAsync(await Semente.ObraAsync("Residencial Vista do Rio"), empresa);
        await Semente.VincularAsync(await Semente.ObraAsync("Edifício Sol"), empresa);

        var r = await Fluig("maria.silva", "Maria Silva").PostAsync($"/api/fluig/empresas/{empresa.Id}/convites", null);
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var corpo = await r.Content.ReadAsStringAsync();
        var c = await r.LerAsync();
        Assert.Equal("contato@alfa.test", c.Str("emailDestino"));
        Assert.Equal("VALIDO", c.Str("situacao"));
        Assert.Equal("maria.silva", c.GetProperty("enviadoPor").Str("login"));
        Assert.Equal("Maria Silva", c.GetProperty("enviadoPor").Str("nome"));
        Assert.Equal(JsonValueKind.Null, c.GetProperty("usadoEm").ValueKind);
        var enviado = c.GetProperty("enviadoEm").GetDateTimeOffset();
        Assert.Equal(enviado.AddDays(7), c.GetProperty("expiraEm").GetDateTimeOffset(), TimeSpan.FromSeconds(1));

        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Equal("contato@alfa.test", email.Para);
        Assert.Equal("Jotanunes: envie os documentos da sua empresa", email.Assunto);
        Assert.Contains($"{ApiFactory.PortalBaseUrl}/acesso?convite=", email.Texto);
        Assert.Contains("Alfa Engenharia Ltda", email.Texto);
        Assert.Contains("Residencial Vista do Rio", email.Texto);
        Assert.Contains("Edifício Sol", email.Texto);
        Assert.Contains("11.222.333/0001-81", email.Texto);
        Assert.Contains("É só clicar no botão abaixo.", email.Texto);
        Assert.Contains("acesso?convite=", email.Html);
        var token = email.Texto.Split("convite=")[1].Split('\n')[0].Trim();
        var senha = email.Texto.Split("Senha temporária: ")[1].Split('\n')[0].Trim();
        Assert.Equal(43, token.Length);
        Assert.Equal(12, senha.Length);
        Assert.Matches("^[A-HJ-NP-Za-km-z2-9]{12}$", senha);

        // resposta não vaza token nem senha
        Assert.DoesNotContain(token, corpo);
        Assert.DoesNotContain(senha, corpo);
        Assert.DoesNotContain("senha", corpo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", corpo, StringComparison.OrdinalIgnoreCase);

        var detalhe = await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}")).LerAsync();
        Assert.Equal("CONVIDADA", detalhe.Str("situacaoAcesso"));
        Assert.False(detalhe.GetProperty("cnpjEditavel").GetBoolean());
        Assert.Equal("VALIDO", detalhe.GetProperty("ultimoConvite").Str("situacao"));
    }

    [Fact]
    public async Task Banco_guarda_so_hashes()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var (tokenHash, senhaHash) = await Api.NoBancoAsync(async db =>
        {
            var c = await db.Convites.AsNoTracking().SingleAsync(x => x.EmpresaId == empresa.Id);
            var e = await db.Empresas.AsNoTracking().SingleAsync(x => x.Id == empresa.Id);
            return (c.TokenHash, e.SenhaHash!);
        });
        Assert.Equal(64, tokenHash.Length);
        Assert.NotEqual(convite.Token, tokenHash);
        Assert.Equal(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(convite.Token))).ToLowerInvariant(), tokenHash);
        Assert.StartsWith("$2", senhaHash);
        Assert.Contains("$12$", senhaHash);
        Assert.DoesNotContain(convite.Senha, senhaHash);
        Assert.True(BCrypt.Net.BCrypt.Verify(convite.Senha, senhaHash));
    }

    [Fact]
    public async Task Reenvio_marca_anterior_substituido_e_lista_em_ordem_decrescente()
    {
        var empresa = await Semente.EmpresaAsync();
        var primeiro = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        await FluxoConvite.ConvidarAsync(Api, empresa.Id);

        var lista = await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}/convites")).LerAsync();
        Assert.Equal(2, lista.GetArrayLength());
        Assert.Equal("VALIDO", lista[0].Str("situacao"));
        Assert.Equal("SUBSTITUIDO", lista[1].Str("situacao"));
        Assert.True(lista[0].GetProperty("enviadoEm").GetDateTimeOffset() > lista[1].GetProperty("enviadoEm").GetDateTimeOffset());

        // o link anterior deixa de valer
        var r = await Anonimo().GetAsync($"/api/portal/convites/{primeiro.Token}");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }

    [Fact]
    public async Task Empresa_inativa_nao_recebe_convite()
    {
        var empresa = await Semente.EmpresaAsync(ativa: false);
        var r = await Fluig().PostAsync($"/api/fluig/empresas/{empresa.Id}/convites", null);
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("EMPRESA_INATIVA", await r.CodigoAsync());
        Assert.Empty(Api.Emails.Mensagens);
    }

    [Fact]
    public async Task Empresa_inexistente_devolve_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Fluig().PostAsync($"/api/fluig/empresas/{Guid.NewGuid()}/convites", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Fluig().GetAsync($"/api/fluig/empresas/{Guid.NewGuid()}/convites")).StatusCode);
    }

    [Fact]
    public async Task Falha_no_email_nao_grava_nada()
    {
        var empresa = await Semente.EmpresaAsync();
        Api.Emails.Falhar = true;
        var r = await Fluig().PostAsync($"/api/fluig/empresas/{empresa.Id}/convites", null);
        Assert.Equal(HttpStatusCode.BadGateway, r.StatusCode);
        Assert.Equal("EMAIL_FALHOU", await r.CodigoAsync());
        Assert.Equal("Não conseguimos enviar o convite. Tente de novo em alguns minutos.", (await r.LerAsync()).Str("title"));

        Assert.Empty(await Semente.ConvitesAsync(empresa.Id));
        var recarregada = await Semente.RecarregarEmpresaAsync(empresa.Id);
        Assert.Null(recarregada.SenhaHash);
        Assert.Equal(0, recarregada.VersaoCredencial);
        var detalhe = await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}")).LerAsync();
        Assert.Equal("NAO_CONVIDADA", detalhe.Str("situacaoAcesso"));
        Assert.True(detalhe.GetProperty("cnpjEditavel").GetBoolean());
    }

    [Fact]
    public async Task Cnpj_nao_pode_mudar_depois_do_convite()
    {
        var empresa = await Semente.EmpresaAsync(cnpj: "11222333000181");
        await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var r = await Fluig().PutAsJsonAsync($"/api/fluig/empresas/{empresa.Id}", new
        {
            razaoSocial = empresa.RazaoSocial, cnpj = "12345678000195", emailContato = empresa.EmailContato, ativa = true,
        });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("CNPJ_IMUTAVEL", await r.CodigoAsync());
    }

    [Fact]
    public async Task Auditoria_registra_convite_sem_segredos()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var registros = await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().ToListAsync());
        var r = Assert.Single(registros, a => a.Acao == "CONVITE_ENVIADO");
        Assert.Equal("FLUIG", r.AtorTipo);
        Assert.Equal("maria.silva", r.AtorId);
        Assert.Equal(empresa.Id.ToString(), r.RecursoId);
        Assert.All(registros, a => Assert.DoesNotContain(convite.Senha, $"{a.AtorId}{a.RecursoId}{a.Ip}"));
    }
}
