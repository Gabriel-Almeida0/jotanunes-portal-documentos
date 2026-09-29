using System.Security.Claims;
using System.Text;
using Jotanunes.Docs.Api.Infra;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Infrastructure.Seguranca;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Jotanunes.Docs.Api.Autenticacao;

public static class Esquemas
{
    public const string Fluig = "Fluig";
    public const string Portal = "Portal";
}

public static class Politicas
{
    public const string Fluig = "Fluig";
    public const string Portal = "Portal";
    /// <summary>Exige troca_senha=false; falha → 403 TROCA_SENHA_OBRIGATORIA.</summary>
    public const string PortalCompleto = "PortalCompleto";
    /// <summary>
    /// Token Fluig com o papel admin. Aplicada às operações <c>x-requer-admin</c> do contrato; falha → 403
    /// SEM_PERMISSAO (antes de ler o corpo ou o banco) e linha PERMISSAO_NEGADA na auditoria.
    /// </summary>
    public const string FluigAdmin = "FluigAdmin";
}

/// <summary>Papéis reconhecidos na claim <c>roles</c> do token Fluig (contracts/fluig-identity.md).</summary>
public static class PapeisFluig
{
    public const string Claim = "roles";
    public const string Admin = "admin";

    /// <summary>
    /// Regra única do perfil: alguma claim <c>roles</c> do tipo texto igual a <c>admin</c> (comparação exata). Lista JSON
    /// vira várias claims (MapInboundClaims=false); texto único vira uma. Booleano, número, objeto ou lista aninhada
    /// chegam com outro tipo de valor e contam como usuário comum (sem recusar o token).
    /// </summary>
    public static bool EhAdmin(ClaimsPrincipal? usuario) =>
        usuario?.FindAll(Claim).Any(c => c.ValueType == ClaimValueTypes.String && string.Equals(c.Value, Admin, StringComparison.Ordinal)) == true;
}

/// <summary>Configuração do token Fluig (seção Auth:Fluig).</summary>
public sealed class OpcoesAuthFluig
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "fluig";
    public string Audience { get; set; } = "jotanunes-docs-api";
}

public static class AutenticacaoExtensions
{
    public static readonly TimeSpan ToleranciaRelogio = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan ValidadeMaximaFluig = TimeSpan.FromHours(8);

    public static IServiceCollection AddAutenticacaoDocs(this IServiceCollection services)
    {
        services.AddOptions<OpcoesAuthFluig>().BindConfiguration("Auth:Fluig");

        services.AddAuthentication()
            .AddJwtBearer(Esquemas.Fluig)
            .AddJwtBearer(Esquemas.Portal);

        // Configuração PREGUIÇOSA: lida do container quando o esquema é usado (respeita overrides de teste).
        services.AddOptions<JwtBearerOptions>(Esquemas.Fluig)
            .Configure<IOptions<OpcoesAuthFluig>, TimeProvider>((o, fluig, relogio) =>
            {
                var f = fluig.Value;
                Comum(o, relogio, f.Issuer, f.Audience, new SymmetricSecurityKey(Encoding.UTF8.GetBytes(f.Secret)));
                o.TokenValidationParameters.NameClaimType = "name";
                o.Events.OnTokenValidated = ValidarTokenFluig;
            });

        services.AddOptions<JwtBearerOptions>(Esquemas.Portal)
            .Configure<IOptions<OpcoesAuthPortal>, TimeProvider>((o, portal, relogio) =>
            {
                var p = portal.Value;
                Comum(o, relogio, p.Issuer, p.Audience, p.Chave());
                o.Events.OnTokenValidated = ValidarTokenPortalAsync;
            });

        services.AddAuthorization(o =>
        {
            o.AddPolicy(Politicas.Fluig, p => p.AddAuthenticationSchemes(Esquemas.Fluig).RequireAuthenticatedUser());
            o.AddPolicy(Politicas.Portal, p => p.AddAuthenticationSchemes(Esquemas.Portal).RequireAuthenticatedUser());
            o.AddPolicy(Politicas.PortalCompleto, p => p.AddAuthenticationSchemes(Esquemas.Portal).RequireAuthenticatedUser()
                .AddRequirements(new TrocaSenhaConcluidaRequirement()));
            o.AddPolicy(Politicas.FluigAdmin, p => p.AddAuthenticationSchemes(Esquemas.Fluig).RequireAuthenticatedUser()
                .AddRequirements(new PapelAdminRequirement()));
        });
        services.AddSingleton<IAuthorizationHandler, TrocaSenhaConcluidaHandler>();
        services.AddSingleton<IAuthorizationHandler, PapelAdminHandler>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ResultadoAutorizacaoHandler>();

        services.AddHttpContextAccessor();
        services.AddScoped<IUsuarioFluigAtual, UsuarioFluigAtualDeClaims>();
        services.AddScoped<IEmpresaPortalAtual, EmpresaPortalAtualDeClaims>();
        services.AddScoped<IContextoRequisicao, ContextoRequisicaoHttp>();
        return services;
    }

