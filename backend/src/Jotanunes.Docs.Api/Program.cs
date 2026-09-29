using System.Text.Json.Serialization;
using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Api.Configuracao;
using Jotanunes.Docs.Api.Endpoints.Fluig;
using Jotanunes.Docs.Api.Endpoints.Portal;
using Jotanunes.Docs.Api.Infra;
using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Infrastructure;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http.Json;

var builder = WebApplication.CreateBuilder(args);

// Composição. Nada aqui lê configuração de forma antecipada: tudo é resolvido pelo container
// (IOptions/IConfiguration), então variáveis de ambiente e overrides de teste sempre valem.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddApplication();
builder.Services.AddInfrastructure();
builder.Services.AddAutenticacaoDocs();
builder.Services.AddLimiteRequisicoes();
builder.Services.Configure<JsonOptions>(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IConfiguration>((o, cfg) =>
{
    var secao = cfg.GetSection("Cors:Origins");
    var origens = (secao.Value is { } lista ? lista.Split(',') : secao.GetChildren().Select(c => c.Value ?? string.Empty))
        .Select(s => s.Trim().TrimEnd('/')).Where(s => s.Length > 0).ToArray();
    o.AddDefaultPolicy(p => p.WithOrigins(origens)
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Authorization", "Content-Type")
        .WithExposedHeaders("Content-Disposition", "Location", "Retry-After"));
});

var app = builder.Build();

ValidacaoConfiguracao.GarantirValida(app.Configuration, app.Environment);
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await app.Services.AplicarMigrationsAsync();
}

app.UseMiddleware<CabecalhosSegurancaMiddleware>();
app.UseMiddleware<TratamentoErrosMiddleware>();
app.UseStatusCodePages(async ctx =>
{
    var http = ctx.HttpContext;
    if (!http.Response.HasStarted && http.Response.ContentLength is null or 0)
    {
        await Problemas.EscreverAsync(http, Problemas.CodigoPorStatus(http.Response.StatusCode), http.Response.StatusCode);
    }
});
app.UseRouting();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous().WithName("health");

app.MapGroup("/api/fluig")
    .RequireAuthorization(Politicas.Fluig)
    .MapSessaoFluig()
    .MapObras()
    .MapEmpresas()
    .MapConvites()
    .MapTiposDocumento()
    .MapAnalise();

app.MapGroup("/api/portal")
    .MapAcessoPortal()
    .MapDocumentosPortal();

await app.RunAsync();

public partial class Program;
