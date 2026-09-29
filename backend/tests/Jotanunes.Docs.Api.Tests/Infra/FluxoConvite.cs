using System.Text.RegularExpressions;
using Jotanunes.Docs.Application.Portas;

namespace Jotanunes.Docs.Api.Tests.Infra;

public sealed record ConviteRecebido(MensagemEmail Email, string Token, string Senha, string Link);

public static partial class FluxoConvite
{
    /// <summary>Envia o convite pela API (Fluig) e extrai link/token/senha do e-mail falso.</summary>
    public static async Task<ConviteRecebido> ConvidarAsync(ApiFactory api, Guid empresaId)
    {
        var antes = api.Emails.Mensagens.Count;
        var r = await api.Cliente(token: Tokens.Fluig(api)).PostAsync($"/api/fluig/empresas/{empresaId}/convites", null);
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var email = api.Emails.Mensagens[antes];
        var link = Link().Match(email.Texto).Value;
        var token = link[(link.IndexOf("convite=", StringComparison.Ordinal) + "convite=".Length)..];
        var senha = Senha().Match(email.Texto).Groups[1].Value;
        return new ConviteRecebido(email, token, senha, link);
    }

    public static async Task<HttpResponseMessage> LoginAsync(ApiFactory api, string cnpj, string senha, string? ip = null) =>
        await api.Cliente(ip).PostAsJsonAsync("/api/portal/auth/login", new { cnpj, senha });

    /// <summary>Convida, entra com a senha temporária e troca a senha. Devolve o token final.</summary>
    public static async Task<string> PrimeiroAcessoAsync(ApiFactory api, Guid empresaId, string cnpj, string novaSenha = "Alfa2026ok")
    {
        var convite = await ConvidarAsync(api, empresaId);
        var login = await (await LoginAsync(api, cnpj, convite.Senha)).LerAsync();
        var troca = await api.Cliente(token: login.Str("accessToken"))
            .PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = convite.Senha, novaSenha });
        Assert.Equal(HttpStatusCode.OK, troca.StatusCode);
        return (await troca.LerAsync()).Str("accessToken");
    }

    [GeneratedRegex(@"https?://\S+/acesso\?convite=[A-Za-z0-9_\-]+")]
    private static partial Regex Link();

    [GeneratedRegex(@"Senha temporária: (\S+)")]
    private static partial Regex Senha();
}