    private static void Comum(JwtBearerOptions o, TimeProvider relogio, string issuer, string audience, SecurityKey chave)
    {
        o.MapInboundClaims = false;
        o.RequireHttpsMetadata = false;
        o.SaveToken = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = chave,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = ToleranciaRelogio,
            // Usa o TimeProvider da aplicação (testável com FakeTimeProvider).
            LifetimeValidator = (notBefore, expires, _, _) =>
            {
                var agora = relogio.GetUtcNow().UtcDateTime;
                if (expires is null) return false;
                if (notBefore is { } nbf && nbf > agora + ToleranciaRelogio) return false;
                return expires.Value > agora - ToleranciaRelogio;
            },
        };
        o.Events = new JwtBearerEvents
        {
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                if (!ctx.Response.HasStarted) await Problemas.EscreverAsync(ctx.HttpContext, CodigoErro.NAO_AUTENTICADO);
            },
        };
    }

    private static Task ValidarTokenFluig(TokenValidatedContext ctx)
    {
        if (ctx.SecurityToken is not JsonWebToken jwt)
        {
            ctx.Fail("token inválido");
            return Task.CompletedTask;
        }
        var sub = jwt.Subject;
        var nome = jwt.TryGetPayloadValue<string>("name", out var n) ? n : null;
        var temIat = jwt.TryGetPayloadValue<long>("iat", out _);
        if (string.IsNullOrWhiteSpace(sub) || string.IsNullOrWhiteSpace(nome))
        {
            ctx.Fail("sub/name ausentes");
        }
        else if (!temIat || jwt.ValidTo - jwt.IssuedAt > ValidadeMaximaFluig)
        {
            ctx.Fail("validade acima de 8 horas");
        }
        return Task.CompletedTask;
    }

    private static async Task ValidarTokenPortalAsync(TokenValidatedContext ctx)
    {
        var principal = ctx.Principal;
        var sub = principal?.FindFirst(ClaimsPortal.Sub)?.Value;
        var ver = principal?.FindFirst(ClaimsPortal.Versao)?.Value;
        if (!Guid.TryParse(sub, out var empresaId) || !int.TryParse(ver, out var versao) || principal?.FindFirst(ClaimsPortal.TrocaSenha) is null)
        {
            ctx.Fail("claims ausentes");
            return;
        }
        // Revogação imediata: empresa ativa e versão da credencial igual à do token.
        var empresas = ctx.HttpContext.RequestServices.GetRequiredService<IEmpresaRepositorio>();
        var empresa = await empresas.ObterAsync(empresaId, ctx.HttpContext.RequestAborted);
        if (empresa is null || !empresa.Ativa || empresa.VersaoCredencial != versao) ctx.Fail("credencial revogada");
    }
}

public sealed class TrocaSenhaConcluidaRequirement : IAuthorizationRequirement;

