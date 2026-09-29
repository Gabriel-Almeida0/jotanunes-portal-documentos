using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Convites;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.Convites;

/// <summary>
/// Gera link (7 dias) + senha temporária, substitui convites anteriores, redefine o acesso e envia o e-mail.
/// Ordem: grava → envia e-mail → confirma. Falha no e-mail desfaz tudo (502 EMAIL_FALHOU).
/// </summary>
public sealed class EnviarConvite(
    IEmpresaRepositorio empresas,
    IObraRepositorio obras,
    IConviteRepositorio convites,
    IUnidadeTrabalho uow,
    IUsuarioFluigAtual usuario,
    IGeradorSegredos segredos,
    IHasherSenha hasher,
    IEnviadorEmail email,
    IRegistroAuditoria auditoria,
    IOptions<ConfiguracaoPortal> portal,
    TimeProvider relogio,
    ILogger<EnviarConvite> log) : ICasoDeUso
{
    public async Task<ConviteDto> ExecutarAsync(Guid empresaId, CancellationToken ct = default)
    {
        var empresa = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        if (!empresa.Ativa) throw new ErroAplicacao(CodigoErro.EMPRESA_INATIVA);

        var agora = relogio.GetUtcNow();
        var (token, tokenHash) = segredos.GerarTokenConvite();
        var senhaTemporaria = segredos.GerarSenhaTemporaria();

        foreach (var anterior in await convites.ListarAbertosAsync(empresaId, ct))
        {
            if (anterior.Situacao(agora) == SituacaoConvite.VALIDO) anterior.MarcarSubstituido(agora);
        }

        empresa.RegistrarConvite(hasher.Gerar(senhaTemporaria), agora);
        var convite = Convite.Criar(empresa.Id, empresa.EmailContato, tokenHash, usuario.Login, usuario.Nome, agora);
        convites.Adicionar(convite);
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.ConviteEnviado, "EMPRESA", empresa.Id.ToString());

        var nomesObras = (await obras.ListarObrasDaEmpresaAsync(empresa.Id, ct)).Select(o => o.Nome).ToList();
        var link = $"{portal.Value.BaseUrl.TrimEnd('/')}/acesso?convite={token}";
        var mensagem = ModelosEmail.Convite(empresa.EmailContato, empresa.RazaoSocial,
            Domain.Empresas.Cnpj.Criar(empresa.Cnpj).Formatado, nomesObras, link, senhaTemporaria, convite.ExpiraEm);

        await using var tx = await uow.IniciarTransacaoAsync(ct);
        await uow.SalvarAsync(ct);
        try
        {
            await email.EnviarAsync(mensagem, ct);
        }
        catch (FalhaEnvioEmail ex)
        {
            await tx.DesfazerAsync(CancellationToken.None);
            log.LogWarning(ex, "Falha ao enviar o convite da empresa {EmpresaId}", empresa.Id);
            throw new ErroAplicacao(CodigoErro.EMAIL_FALHOU);
        }
        await tx.ConfirmarAsync(ct);
        return ConviteDto.De(convite, agora);
    }
}

public sealed class ListarConvites(IEmpresaRepositorio empresas, IConviteRepositorio convites, TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<ConviteDto>> ExecutarAsync(Guid empresaId, CancellationToken ct = default)
    {
        _ = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var agora = relogio.GetUtcNow();
        return (await convites.ListarDaEmpresaAsync(empresaId, ct)).Select(c => ConviteDto.De(c, agora)).ToList();
    }
}
