using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.TiposDocumento;

internal static class EntradaTipo
{
    public static Abrangencia Abrangencia(string? valor) =>
        Entrada.EnumOpcional<Abrangencia>(valor, "abrangencia")
        ?? throw ErroAplicacao.Validacao("abrangencia", "Informe a abrangência: geral da empresa ou por obra.");

    /// <summary>Omitida = UNICA (003). Faixas: MESES 1–24, DIAS 1–365, prazo 0–90 (erros em <c>periodicidade.*</c>).</summary>
    public static Periodicidade Periodicidade(PeriodicidadeInput? i)
    {
        if (i is null) return Domain.TiposDocumento.Periodicidade.Unica();
        var unidade = Entrada.EnumOpcional<UnidadePeriodicidade>(i.Unidade, "periodicidade.unidade")
            ?? throw ErroAplicacao.Validacao("periodicidade.unidade", "Informe a periodicidade: único, em meses ou em dias.");
        try { return Domain.TiposDocumento.Periodicidade.Criar(unidade, i.Intervalo, i.PrazoDias); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
    }
}

public sealed class CriarTipo(ITipoDocumentoRepositorio tipos, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<TipoDocumentoDto> ExecutarAsync(TipoDocumentoInput i, CancellationToken ct = default)
    {
        var abrangencia = EntradaTipo.Abrangencia(i.Abrangencia);
        var periodicidade = EntradaTipo.Periodicidade(i.Periodicidade);
        TipoDocumento t;
        try { t = TipoDocumento.Criar(i.Nome, i.Instrucoes, usuario.Login, relogio.GetUtcNow(), abrangencia, periodicidade); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        tipos.Adicionar(t);
        await uow.SalvarAsync(ct);
        return TipoDocumentoDto.De(t);
    }
}

/// <summary>
/// Atualiza o tipo. A abrangência só muda se o tipo não tiver envios (409 ABRANGENCIA_IMUTAVEL); POR_OBRA → GERAL
/// remove as marcações em obras na mesma gravação (research R9). Periodicidade (003): unidade/intervalo só sem envios
/// (409 PERIODICIDADE_IMUTAVEL); o prazo muda sempre; auditoria TIPO_PERIODICIDADE_ALTERADA.
/// </summary>
public sealed class AtualizarTipo(ITipoDocumentoRepositorio tipos, IObraRepositorio obras, IUnidadeTrabalho uow, IRegistroAuditoria auditoria,
    IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<TipoDocumentoDto> ExecutarAsync(Guid id, TipoDocumentoInput i, CancellationToken ct = default)
    {
        var t = await tipos.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var ativo = Entrada.Obrigatorio(i.Ativo, "ativo");
        var abrangencia = EntradaTipo.Abrangencia(i.Abrangencia);
        // Na atualização, periodicidade omitida = mantém a atual (omitida = UNICA só na criação).
        var periodicidade = i.Periodicidade is null ? t.Periodicidade : EntradaTipo.Periodicidade(i.Periodicidade);
        var agora = relogio.GetUtcNow();
        try
        {
            t.Atualizar(i.Nome, i.Instrucoes, ativo, usuario.Login, agora);
            bool? temEnviosCache = null;
            async Task<bool> TemEnviosAsync() => temEnviosCache ??= await tipos.TemEnviosAsync(t.Id, ct);

            var temEnvios = abrangencia != t.Abrangencia && await TemEnviosAsync();
            if (t.TrocarAbrangencia(abrangencia, temEnvios))
            {
                if (abrangencia == Abrangencia.GERAL) await obras.RemoverMarcacoesDoTipoAsync(t.Id, ct);
                auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.TipoAbrangenciaAlterada, RecursoAuditoria.TipoDocumento, t.Id.ToString());
            }
            var mudaRegra = !periodicidade.MesmaRegra(t.Periodicidade) && await TemEnviosAsync();
            if (t.AlterarPeriodicidade(periodicidade, mudaRegra, agora))
            {
                auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.TipoPeriodicidadeAlterada, RecursoAuditoria.TipoDocumento,
                    t.Id.ToString());
            }
        }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        await uow.SalvarAsync(ct);
        return TipoDocumentoDto.De(t);
    }
}

public sealed class ListarTipos(ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<IReadOnlyList<TipoDocumentoDto>> ExecutarAsync(bool? ativo, string? abrangencia = null, bool? periodico = null,
        CancellationToken ct = default) =>
        (await tipos.ListarAsync(ativo, Entrada.EnumOpcional<Abrangencia>(abrangencia, "abrangencia"), periodico, ct)).Select(TipoDocumentoDto.De).ToList();
}

public sealed class ObterTipo(ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<TipoDocumentoDto> ExecutarAsync(Guid id, CancellationToken ct = default) =>
        TipoDocumentoDto.De(await tipos.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado());
}
