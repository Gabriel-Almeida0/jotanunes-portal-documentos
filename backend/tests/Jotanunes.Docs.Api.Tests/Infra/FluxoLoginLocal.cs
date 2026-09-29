using System.Text;
using System.Text.RegularExpressions;
using Jotanunes.Docs.Application.Portas;

namespace Jotanunes.Docs.Api.Tests.Infra;

/// <summary>Chamadas do login próprio da área Jotanunes (research R17) e leitura do e-mail de acesso.</summary>
public static partial class FluxoLoginLocal
{
    public static Task<HttpResponseMessage> LoginAsync(ApiFactory api, string login, string senha, string? ip = null) =>
        api.Cliente(ip).PostAsJsonAsync("/api/fluig/auth/login", new { login, senha });

    /// <summary>Login com sucesso; devolve o token.</summary>
    public static async Task<string> EntrarAsync(ApiFactory api, string login, string senha = Semente.SenhaPadrao)
    {
        var r = await LoginAsync(api, login, senha);
        Assert.True(r.StatusCode == HttpStatusCode.OK, $"login {login} → {(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return (await r.LerAsync()).Str("accessToken");
    }

    public static Task<HttpResponseMessage> TrocarSenhaAsync(ApiFactory api, string token, string senhaAtual, string novaSenha) =>
        api.Cliente(token: token).PostAsJsonAsync("/api/fluig/auth/trocar-senha", new { senhaAtual, novaSenha });

    /// <summary>Payload do JWT (sem validar), para conferir as claims.</summary>
    public static JsonElement Payload(string jwt)
    {
        var parte = jwt.Split('.')[1].Replace('-', '+').Replace('_', '/');
        parte = parte.PadRight(parte.Length + (4 - parte.Length % 4) % 4, '=');
        using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(parte)));
        return doc.RootElement.Clone();
    }

    /// <summary>Senha provisória do e-mail de acesso.</summary>
    public static string SenhaDoEmail(MensagemEmail email) => SenhaProvisoria().Match(email.Texto).Groups[1].Value;

    public static string LoginDoEmail(MensagemEmail email) => Login().Match(email.Texto).Groups[1].Value;

    [GeneratedRegex(@"Senha provisória: (\S+)")]
    private static partial Regex SenhaProvisoria();

    [GeneratedRegex(@"Login: (\S+)")]
    private static partial Regex Login();
}
