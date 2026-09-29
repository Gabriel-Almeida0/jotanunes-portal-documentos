using System.Net;
using System.Text.Json;
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
}
