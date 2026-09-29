using System.Net;
using System.Threading.RateLimiting;
using Jotanunes.Docs.Application.Erros;
using Microsoft.AspNetCore.RateLimiting;

namespace Jotanunes.Docs.Api.Infra;

/// <summary>Janela fixa de 10 requisições/min por IP nas rotas anônimas do portal (429 LIMITE_REQUISICOES).</summary>
public static class LimiteRequisicoes
{
    public const string PoliticaAnonima = "portal-anonimo";

    public static IServiceCollection AddLimiteRequisicoes(this IServiceCollection services)
    {
        services.AddRateLimiter(o =>
        {
            o.AddPolicy(PoliticaAnonima, ctx =>
            {
                var limite = ctx.RequestServices.GetRequiredService<IConfiguration>().GetValue("RateLimit:PermitLimit", 10);
                var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? IPAddress.None.ToString();
                return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = limite,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                });
            });
            o.OnRejected = async (ctx, ct) =>
            {
                var retry = ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var r) ? (int)Math.Ceiling(r.TotalSeconds) : 60;
                ctx.HttpContext.Response.Headers.RetryAfter = retry.ToString(System.Globalization.CultureInfo.InvariantCulture);
                await Problemas.EscreverAsync(ctx.HttpContext, CodigoErro.LIMITE_REQUISICOES);
            };
        });
        return services;
    }
}
