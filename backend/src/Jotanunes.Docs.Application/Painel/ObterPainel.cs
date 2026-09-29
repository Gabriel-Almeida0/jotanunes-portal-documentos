using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Portas;

namespace Jotanunes.Docs.Application.Painel;

public sealed class ObterPainel(IConsultaDocumentos consulta, TimeProvider relogio) : ICasoDeUso
{
    public Task<PainelDto> ExecutarAsync(CancellationToken ct = default) => consulta.ObterPainelAsync(relogio.GetUtcNow(), ct);
}

/// <summary>
/// Usuário atual da área Jotanunes. Nome/e-mail/perfil vêm do token (as duas origens têm as mesmas claims); a troca
/// pendente do login próprio vem do cadastro (o token já foi conferido contra a versão da credencial).
/// </summary>
public sealed class ObterUsuarioFluig(IUsuarioFluigAtual usuario, IUsuarioInternoRepositorio usuariosInternos) : ICasoDeUso
{
    public async Task<UsuarioFluigDto> ExecutarAsync(CancellationToken ct = default)
    {
        if (!usuario.EhLoginLocal) return new(usuario.Login, usuario.Nome, usuario.Email, usuario.EhAdmin, OrigemSessao.FLUIG, false);
        var interno = await usuariosInternos.ObterAsync(usuario.UsuarioInternoId!.Value, ct)
            ?? throw new Erros.ErroAplicacao(Erros.CodigoErro.NAO_AUTENTICADO);
        return new(usuario.Login, usuario.Nome, usuario.Email, usuario.EhAdmin, OrigemSessao.LOGIN_LOCAL, interno.TrocaSenhaObrigatoria);
    }
}
