using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.TiposDocumento;

/// <summary>Unidade da periodicidade (003 data-model §1). Persistida pelo nome, igual ao enum <c>UnidadePeriodicidade</c> do contrato.</summary>
public enum UnidadePeriodicidade
{
    /// <summary>Um envio vale para sempre (como antes da 003).</summary>
    UNICA,
    /// <summary>Um envio por período de N meses de calendário.</summary>
    MESES,
    /// <summary>Um envio por período de N dias.</summary>
    DIAS,
}

/// <summary>
/// Periodicidade do tipo de documento (003 research R2): unidade + intervalo N + prazo em dias depois do fim do período.
/// <c>UNICA</c> não tem intervalo nem prazo. MESES: N de 1 a 24; DIAS: N de 1 a 365; prazo de 0 a 90.
/// </summary>
public sealed record Periodicidade
{
    public const int IntervaloMaximoMeses = 24;
    public const int IntervaloMaximoDias = 365;
    public const int PrazoMaximoDias = 90;

    private Periodicidade(UnidadePeriodicidade unidade, int? intervalo, int? prazoDias)
    {
        Unidade = unidade;
        Intervalo = intervalo;
        PrazoDias = prazoDias;
    }

    public UnidadePeriodicidade Unidade { get; }

    /// <summary>N meses ou N dias; null se <see cref="UnidadePeriodicidade.UNICA"/>.</summary>
    public int? Intervalo { get; }

    /// <summary>Dias depois do fim do período para enviar sem atraso; null se <see cref="UnidadePeriodicidade.UNICA"/>.</summary>
    public int? PrazoDias { get; }

    public bool EhPeriodica => Unidade != UnidadePeriodicidade.UNICA;

    public static Periodicidade Unica() => new(UnidadePeriodicidade.UNICA, null, null);

    public static Periodicidade Meses(int intervalo, int prazoDias) => Criar(UnidadePeriodicidade.MESES, intervalo, prazoDias);

    public static Periodicidade Dias(int intervalo, int prazoDias) => Criar(UnidadePeriodicidade.DIAS, intervalo, prazoDias);

    /// <summary>
    /// Valida e cria. <c>UNICA</c> ignora intervalo e prazo. Erros de validação nos campos <c>periodicidade.intervalo</c> e
    /// <c>periodicidade.prazoDias</c>.
    /// </summary>
    public static Periodicidade Criar(UnidadePeriodicidade unidade, int? intervalo, int? prazoDias)
    {
        if (unidade == UnidadePeriodicidade.UNICA) return Unica();
        var v = new Validacao();
        var max = unidade == UnidadePeriodicidade.MESES ? IntervaloMaximoMeses : IntervaloMaximoDias;
        var nome = unidade == UnidadePeriodicidade.MESES ? "meses" : "dias";
        if (intervalo is null) v.Erro("periodicidade.intervalo", $"Informe de quantos em quantos {nome} o documento é enviado.");
        else if (intervalo < 1 || intervalo > max) v.Erro("periodicidade.intervalo", $"O intervalo deve ser de 1 a {max} {nome}.");
        if (prazoDias is null) v.Erro("periodicidade.prazoDias", "Informe o prazo em dias depois do fim do período.");
        else if (prazoDias < 0 || prazoDias > PrazoMaximoDias) v.Erro("periodicidade.prazoDias", $"O prazo deve ser de 0 a {PrazoMaximoDias} dias.");
        v.LancarSeHouver();
        return new Periodicidade(unidade, intervalo, prazoDias);
    }

    /// <summary>Mesma unidade e intervalo (o prazo pode ser diferente).</summary>
    public bool MesmaRegra(Periodicidade outra) => Unidade == outra.Unidade && Intervalo == outra.Intervalo;

    /// <summary>Nome da periodicidade: "Único", "Mensal", "Trimestral", "A cada 4 meses", "A cada 30 dias"…</summary>
    public string Nome() => (Unidade, Intervalo) switch
    {
        (UnidadePeriodicidade.UNICA, _) => "Único",
        (UnidadePeriodicidade.MESES, 1) => "Mensal",
        (UnidadePeriodicidade.MESES, 2) => "Bimestral",
        (UnidadePeriodicidade.MESES, 3) => "Trimestral",
        (UnidadePeriodicidade.MESES, 6) => "Semestral",
        (UnidadePeriodicidade.MESES, 12) => "Anual",
        (UnidadePeriodicidade.MESES, var n) => $"A cada {n} meses",
        (UnidadePeriodicidade.DIAS, 1) => "A cada 1 dia",
        (UnidadePeriodicidade.DIAS, var n) => $"A cada {n} dias",
        _ => Unidade.ToString(),
    };

    /// <summary>
    /// Texto pronto para exibir (pt-BR): "Único", "Mensal · até o dia 15 do mês seguinte",
    /// "Trimestral · até 10 dias após o fim do período", "A cada 30 dias · até o último dia do período".
    /// </summary>
    public string Descricao()
    {
        if (!EhPeriodica) return Nome();
        var prazo = PrazoDias!.Value;
        string ate;
        if (prazo == 0) ate = "até o último dia do período";
        else if (Unidade == UnidadePeriodicidade.MESES && Intervalo == 1 && prazo <= 28) ate = $"até o dia {prazo} do mês seguinte";
        else ate = prazo == 1 ? "até 1 dia após o fim do período" : $"até {prazo} dias após o fim do período";
        return $"{Nome()} · {ate}";
    }
}
