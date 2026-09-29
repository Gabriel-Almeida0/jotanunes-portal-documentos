using System.Net;
using System.Text.Json;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.Tests.Adaptadores;

public class ResendEnviadorEmailTests
{
    private sealed class Handler(HttpStatusCode status) : HttpMessageHandler
    {
        public HttpRequestMessage? Requisicao { get; private set; }
        public string? Corpo { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requisicao = request;
            Corpo = await request.Content!.ReadAsStringAsync(ct);
            return new HttpResponseMessage(status);
        }
    }

    private static (ResendEnviadorEmail, Handler) Criar(HttpStatusCode status)
    {
        var h = new Handler(status);
        var http = new HttpClient(h) { BaseAddress = new Uri("https://api.resend.com/") };
        return (new ResendEnviadorEmail(http, Options.Create(new OpcoesResend { ApiKey = "re_chave", From = "Jotanunes <docs@j.test>" })), h);
    }

    [Fact]
    public async Task Envia_post_com_bearer_e_campos()
    {
        var (enviador, h) = Criar(HttpStatusCode.OK);
        await enviador.EnviarAsync(new MensagemEmail("a@b.test", "Assunto", "<p>html</p>", "texto"));
        Assert.Equal(HttpMethod.Post, h.Requisicao!.Method);
        Assert.Equal("https://api.resend.com/emails", h.Requisicao.RequestUri!.ToString());
        Assert.Equal("Bearer re_chave", h.Requisicao.Headers.Authorization!.ToString());
        var json = JsonDocument.Parse(h.Corpo!).RootElement;
        Assert.Equal("Jotanunes <docs@j.test>", json.GetProperty("from").GetString());
        Assert.Equal("a@b.test", json.GetProperty("to")[0].GetString());
        Assert.Equal("Assunto", json.GetProperty("subject").GetString());
        Assert.Equal("<p>html</p>", json.GetProperty("html").GetString());
        Assert.Equal("texto", json.GetProperty("text").GetString());
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.UnprocessableEntity)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task Resposta_nao_2xx_vira_falha(HttpStatusCode status)
    {
        var (enviador, _) = Criar(status);
        await Assert.ThrowsAsync<FalhaEnvioEmail>(() => enviador.EnviarAsync(new MensagemEmail("a@b.test", "A", "h", "t")));
    }

    [Fact]
    public async Task Anexa_logo_inline_quando_o_html_usa_o_cid()
    {
        var (enviador, h) = Criar(HttpStatusCode.OK);
        var convite = ModelosEmail.Convite("a@b.test", "Alfa Ltda", "11.222.333/0001-81", ["Obra A"],
            "http://localhost:5174/acesso?convite=x", "Senha123abc", DateTimeOffset.UtcNow.AddDays(7));
        Assert.Contains($"cid:{ModelosEmail.LogoContentId}", convite.Html);

        await enviador.EnviarAsync(convite);

        var anexo = Assert.Single(JsonDocument.Parse(h.Corpo!).RootElement.GetProperty("attachments").EnumerateArray());
        Assert.Equal(ModelosEmail.LogoContentId, anexo.GetProperty("content_id").GetString());
        Assert.Equal("image/png", anexo.GetProperty("content_type").GetString());
        var png = Convert.FromBase64String(anexo.GetProperty("content").GetString()!);
        Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47 }, png[..4]);
    }

    [Fact]
    public async Task Sem_cid_no_html_nao_anexa_nada()
    {
        var (enviador, h) = Criar(HttpStatusCode.OK);
        await enviador.EnviarAsync(new MensagemEmail("a@b.test", "A", "<p>sem logo</p>", "t"));
        Assert.Empty(JsonDocument.Parse(h.Corpo!).RootElement.GetProperty("attachments").EnumerateArray());
    }

    [Fact]
    public void Rejeicao_tambem_mostra_o_logo() =>
        Assert.Contains($"cid:{ModelosEmail.LogoContentId}",
            ModelosEmail.Rejeicao("a@b.test", "Alfa", "Cartão CNPJ", "Ilegível", "http://x").Html);
}
