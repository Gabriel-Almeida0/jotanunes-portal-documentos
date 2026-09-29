using System.Net.Http.Headers;
using System.Net.Http.Json;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Portas;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Infrastructure.Email;

/// <summary>Configuração do Resend (seção Resend). Nunca commitar a chave.</summary>
public sealed class OpcoesResend
{
    public string? ApiKey { get; set; }
    public string? From { get; set; }
}

/// <summary>Envia pelo Resend (POST https://api.resend.com/emails).</summary>
public sealed class ResendEnviadorEmail(HttpClient http, IOptions<OpcoesResend> opcoes) : IEnviadorEmail
{
    /// <summary>Logo da Jotanunes como anexo inline (Resend: <c>content_id</c> referenciado por <c>cid:</c> no HTML).</summary>
    private static readonly Lazy<object> LogoInline = new(() =>
    {
        const string recurso = "Jotanunes.Docs.Infrastructure.Email.logo-jotanunes.png";
        using var stream = typeof(ResendEnviadorEmail).Assembly.GetManifestResourceStream(recurso)
            ?? throw new InvalidOperationException($"Recurso {recurso} não encontrado.");
        using var memoria = new MemoryStream();
        stream.CopyTo(memoria);
        return new
        {
            filename = "logo-jotanunes.png",
            content_id = ModelosEmail.LogoContentId,
            content_type = "image/png",
            content = Convert.ToBase64String(memoria.ToArray()),
        };
    });

    public async Task EnviarAsync(MensagemEmail m, CancellationToken ct = default)
    {
        var o = opcoes.Value;
        using var req = new HttpRequestMessage(HttpMethod.Post, "emails")
        {
            Content = JsonContent.Create(new
            {
                from = o.From,
                to = new[] { m.Para },
                subject = m.Assunto,
                html = m.Html,
                text = m.Texto,
                attachments = m.Html.Contains($"cid:{ModelosEmail.LogoContentId}", StringComparison.Ordinal)
                    ? new[] { LogoInline.Value }
                    : Array.Empty<object>(),
            }),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", o.ApiKey);
        HttpResponseMessage resp;
        try
        {
            resp = await http.SendAsync(req, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new FalhaEnvioEmail("O provedor de e-mail não respondeu.", ex);
        }
        using (resp)
        {
            if (!resp.IsSuccessStatusCode) throw new FalhaEnvioEmail($"O provedor de e-mail recusou o envio (HTTP {(int)resp.StatusCode}).");
        }
    }
}

/// <summary>
/// Adaptador de DESENVOLVIMENTO (sem chave do Resend): registra o e-mail no log, incluindo o corpo
/// (link do convite e senha temporária). Exceção explícita da constituição (princípio III); só em Development.
/// </summary>
public sealed class LogEnviadorEmail(ILogger<LogEnviadorEmail> log) : IEnviadorEmail
{
    public Task EnviarAsync(MensagemEmail m, CancellationToken ct = default)
    {
        log.LogInformation("E-mail de desenvolvimento (não enviado)\nPara: {Para}\nAssunto: {Assunto}\n\n{Texto}", m.Para, m.Assunto, m.Texto);
        return Task.CompletedTask;
    }
}
