using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Jotanunes.Docs.Api.Tests.Autorizacao;

public sealed record Rota(string Metodo, string Padrao)
{
    public override string ToString() => $"{Metodo} {Padrao}";

    /// <summary>URL concreta com ids aleatórios nos parâmetros.</summary>
    public string Url() => System.Text.RegularExpressions.Regex.Replace(Padrao, @"\{(\w+)\}", m =>
        m.Groups[1].Value == "token" ? new string('a', 43) : Guid.NewGuid().ToString());

    public HttpRequestMessage Requisicao(string? token)
    {
        var req = new HttpRequestMessage(new HttpMethod(Metodo), Url());
        if (token is not null) req.Headers.Authorization = new("Bearer", token);
        if (Metodo is "POST" or "PUT") req.Content = JsonContent.Create(new { });
        return req;
    }

    /// <summary>Rotas registradas na API (via EndpointDataSource).</summary>
    public static IReadOnlyList<Rota> Registradas(ApiFactory api) =>
        api.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? []).Select(m => new Rota(m, "/" + e.RoutePattern.RawText!.TrimStart('/'))))
            .Distinct()
            .OrderBy(r => r.Padrao).ThenBy(r => r.Metodo)
            .ToList();
}
