using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.TiposDocumento;

public sealed class CriarTipo(ITipoDocumentoRepositorio tipos, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<TipoDocumentoDto> ExecutarAsync(TipoDocumentoInput i, CancellationToken ct = default)
    {
        TipoDocumento t;
        try { t = TipoDocumento.Criar(i.Nome, i.Instrucoes, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        tipos.Adicionar(t);
        await uow.SalvarAsync(ct);
        return TipoDocumentoDto.De(t);
    }
}

public sealed class AtualizarTipo(ITipoDocumentoRepositorio tipos, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<TipoDocumentoDto> ExecutarAsync(Guid id, TipoDocumentoInput i, CancellationToken ct = default)
    {
        var t = await tipos.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var ativo = Entrada.Obrigatorio(i.Ativo, "ativo");
        try { t.Atualizar(i.Nome, i.Instrucoes, ativo, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        await uow.SalvarAsync(ct);
        return TipoDocumentoDto.De(t);
    }
}

public sealed class ListarTipos(ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<IReadOnlyList<TipoDocumentoDto>> ExecutarAsync(bool? ativo, CancellationToken ct = default) =>
        (await tipos.ListarAsync(ativo, ct)).Select(TipoDocumentoDto.De).ToList();
}

public sealed class ObterTipo(ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<TipoDocumentoDto> ExecutarAsync(Guid id, CancellationToken ct = default) =>
        TipoDocumentoDto.De(await tipos.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado());
}