public sealed class TrocaSenhaConcluidaHandler : AuthorizationHandler<TrocaSenhaConcluidaRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, TrocaSenhaConcluidaRequirement requirement)
    {
        var valor = context.User.FindFirst(ClaimsPortal.TrocaSenha)?.Value;
        if (string.Equals(valor, "false", StringComparison.OrdinalIgnoreCase)) context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

public sealed class PapelAdminRequirement : IAuthorizationRequirement;

public sealed class PapelAdminHandler : AuthorizationHandler<PapelAdminRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PapelAdminRequirement requirement)
    {
        if (PapeisFluig.EhAdmin(context.User)) context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

/// <summary>
/// 403 das políticas → problem+json do contrato: <see cref="PapelAdminRequirement"/> → SEM_PERMISSAO (e a tentativa
/// na auditoria, o único registro gravado); <see cref="TrocaSenhaConcluidaRequirement"/> (portal) → TROCA_SENHA_OBRIGATORIA.
/// </summary>
public sealed class ResultadoAutorizacaoHandler : IAuthorizationMiddlewareResultHandler
{
    public const string RecursoOperacao = "OPERACAO";

    private readonly AuthorizationMiddlewareResultHandler _padrao = new();

    public async Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult result)
    {
        if (result.Forbidden)
        {
            var falhas = result.AuthorizationFailure?.FailedRequirements ?? [];
            if (falhas.OfType<PapelAdminRequirement>().Any())
            {
                await RegistrarPermissaoNegadaAsync(context);
                await Problemas.EscreverAsync(context, CodigoErro.SEM_PERMISSAO);
                return;
            }
            await Problemas.EscreverAsync(context, CodigoErro.TROCA_SENHA_OBRIGATORIA);
            return;
        }
        await _padrao.HandleAsync(next, context, policy, result);
    }

    private static async Task RegistrarPermissaoNegadaAsync(HttpContext context)
    {
        var servicos = context.RequestServices;
        var usuario = servicos.GetRequiredService<IUsuarioFluigAtual>();
        var operacao = context.GetEndpoint()?.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName;
        servicos.GetRequiredService<IRegistroAuditoria>()
            .Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.PermissaoNegada, RecursoOperacao, operacao);
        await servicos.GetRequiredService<IUnidadeTrabalho>().SalvarAsync(context.RequestAborted);
    }
}

public sealed class UsuarioFluigAtualDeClaims(IHttpContextAccessor acessor) : IUsuarioFluigAtual
{
    private System.Security.Claims.ClaimsPrincipal Usuario =>
        acessor.HttpContext?.User ?? throw new InvalidOperationException("Sem contexto HTTP.");

    public string Login => Usuario.FindFirst("sub")?.Value ?? throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO);
    public string Nome => Usuario.FindFirst("name")?.Value ?? throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO);
    public string Email => Usuario.FindFirst("email")?.Value ?? string.Empty;
    public bool EhAdmin => PapeisFluig.EhAdmin(acessor.HttpContext?.User);
}

public sealed class EmpresaPortalAtualDeClaims(IHttpContextAccessor acessor) : IEmpresaPortalAtual
{
    private System.Security.Claims.ClaimsPrincipal Usuario =>
        acessor.HttpContext?.User ?? throw new InvalidOperationException("Sem contexto HTTP.");

    public Guid EmpresaId => Guid.TryParse(Usuario.FindFirst(ClaimsPortal.Sub)?.Value, out var id)
        ? id
        : throw new ErroAplicacao(CodigoErro.NAO_AUTENTICADO);

    public string Cnpj => Usuario.FindFirst(ClaimsPortal.Cnpj)?.Value ?? string.Empty;

    public bool TrocaSenhaPendente =>
        !string.Equals(Usuario.FindFirst(ClaimsPortal.TrocaSenha)?.Value, "false", StringComparison.OrdinalIgnoreCase);
}

public sealed class ContextoRequisicaoHttp(IHttpContextAccessor acessor) : IContextoRequisicao
{
    public string? Ip => acessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}
