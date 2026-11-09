using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Envios;

/// <summary>Datas de período no fuso de Brasília (America/Sao_Paulo; 003 research R4). O relógio da aplicação dá UTC.</summary>
public static class DataLocal
{
    private static readonly TimeZoneInfo Fuso = ObterFuso();

    public static DateOnly De(DateTimeOffset instante) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instante, Fuso).DateTime);

    private static TimeZoneInfo ObterFuso()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "BRT", "BRT"); }
    }
}

/// <summary>Período (competência) calculado: início, fim, prazo (fim + prazoDias) e rótulo pt-BR.</summary>
public sealed record PeriodoCalculado(DateOnly Inicio, DateOnly Fim, DateOnly Prazo, string Rotulo);

/// <summary>
/// Períodos derivados (003 data-model §3; nada é persistido). MESES/N: o primeiro período começa no dia 1 do mês do
/// início da cobrança e cada um tem N meses de calendário. DIAS/N: começa no próprio dia, em blocos de N dias.
/// </summary>
public static class CalendarioPeriodos
{
    private static readonly string[] Meses =
        ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    private static readonly string[] MesesCurtos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    /// <summary>Limite de segurança (25 anos de períodos diários não acontecem na prática; evita laço sem fim com datas erradas).</summary>
    private const int MaximoPeriodos = 10_000;

    /// <summary>
    /// Períodos exigidos, do primeiro (que contém <paramref name="inicioCobranca"/>) até o que contém <paramref name="hoje"/>,
    /// em ordem cronológica. Vazio para periodicidade única ou se a cobrança ainda não começou.
    /// </summary>
    public static IReadOnlyList<PeriodoCalculado> Gerar(Periodicidade periodicidade, DateOnly inicioCobranca, DateOnly hoje)
    {
        var lista = new List<PeriodoCalculado>();
        if (!periodicidade.EhPeriodica) return lista;
        var inicio = PrimeiroInicio(periodicidade, inicioCobranca);
        while (inicio <= hoje && lista.Count < MaximoPeriodos)
        {
            var proximo = Proximo(periodicidade, inicio);
            lista.Add(Criar(periodicidade, inicio, proximo.AddDays(-1)));
            inicio = proximo;
        }
        return lista;
    }

    /// <summary>Período que começa em <paramref name="inicio"/> (sem validar se é exigido).</summary>
    public static PeriodoCalculado Periodo(Periodicidade periodicidade, DateOnly inicio) =>
        Criar(periodicidade, inicio, Proximo(periodicidade, inicio).AddDays(-1));

    /// <summary>Rótulo pt-BR (research R9): "Março/2026", "Jan–Mar/2026", "2026", "Fev/2026–Jan/2027", "01/03 a 30/03/2026".</summary>
    public static string Rotulo(UnidadePeriodicidade unidade, DateOnly inicio, DateOnly fim)
    {
        if (unidade == UnidadePeriodicidade.MESES)
        {
            var meses = (fim.Year - inicio.Year) * 12 + fim.Month - inicio.Month + 1;
            if (meses == 1) return $"{Meses[inicio.Month - 1]}/{inicio.Year}";
            if (meses == 12 && inicio.Month == 1) return inicio.Year.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return inicio.Year == fim.Year
                ? $"{MesesCurtos[inicio.Month - 1]}–{MesesCurtos[fim.Month - 1]}/{fim.Year}"
                : $"{MesesCurtos[inicio.Month - 1]}/{inicio.Year}–{MesesCurtos[fim.Month - 1]}/{fim.Year}";
        }
        if (inicio == fim) return Data(inicio);
        return inicio.Year == fim.Year
            ? $"{inicio.Day:00}/{inicio.Month:00} a {Data(fim)}"
            : $"{Data(inicio)} a {Data(fim)}";
    }

    private static string Data(DateOnly d) => $"{d.Day:00}/{d.Month:00}/{d.Year}";

    private static DateOnly PrimeiroInicio(Periodicidade p, DateOnly inicioCobranca) =>
        p.Unidade == UnidadePeriodicidade.MESES ? new DateOnly(inicioCobranca.Year, inicioCobranca.Month, 1) : inicioCobranca;

    private static DateOnly Proximo(Periodicidade p, DateOnly inicio) =>
        p.Unidade == UnidadePeriodicidade.MESES ? inicio.AddMonths(p.Intervalo!.Value) : inicio.AddDays(p.Intervalo!.Value);

    private static PeriodoCalculado Criar(Periodicidade p, DateOnly inicio, DateOnly fim) =>
        new(inicio, fim, fim.AddDays(p.PrazoDias ?? 0), Rotulo(p.Unidade, inicio, fim));
}
