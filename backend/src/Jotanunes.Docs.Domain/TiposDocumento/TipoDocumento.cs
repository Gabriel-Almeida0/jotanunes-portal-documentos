using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.TiposDocumento;

/// <summary>
/// Tipo de documento. Todo tipo GERAL ativo é exigido de toda empresa ativa; um tipo POR_OBRA ativo é exigido das
/// empresas com vínculo ativo nas obras ativas que o marcaram (data-model 002 §5).
/// </summary>
public sealed class TipoDocumento
{
    private TipoDocumento() { }

    public Guid Id { get; private set; }
    public string Nome { get; private set; } = string.Empty;
    public string? Instrucoes { get; private set; }
    public Abrangencia Abrangencia { get; private set; } = Abrangencia.GERAL;
    public bool Ativo { get; private set; }
    public DateTimeOffset CriadoEm { get; private set; }
    /// <summary>Unidade da periodicidade (coluna <c>periodicidade_unidade</c>; 003 data-model §1).</summary>
    public UnidadePeriodicidade PeriodicidadeUnidade { get; private set; } = UnidadePeriodicidade.UNICA;
    public int? PeriodicidadeIntervalo { get; private set; }
    public int? PrazoDias { get; private set; }
    /// <summary>
    /// Início da cobrança dos períodos do lado do tipo: a criação; vira "agora" ao reativar o tipo ou ao passar de
    /// Único para periódico (003 research R5).
    /// </summary>
    public DateTimeOffset CobrancaDesde { get; private set; }

    public Periodicidade Periodicidade => Periodicidade.Criar(PeriodicidadeUnidade, PeriodicidadeIntervalo, PrazoDias);
    public string CriadoPorLogin { get; private set; } = string.Empty;
    public DateTimeOffset? AtualizadoEm { get; private set; }
    public string? AtualizadoPorLogin { get; private set; }

    public static TipoDocumento Criar(string? nome, string? instrucoes, string autorLogin, DateTimeOffset agora,
        Abrangencia abrangencia = Abrangencia.GERAL, Periodicidade? periodicidade = null)
    {
        var t = new TipoDocumento
        {
            Id = Guid.NewGuid(), Ativo = true, CriadoEm = agora, CobrancaDesde = agora, CriadoPorLogin = autorLogin, Abrangencia = abrangencia,
        };
        t.Aplicar(nome, instrucoes);
        t.DefinirPeriodicidade(periodicidade ?? Periodicidade.Unica());
        return t;
    }

    public void Atualizar(string? nome, string? instrucoes, bool ativo, string autorLogin, DateTimeOffset agora)
    {
        Aplicar(nome, instrucoes);
        if (ativo && !Ativo) CobrancaDesde = agora; // reativado: a cobrança recomeça agora
        Ativo = ativo;
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    /// <summary>
    /// Troca a abrangência. Só é permitido enquanto o tipo não tem nenhum envio (<see cref="TipoErroDominio.AbrangenciaImutavel"/>).
    /// </summary>
    /// <returns>true se a abrangência mudou.</returns>
    public bool TrocarAbrangencia(Abrangencia nova, bool temEnvios)
    {
        if (nova == Abrangencia) return false;
        if (temEnvios)
        {
            throw new ErroDominio(TipoErroDominio.AbrangenciaImutavel, "A abrangência não pode ser alterada porque este tipo já tem envios.");
        }
        Abrangencia = nova;
        return true;
    }

    /// <summary>
    /// Troca a periodicidade. Unidade e intervalo só mudam enquanto o tipo não tem envios
    /// (<see cref="TipoErroDominio.PeriodicidadeImutavel"/>); o prazo muda sempre. De Único para periódico, a cobrança
    /// começa agora.
    /// </summary>
    /// <returns>true se algo (unidade, intervalo ou prazo) mudou.</returns>
    public bool AlterarPeriodicidade(Periodicidade nova, bool temEnvios, DateTimeOffset agora)
    {
        var atual = Periodicidade;
        if (nova == atual) return false;
        if (!nova.MesmaRegra(atual) && temEnvios)
        {
            throw new ErroDominio(TipoErroDominio.PeriodicidadeImutavel, "A periodicidade só pode mudar enquanto o tipo não tiver envios.");
        }
        if (!atual.EhPeriodica && nova.EhPeriodica) CobrancaDesde = agora;
        DefinirPeriodicidade(nova);
        return true;
    }

    private void DefinirPeriodicidade(Periodicidade p)
    {
        PeriodicidadeUnidade = p.Unidade;
        PeriodicidadeIntervalo = p.Intervalo;
        PrazoDias = p.PrazoDias;
    }

    private void Aplicar(string? nome, string? instrucoes)
    {
        var v = new Validacao();
        var n = v.TextoObrigatorio("nome", nome, 3, 120, "o nome do tipo de documento");
        var i = v.TextoOpcional("instrucoes", instrucoes, 1000, "as instruções");
        v.LancarSeHouver();
        Nome = n!;
        Instrucoes = i;
    }
}
