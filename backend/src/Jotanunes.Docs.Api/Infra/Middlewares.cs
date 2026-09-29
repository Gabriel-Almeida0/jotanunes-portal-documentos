using System.Text.Json;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Api.Infra;

/// <summary>Converte exceções em problem+json. Exceções não tratadas viram ERRO_INTERNO sem stack trace.</summary>
public sealed class TratamentoErrosMiddleware(RequestDelegate next, ILogger<TratamentoErrosMiddleware> log)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (Exception ex) when (!ctx.Response.HasStarted)
        {
            switch (ex)
            {
                case ErroAplicacao erro:
                    await Problemas.EscreverAsync(ctx, erro);
                    break;
                case ErroDominio erro:
                    await Problemas.EscreverAsync(ctx, ErroAplicacao.De(erro));
                    break;
                case BadHttpRequestException bad when bad.StatusCode == StatusCodes.Status413PayloadTooLarge:
                    await Problemas.EscreverAsync(ctx, CodigoErro.ARQUIVO_MUITO_GRANDE);
                    break;
                case InvalidDataException when ctx.Request.HasFormContentType:
                    // limite de multipart excedido
                    await Problemas.EscreverAsync(ctx, CodigoErro.ARQUIVO_MUITO_GRANDE);
                    break;
                case BadHttpRequestException or JsonException:
                    log.LogInformation("Requisição inválida em {Caminho}: {Tipo}", ctx.Request.Path, ex.GetType().Name);
                    await Problemas.EscreverAsync(ctx, CodigoErro.VALIDACAO, detalhe: "Não conseguimos ler os dados enviados.");
                    break;
                case OperationCanceledException when ctx.RequestAborted.IsCancellationRequested:
                    break;
                default:
                    log.LogError(ex, "Erro não tratado em {Metodo} {Caminho}", ctx.Request.Method, ctx.Request.Path);
                    await Problemas.EscreverAsync(ctx, CodigoErro.ERRO_INTERNO);
                    break;
            }
        }
    }
}

/// <summary>Headers de segurança em todas as respostas da API.</summary>
public sealed class CabecalhosSegurancaMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["Referrer-Policy"] = "no-referrer";
        h["X-Frame-Options"] = "DENY";
        return next(ctx);
    }
}
