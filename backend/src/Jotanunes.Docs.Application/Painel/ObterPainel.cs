using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Portas;

namespace Jotanunes.Docs.Application.Painel;

public sealed class ObterPainel(IConsultaDocumentos consulta, TimeProvider relogio) : ICasoDeUso
{
    public Task<PainelDto> ExecutarAsync(CancellationToken ct = default) => consulta.ObterPainelAsync(relogio.GetUtcNow(), ct);
}

public sealed class ObterUsuarioFluig(Portas.IUsuarioFluigAtual usuario) : ICasoDeUso
{
    public UsuarioFluigDto Executar() => new(usuario.Login, usuario.Nome, usuario.Email, usuario.EhAdmin);
}
